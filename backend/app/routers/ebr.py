from typing import Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.ebr import (
    EBR, EBRStep, EBRParameterResult, EBRIPQCResult,
    EBRMaterialDispensing, EBRStatus, EBRStepStatus
)
from ..models.mbr import MBR, MBRStatus
from ..models.user import User
from ..models.audit import AuditAction
from ..schemas.ebr import (
    EBRCreate, EBROut, EBRList, EBRSummary,
    CompleteStepPayload, SaveStepPayload,
    DispenseMaterialPayload, FinalizePayload, WorkflowAction
)
from ..core.audit_logger import log_event
from ..core.rbac import require_permission
from ..core.notifier import notify_permission, notify_user
from ..models.notification import NotificationType
from ..dependencies import get_current_user

router = APIRouter(prefix="/ebr", tags=["Executed Batch Records"])


def generate_ebr_number(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(EBR).filter(EBR.ebr_number.like(f"EBR-{year}-%")).count()
    return f"EBR-{year}-{(count + 1):04d}"


def check_in_range(actual: str, min_val: Optional[str], max_val: Optional[str]) -> Optional[bool]:
    """Compute whether actual value is within min/max bounds (numeric check)."""
    if not actual:
        return None
    try:
        v = float(actual.strip())
        if min_val and v < float(min_val.strip()):
            return False
        if max_val and v > float(max_val.strip()):
            return False
        return True
    except (ValueError, TypeError):
        return None


def _apply_step_data(step: EBRStep, payload: SaveStepPayload, current_user: User, db: Session):
    """Apply parameter results and IPQC results to a step."""
    now = datetime.utcnow()

    if payload.actual_yield is not None:
        step.actual_yield = payload.actual_yield
    if payload.execution_notes is not None:
        step.execution_notes = payload.execution_notes

    # Update parameter results
    param_map = {str(p.id): p for p in step.parameter_results}
    for p_payload in payload.parameters:
        param = param_map.get(str(p_payload.id))
        if param and p_payload.actual_value is not None:
            param.actual_value = p_payload.actual_value
            param.is_in_range = check_in_range(p_payload.actual_value, param.min_value, param.max_value)
            param.recorded_by_id = current_user.id
            param.recorded_at = now
            if p_payload.notes is not None:
                param.notes = p_payload.notes

    # Update IPQC results
    ipqc_map = {str(i.id): i for i in step.ipqc_results}
    for i_payload in payload.ipqcs:
        ipqc = ipqc_map.get(str(i_payload.id))
        if ipqc:
            if i_payload.actual_result is not None:
                ipqc.actual_result = i_payload.actual_result
            if i_payload.passed is not None:
                ipqc.passed = i_payload.passed
            ipqc.performed_by_id = current_user.id
            ipqc.performed_at = now
            if i_payload.notes is not None:
                ipqc.notes = i_payload.notes


# ── List / Create ────────────────────────────────────────────────────────────

@router.get("", response_model=EBRList)
async def list_ebr(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[EBRStatus] = None,
    product_code: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __ = Depends(require_permission("ebr:read")),
):
    q = db.query(EBR)
    if search:
        q = q.filter(
            EBR.ebr_number.ilike(f"%{search}%") |
            EBR.batch_number.ilike(f"%{search}%") |
            EBR.product_name.ilike(f"%{search}%")
        )
    if status:
        q = q.filter(EBR.status == status)
    if product_code:
        q = q.filter(EBR.product_code.ilike(f"%{product_code}%"))
    q = q.order_by(EBR.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * size).limit(size).all()
    return EBRList(items=items, total=total, page=page, size=size)


@router.post("", response_model=EBROut, status_code=status.HTTP_201_CREATED)
async def create_ebr(
    payload: EBRCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("ebr:create")),
):
    mbr = db.query(MBR).filter(MBR.id == payload.mbr_id).first()
    if not mbr:
        raise HTTPException(status_code=404, detail="MBR not found")
    if mbr.status not in {MBRStatus.APPROVED, MBRStatus.EFFECTIVE}:
        raise HTTPException(status_code=400, detail="Can only execute APPROVED or EFFECTIVE MBRs")
    if db.query(EBR).filter(EBR.batch_number == payload.batch_number).first():
        raise HTTPException(status_code=400, detail="Batch number already exists")

    ebr = EBR(
        ebr_number=generate_ebr_number(db),
        batch_number=payload.batch_number,
        mbr_id=mbr.id,
        mbr_number=mbr.mbr_number,
        mbr_version=mbr.version,
        product_name=mbr.product_name,
        product_code=mbr.product_code,
        strength=mbr.strength,
        dosage_form=mbr.dosage_form,
        planned_batch_size=payload.planned_batch_size or mbr.batch_size,
        batch_unit=payload.batch_unit or mbr.batch_unit,
        notes=payload.notes,
        initiated_by_id=current_user.id,
        status=EBRStatus.INITIATED,
    )
    db.add(ebr)
    db.flush()

    # Copy steps + parameters + IPQCs from MBR
    for s in mbr.steps:
        step = EBRStep(
            ebr_id=ebr.id,
            mbr_step_id=str(s.id),
            step_number=s.step_number,
            title=s.title,
            description=s.description,
            is_critical=s.is_critical,
            expected_duration_minutes=s.expected_duration_minutes,
            expected_yield=s.expected_yield,
            yield_unit=s.yield_unit,
            notes_template=s.notes,
            order=s.order,
        )
        db.add(step)
        db.flush()
        for p in s.parameters:
            db.add(EBRParameterResult(
                step_id=step.id,
                parameter_name=p.name,
                unit=p.unit,
                target_value=p.target_value,
                min_value=p.min_value,
                max_value=p.max_value,
                is_critical=p.is_critical,
            ))
        for ipqc in s.ipqcs:
            db.add(EBRIPQCResult(
                step_id=step.id,
                test_name=ipqc.test_name,
                method=ipqc.method,
                acceptance_criteria=ipqc.acceptance_criteria,
                frequency=ipqc.frequency,
                responsible_role=ipqc.responsible_role,
            ))

    # Copy materials from MBR
    for i, m in enumerate(mbr.materials):
        db.add(EBRMaterialDispensing(
            ebr_id=ebr.id,
            material_name=m.material_name,
            material_code=m.material_code,
            required_quantity=m.quantity,
            unit=m.unit,
            grade=m.grade,
            is_active_ingredient=m.is_active_ingredient,
            order=i,
        ))

    db.commit()
    db.refresh(ebr)
    log_event(db, AuditAction.CREATE, user=current_user, resource_type="ebr",
              resource_id=ebr.id,
              description=f"Created EBR {ebr.ebr_number} batch {ebr.batch_number} from {mbr.mbr_number}",
              request=request)
    return ebr


