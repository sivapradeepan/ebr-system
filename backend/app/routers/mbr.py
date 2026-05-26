from typing import Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.mbr import MBR, MBRMaterial, MBREquipment, MBRStep, MBRStepParameter, MBRStepIPQC, MBRStatus
from ..models.user import User
from ..models.audit import AuditAction
from ..schemas.mbr import MBRCreate, MBRUpdate, MBROut, MBRList, MBRSummary, WorkflowAction
from ..core.audit_logger import log_event
from ..core.rbac import require_permission
from ..dependencies import get_current_user

router = APIRouter(prefix="/mbr", tags=["Master Batch Records"])

EDITABLE_STATUSES = {MBRStatus.DRAFT}


def generate_mbr_number(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(MBR).filter(MBR.mbr_number.like(f"MBR-{year}-%")).count()
    return f"MBR-{year}-{(count + 1):04d}"


def _build_nested(db: Session, mbr: MBR, payload: MBRCreate):
    """Replace all nested children of an MBR from payload."""
    # Materials
    for item in mbr.materials:
        db.delete(item)
    for i, m in enumerate(payload.materials):
        db.add(MBRMaterial(mbr_id=mbr.id, order=i, **m.model_dump()))

    # Equipment
    for item in mbr.equipment:
        db.delete(item)
    for i, e in enumerate(payload.equipment):
        db.add(MBREquipment(mbr_id=mbr.id, order=i, **e.model_dump(exclude={"notes"}, exclude_none=False)))

    # Steps
    for item in mbr.steps:
        db.delete(item)
    db.flush()
    for i, s in enumerate(payload.steps):
        step = MBRStep(
            mbr_id=mbr.id,
            order=i,
            step_number=s.step_number,
            title=s.title,
            description=s.description,
            expected_duration_minutes=s.expected_duration_minutes,
            expected_yield=s.expected_yield,
            yield_unit=s.yield_unit,
            is_critical=s.is_critical,
            notes=s.notes,
        )
        db.add(step)
        db.flush()
        for param in s.parameters:
            db.add(MBRStepParameter(step_id=step.id, **param.model_dump()))
        for ipqc in s.ipqcs:
            db.add(MBRStepIPQC(step_id=step.id, **ipqc.model_dump()))


def _build_equipment(mbr_id, order: int, e):
    return MBREquipment(
        mbr_id=mbr_id, order=order,
        equipment_name=e.equipment_name,
        equipment_code=e.equipment_code,
        capacity=e.capacity,
        notes=e.notes,
    )


@router.get("", response_model=MBRList)
async def list_mbr(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[MBRStatus] = None,
    product_code: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __ = Depends(require_permission("mbr:read")),
):
    q = db.query(MBR)
    if search:
        q = q.filter(
            MBR.title.ilike(f"%{search}%") |
            MBR.product_name.ilike(f"%{search}%") |
            MBR.mbr_number.ilike(f"%{search}%")
        )
    if status:
        q = q.filter(MBR.status == status)
    if product_code:
        q = q.filter(MBR.product_code.ilike(f"%{product_code}%"))
    q = q.order_by(MBR.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * size).limit(size).all()
    return MBRList(items=items, total=total, page=page, size=size)


@router.post("", response_model=MBROut, status_code=status.HTTP_201_CREATED)
async def create_mbr(
    payload: MBRCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("mbr:create")),
):
    mbr = MBR(
        mbr_number=generate_mbr_number(db),
        version="1.0",
        status=MBRStatus.DRAFT,
        created_by_id=current_user.id,
        title=payload.title,
        product_name=payload.product_name,
        product_code=payload.product_code,
        dosage_form=payload.dosage_form,
        strength=payload.strength,
        batch_size=payload.batch_size,
        batch_unit=payload.batch_unit,
        theoretical_yield=payload.theoretical_yield,
        yield_unit=payload.yield_unit,
        description=payload.description,
        storage_conditions=payload.storage_conditions,
        manufacturing_site=payload.manufacturing_site,
        notes=payload.notes,
    )
    db.add(mbr)
    db.flush()

    for i, m in enumerate(payload.materials):
        db.add(MBRMaterial(mbr_id=mbr.id, order=i, **m.model_dump()))
    for i, e in enumerate(payload.equipment):
        db.add(_build_equipment(mbr.id, i, e))
    for i, s in enumerate(payload.steps):
        step = MBRStep(
            mbr_id=mbr.id, order=i,
            step_number=s.step_number, title=s.title,
            description=s.description,
            expected_duration_minutes=s.expected_duration_minutes,
            expected_yield=s.expected_yield, yield_unit=s.yield_unit,
            is_critical=s.is_critical, notes=s.notes,
        )
        db.add(step)
        db.flush()
        for p in s.parameters:
            db.add(MBRStepParameter(step_id=step.id, **p.model_dump()))
        for ipqc in s.ipqcs:
            db.add(MBRStepIPQC(step_id=step.id, **ipqc.model_dump()))

    db.commit()
    db.refresh(mbr)
    log_event(db, AuditAction.CREATE, user=current_user, resource_type="mbr",
              resource_id=mbr.id, description=f"Created MBR {mbr.mbr_number} v{mbr.version}", request=request)
    return mbr


@router.get("/{mbr_id}", response_model=MBROut)
async def get_mbr(
    mbr_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __ = Depends(require_permission("mbr:read")),
):
    mbr = db.query(MBR).filter(MBR.id == mbr_id).first()
    if not mbr:
        raise HTTPException(status_code=404, detail="MBR not found")
    return mbr


@router.put("/{mbr_id}", response_model=MBROut)
async def update_mbr(
    mbr_id: UUID,
    payload: MBRUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("mbr:update")),
):
    mbr = db.query(MBR).filter(MBR.id == mbr_id).first()
    if not mbr:
        raise HTTPException(status_code=404, detail="MBR not found")
    if mbr.status not in EDITABLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Cannot edit MBR in '{mbr.status}' status")

    for field in ["title", "product_name", "product_code", "dosage_form", "strength",
                  "batch_size", "batch_unit", "theoretical_yield", "yield_unit",
                  "description", "storage_conditions", "manufacturing_site", "notes"]:
        val = getattr(payload, field, None)
        if val is not None:
            setattr(mbr, field, val)

    # Rebuild all nested items
    for item in list(mbr.materials) + list(mbr.equipment) + list(mbr.steps):
        db.delete(item)
    db.flush()

    for i, m in enumerate(payload.materials):
        db.add(MBRMaterial(mbr_id=mbr.id, order=i, **m.model_dump()))
    for i, e in enumerate(payload.equipment):
        db.add(_build_equipment(mbr.id, i, e))
    for i, s in enumerate(payload.steps):
        step = MBRStep(
            mbr_id=mbr.id, order=i,
            step_number=s.step_number, title=s.title,
            description=s.description,
            expected_duration_minutes=s.expected_duration_minutes,
            expected_yield=s.expected_yield, yield_unit=s.yield_unit,
            is_critical=s.is_critical, notes=s.notes,
        )
        db.add(step)
        db.flush()
        for p in s.parameters:
            db.add(MBRStepParameter(step_id=step.id, **p.model_dump()))
        for ipqc in s.ipqcs:
            db.add(MBRStepIPQC(step_id=step.id, **ipqc.model_dump()))

    db.commit()
    db.refresh(mbr)
    log_event(db, AuditAction.UPDATE, user=current_user, resource_type="mbr",
              resource_id=mbr_id, description=f"Updated MBR {mbr.mbr_number}", request=request)
    return mbr


@router.delete("/{mbr_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mbr(
    mbr_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("mbr:delete")),
):
    mbr = db.query(MBR).filter(MBR.id == mbr_id).first()
    if not mbr:
        raise HTTPException(status_code=404, detail="MBR not found")
    if mbr.status not in EDITABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Only DRAFT MBRs can be deleted")
    log_event(db, AuditAction.DELETE, user=current_user, resource_type="mbr",
              resource_id=mbr_id, description=f"Deleted MBR {mbr.mbr_number}", request=request)
    db.delete(mbr)
    db.commit()


@router.post("/{mbr_id}/submit")
async def submit_for_review(
    mbr_id: UUID,
    payload: WorkflowAction,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("mbr:update")),
):
    mbr = db.query(MBR).filter(MBR.id == mbr_id).first()
    if not mbr:
        raise HTTPException(status_code=404, detail="MBR not found")
    if mbr.status != MBRStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only DRAFT MBRs can be submitted for review")
    if not mbr.steps:
        raise HTTPException(status_code=400, detail="MBR must have at least one manufacturing step before submission")
    mbr.status = MBRStatus.UNDER_REVIEW
    db.commit()
    log_event(db, AuditAction.UPDATE, user=current_user, resource_type="mbr",
              resource_id=mbr_id,
              description=f"Submitted MBR {mbr.mbr_number} for review. {payload.comments or ''}",
              request=request)
    return {"message": "MBR submitted for review", "status": MBRStatus.UNDER_REVIEW}


@router.post("/{mbr_id}/approve")
async def approve_mbr(
    mbr_id: UUID,
    payload: WorkflowAction,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("mbr:approve")),
):
    mbr = db.query(MBR).filter(MBR.id == mbr_id).first()
    if not mbr:
        raise HTTPException(status_code=404, detail="MBR not found")
    if mbr.status != MBRStatus.UNDER_REVIEW:
        raise HTTPException(status_code=400, detail="Only MBRs under review can be approved")
    mbr.status = MBRStatus.APPROVED
    mbr.approved_by_id = current_user.id
    mbr.approved_at = datetime.utcnow()
    db.commit()
    log_event(db, AuditAction.APPROVE, user=current_user, resource_type="mbr",
              resource_id=mbr_id,
              description=f"Approved MBR {mbr.mbr_number} v{mbr.version}. {payload.comments or ''}",
              request=request)
    return {"message": "MBR approved", "status": MBRStatus.APPROVED}