@router.get("/{ebr_id}", response_model=EBROut)
async def get_ebr(
    ebr_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __ = Depends(require_permission("ebr:read")),
):
    ebr = db.query(EBR).filter(EBR.id == ebr_id).first()
    if not ebr:
        raise HTTPException(status_code=404, detail="EBR not found")
    return ebr


@router.delete("/{ebr_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ebr(
    ebr_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("ebr:create")),
):
    ebr = db.query(EBR).filter(EBR.id == ebr_id).first()
    if not ebr:
        raise HTTPException(status_code=404, detail="EBR not found")
    if ebr.status != EBRStatus.INITIATED:
        raise HTTPException(status_code=400, detail="Only INITIATED batch records can be deleted")
    log_event(db, AuditAction.DELETE, user=current_user, resource_type="ebr",
              resource_id=ebr_id, description=f"Deleted EBR {ebr.ebr_number}", request=request)
    db.delete(ebr)
    db.commit()


# ── Step Execution ───────────────────────────────────────────────────────────

@router.post("/{ebr_id}/steps/{step_id}/start")
async def start_step(
    ebr_id: UUID, step_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("ebr:execute")),
):
    ebr = db.query(EBR).filter(EBR.id == ebr_id).first()
    if not ebr:
        raise HTTPException(status_code=404, detail="EBR not found")
    if ebr.status not in {EBRStatus.INITIATED, EBRStatus.IN_PROGRESS}:
        raise HTTPException(status_code=400, detail="Batch is not in an executable state")

    step = db.query(EBRStep).filter(EBRStep.id == step_id, EBRStep.ebr_id == ebr_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    if step.status != EBRStepStatus.PENDING:
        raise HTTPException(status_code=400, detail="Step is already started or completed")

    now = datetime.utcnow()
    step.status = EBRStepStatus.IN_PROGRESS
    step.started_at = now

    # Update EBR status on first step start
    if ebr.status == EBRStatus.INITIATED:
        ebr.status = EBRStatus.IN_PROGRESS
        ebr.started_at = now

    db.commit()
    log_event(db, AuditAction.UPDATE, user=current_user, resource_type="ebr_step",
              resource_id=step_id,
              description=f"Started step {step.step_number} '{step.title}' on batch {ebr.batch_number}",
              request=request)
    return {"message": f"Step {step.step_number} started", "started_at": now}


@router.put("/{ebr_id}/steps/{step_id}/save", response_model=dict)
async def save_step_progress(
    ebr_id: UUID, step_id: UUID,
    payload: SaveStepPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("ebr:execute")),
):
    """Save step data without completing it (intermediate save)."""
    step = db.query(EBRStep).filter(EBRStep.id == step_id, EBRStep.ebr_id == ebr_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    if step.status != EBRStepStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Step must be IN_PROGRESS to save")

    _apply_step_data(step, payload, current_user, db)
    db.commit()
    return {"message": "Step progress saved"}


@router.post("/{ebr_id}/steps/{step_id}/complete", response_model=dict)
async def complete_step(
    ebr_id: UUID, step_id: UUID,
    payload: CompleteStepPayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("ebr:execute")),
):
    ebr = db.query(EBR).filter(EBR.id == ebr_id).first()
    if not ebr:
        raise HTTPException(status_code=404, detail="EBR not found")
    step = db.query(EBRStep).filter(EBRStep.id == step_id, EBRStep.ebr_id == ebr_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    if step.status != EBRStepStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Step must be IN_PROGRESS to complete")

    now = datetime.utcnow()
    _apply_step_data(step, payload, current_user, db)

    step.status = EBRStepStatus.COMPLETED
    step.completed_at = now
    step.operator_id = current_user.id
    step.operator_signed_at = now

    # Check if all steps completed → auto-complete EBR
    db.flush()
    all_done = all(s.status == EBRStepStatus.COMPLETED for s in ebr.steps)
    if all_done:
        ebr.status = EBRStatus.COMPLETED
        ebr.completed_at = now

    db.commit()
    log_event(db, AuditAction.SIGN, user=current_user, resource_type="ebr_step",
              resource_id=step_id,
              description=f"Completed & signed step {step.step_number} '{step.title}' on batch {ebr.batch_number}",
              request=request)
    out_of_range = [p.parameter_name for p in step.parameter_results if p.is_in_range is False]
    failed_ipqcs = [i.test_name for i in step.ipqc_results if i.passed is False]
    return {
        "message": "Step completed and signed off",
        "all_steps_done": all_done,
        "out_of_range_params": out_of_range,
        "failed_ipqcs": failed_ipqcs,
    }


# ── Material Dispensing ──────────────────────────────────────────────────────

@router.put("/{ebr_id}/materials/{material_id}", response_model=dict)
async def dispense_material(
    ebr_id: UUID, material_id: UUID,
    payload: DispenseMaterialPayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("ebr:execute")),
):
    material = db.query(EBRMaterialDispensing).filter(
        EBRMaterialDispensing.id == material_id,
        EBRMaterialDispensing.ebr_id == ebr_id
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    material.actual_quantity = payload.actual_quantity
    material.lot_number = payload.lot_number
    material.expiry_date = payload.expiry_date
    material.notes = payload.notes
    material.dispensed_by_id = current_user.id
    material.dispensed_at = datetime.utcnow()
    material.is_dispensed = True

    db.commit()
    log_event(db, AuditAction.UPDATE, user=current_user, resource_type="ebr_material",
              resource_id=material_id,
              description=f"Dispensed {material.material_name} lot {payload.lot_number} for EBR",
              request=request)
    return {"message": f"{material.material_name} dispensed — lot {payload.lot_number}"}


# ── Finalize + Workflow ──────────────────────────────────────────────────────

@router.post("/{ebr_id}/finalize")
async def finalize_ebr(
    ebr_id: UUID,
    payload: FinalizePayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("ebr:execute")),
):
    ebr = db.query(EBR).filter(EBR.id == ebr_id).first()
    if not ebr:
        raise HTTPException(status_code=404, detail="EBR not found")

    incomplete = [s for s in ebr.steps if s.status != EBRStepStatus.COMPLETED]
    if incomplete:
        raise HTTPException(
            status_code=400,
            detail=f"{len(incomplete)} step(s) not yet completed: {', '.join(s.title for s in incomplete)}"
        )

    if payload.actual_yield is not None:
        ebr.actual_yield = payload.actual_yield
        ebr.actual_yield_unit = payload.actual_yield_unit
        if ebr.planned_batch_size and ebr.planned_batch_size > 0:
            ebr.yield_percentage = round((payload.actual_yield / ebr.planned_batch_size) * 100, 2)
    if payload.notes:
        ebr.notes = payload.notes

    ebr.status = EBRStatus.COMPLETED
    ebr.completed_at = datetime.utcnow()
    db.commit()
    log_event(db, AuditAction.UPDATE, user=current_user, resource_type="ebr",
              resource_id=ebr_id,
              description=f"Finalized batch {ebr.batch_number}. Yield: {payload.actual_yield} {payload.actual_yield_unit or ''}",
              request=request)
    return {"message": "Batch finalized", "status": EBRStatus.COMPLETED, "yield_percentage": ebr.yield_percentage}