@router.post("/{mbr_id}/reject")
async def reject_mbr(
    mbr_id: UUID,
    payload: WorkflowAction,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("mbr:approve")),
):
    mbr = db.query(MBR).filter(MBR.id == mbr_id).first()
    if not mbr:
        raise HTTPException(status_code=404, detail="MBR not found")
    if mbr.status != MBRStatus.UNDER_REVIEW:
        raise HTTPException(status_code=400, detail="Only MBRs under review can be rejected")
    mbr.status = MBRStatus.DRAFT
    db.commit()
    log_event(db, AuditAction.REJECT, user=current_user, resource_type="mbr",
              resource_id=mbr_id,
              description=f"Rejected MBR {mbr.mbr_number}. {payload.comments or ''}",
              request=request)
    return {"message": "MBR rejected and returned to draft", "status": MBRStatus.DRAFT}


@router.post("/{mbr_id}/new-version", response_model=MBROut, status_code=status.HTTP_201_CREATED)
async def create_new_version(
    mbr_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("mbr:create")),
):
    original = db.query(MBR).filter(MBR.id == mbr_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="MBR not found")
    if original.status not in {MBRStatus.APPROVED, MBRStatus.EFFECTIVE}:
        raise HTTPException(status_code=400, detail="Can only create new version from APPROVED or EFFECTIVE MBR")

    # Increment version
    major, minor = original.version.split(".")
    new_version = f"{major}.{int(minor) + 1}"

    new_mbr = MBR(
        mbr_number=generate_mbr_number(db),
        version=new_version,
        status=MBRStatus.DRAFT,
        parent_mbr_id=original.id,
        created_by_id=current_user.id,
        title=original.title,
        product_name=original.product_name,
        product_code=original.product_code,
        dosage_form=original.dosage_form,
        strength=original.strength,
        batch_size=original.batch_size,
        batch_unit=original.batch_unit,
        theoretical_yield=original.theoretical_yield,
        yield_unit=original.yield_unit,
        description=original.description,
        storage_conditions=original.storage_conditions,
        manufacturing_site=original.manufacturing_site,
        notes=f"New version based on {original.mbr_number} v{original.version}",
    )
    db.add(new_mbr)
    db.flush()

    # Copy materials, equipment, steps
    for m in original.materials:
        db.add(MBRMaterial(mbr_id=new_mbr.id, order=m.order, material_name=m.material_name,
                           material_code=m.material_code, quantity=m.quantity, unit=m.unit,
                           grade=m.grade, is_active_ingredient=m.is_active_ingredient,
                           supplier=m.supplier, notes=m.notes))
    for e in original.equipment:
        db.add(MBREquipment(mbr_id=new_mbr.id, order=e.order, equipment_name=e.equipment_name,
                            equipment_code=e.equipment_code, capacity=e.capacity, notes=e.notes))
    for s in original.steps:
        new_step = MBRStep(
            mbr_id=new_mbr.id, order=s.order, step_number=s.step_number,
            title=s.title, description=s.description,
            expected_duration_minutes=s.expected_duration_minutes,
            expected_yield=s.expected_yield, yield_unit=s.yield_unit,
            is_critical=s.is_critical, notes=s.notes,
        )
        db.add(new_step)
        db.flush()
        for p in s.parameters:
            db.add(MBRStepParameter(step_id=new_step.id, name=p.name, unit=p.unit,
                                    target_value=p.target_value, min_value=p.min_value,
                                    max_value=p.max_value, is_critical=p.is_critical, notes=p.notes))
        for ipqc in s.ipqcs:
            db.add(MBRStepIPQC(step_id=new_step.id, test_name=ipqc.test_name, method=ipqc.method,
                               acceptance_criteria=ipqc.acceptance_criteria, frequency=ipqc.frequency,
                               responsible_role=ipqc.responsible_role, notes=ipqc.notes))

    # Supersede original if it was EFFECTIVE
    if original.status == MBRStatus.EFFECTIVE:
        original.status = MBRStatus.SUPERSEDED

    db.commit()
    db.refresh(new_mbr)
    log_event(db, AuditAction.CREATE, user=current_user, resource_type="mbr",
              resource_id=new_mbr.id,
              description=f"Created new version {new_mbr.mbr_number} v{new_mbr.version} from {original.mbr_number}",
              request=request)
    return new_mbr