@router.post("/{ebr_id}/submit")
async def submit_for_review(
    ebr_id: UUID, payload: WorkflowAction,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("ebr:execute")),
):
    ebr = db.query(EBR).filter(EBR.id == ebr_id).first()
    if not ebr:
        raise HTTPException(status_code=404, detail="EBR not found")
    if ebr.status != EBRStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Only COMPLETED batches can be submitted for review")
    ebr.status = EBRStatus.UNDER_REVIEW
    notify_permission(
        db, "ebr:approve", NotificationType.EBR_SUBMITTED,
        title=f"Batch {ebr.batch_number} submitted for QA review",
        message=f"{current_user.full_name} submitted batch {ebr.batch_number} "
                f"({ebr.product_name}) for QA review.",
        resource_type="ebr", resource_id=str(ebr_id),
        exclude_user_id=current_user.id,
    )
    db.commit()
    log_event(db, AuditAction.UPDATE, user=current_user, resource_type="ebr",
              resource_id=ebr_id,
              description=f"Submitted batch {ebr.batch_number} for QA review. {payload.comments or ''}",
              request=request)
    return {"message": "Submitted for QA review", "status": EBRStatus.UNDER_REVIEW}


@router.post("/{ebr_id}/approve")
async def approve_ebr(
    ebr_id: UUID, payload: WorkflowAction,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("ebr:approve")),
):
    ebr = db.query(EBR).filter(EBR.id == ebr_id).first()
    if not ebr:
        raise HTTPException(status_code=404, detail="EBR not found")
    if ebr.status != EBRStatus.UNDER_REVIEW:
        raise HTTPException(status_code=400, detail="EBR is not under review")
    ebr.status = EBRStatus.APPROVED
    ebr.approved_by_id = current_user.id
    ebr.approved_at = datetime.utcnow()
    if ebr.initiated_by_id:
        notify_user(
            db, ebr.initiated_by_id, NotificationType.EBR_APPROVED,
            title=f"Batch {ebr.batch_number} released",
            message=f"{current_user.full_name} released batch {ebr.batch_number} "
                    f"({ebr.product_name}) for distribution.",
            resource_type="ebr", resource_id=str(ebr_id),
        )
    db.commit()
    log_event(db, AuditAction.APPROVE, user=current_user, resource_type="ebr",
              resource_id=ebr_id,
              description=f"Released batch {ebr.batch_number}. {payload.comments or ''}",
              request=request)
    return {"message": "Batch approved and released", "status": EBRStatus.APPROVED}


@router.post("/{ebr_id}/reject")
async def reject_ebr(
    ebr_id: UUID, payload: WorkflowAction,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("ebr:approve")),
):
    ebr = db.query(EBR).filter(EBR.id == ebr_id).first()
    if not ebr:
        raise HTTPException(status_code=404, detail="EBR not found")
    if ebr.status != EBRStatus.UNDER_REVIEW:
        raise HTTPException(status_code=400, detail="EBR is not under review")
    ebr.status = EBRStatus.REJECTED
    if ebr.initiated_by_id:
        notify_user(
            db, ebr.initiated_by_id, NotificationType.EBR_REJECTED,
            title=f"Batch {ebr.batch_number} rejected",
            message=f"{current_user.full_name} rejected batch {ebr.batch_number} "
                    f"({ebr.product_name}). {payload.comments or ''}",
            resource_type="ebr", resource_id=str(ebr_id),
        )
    db.commit()
    log_event(db, AuditAction.REJECT, user=current_user, resource_type="ebr",
              resource_id=ebr_id,
              description=f"Rejected batch {ebr.batch_number}. {payload.comments or ''}",
              request=request)
    return {"message": "Batch rejected", "status": EBRStatus.REJECTED}
