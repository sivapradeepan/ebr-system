from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models.schedule import BatchSchedule, ScheduleStatus
from ..models.mbr import MBR, MBRStatus
from ..models.ebr import EBR, EBRStatus, EBRStep, EBRParameterResult, EBRIPQCResult, EBRMaterialDispensing
from ..models.user import User
from ..models.audit import AuditAction
from ..schemas.schedule import (
    ScheduleCreate, ScheduleUpdate, ScheduleOut, ScheduleList, ConvertPayload,
)
from ..core.audit_logger import log_event
from ..core.rbac import require_permission
from ..core.notifier import notify_permission
from ..models.notification import NotificationType

router = APIRouter(prefix="/schedule", tags=["Production Schedule"])


def _gen_number(db: Session) -> str:
    year = datetime.utcnow().year
    from sqlalchemy import func
    count = db.query(func.count(BatchSchedule.id)).scalar() + 1
    return f"SCHED-{year}-{count:04d}"


# ── List / Create ─────────────────────────────────────────────────────────────

@router.get("", response_model=ScheduleList)
def list_schedules(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status_filter: Optional[ScheduleStatus] = Query(None, alias="status"),
    product_code: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(BatchSchedule)
    if status_filter:
        q = q.filter(BatchSchedule.status == status_filter)
    if product_code:
        q = q.filter(BatchSchedule.product_code.ilike(f"%{product_code}%"))
    if search:
        q = q.filter(
            BatchSchedule.schedule_number.ilike(f"%{search}%") |
            BatchSchedule.product_name.ilike(f"%{search}%") |
            BatchSchedule.mbr_number.ilike(f"%{search}%")
        )
    total = q.count()
    items = q.order_by(BatchSchedule.scheduled_start.asc()).offset((page - 1) * size).limit(size).all()
    return ScheduleList(items=items, total=total, page=page, size=size)


@router.get("/calendar")
def calendar_entries(
    start: datetime = Query(..., description="Range start (ISO 8601)"),
    end: datetime   = Query(..., description="Range end (ISO 8601)"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return all schedule entries that overlap the given date range."""
    entries = (
        db.query(BatchSchedule)
        .filter(
            BatchSchedule.scheduled_start < end,
            BatchSchedule.scheduled_end   > start,
            BatchSchedule.status != ScheduleStatus.CANCELLED,
        )
        .order_by(BatchSchedule.scheduled_start)
        .all()
    )
    return [
        {
            "id":             str(e.id),
            "schedule_number": e.schedule_number,
            "product_name":   e.product_name,
            "product_code":   e.product_code,
            "mbr_number":     e.mbr_number,
            "status":         e.status.value,
            "priority":       e.priority.value,
            "scheduled_start": e.scheduled_start.isoformat(),
            "scheduled_end":   e.scheduled_end.isoformat(),
            "equipment_line": e.equipment_line,
            "ebr_id":         str(e.ebr_id) if e.ebr_id else None,
            "assigned_operator": e.assigned_operator.full_name if e.assigned_operator else None,
            "planned_batch_size": e.planned_batch_size,
            "batch_unit":     e.batch_unit,
        }
        for e in entries
    ]


@router.post("", response_model=ScheduleOut, status_code=status.HTTP_201_CREATED)
def create_schedule(
    payload: ScheduleCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("ebr:create")),
):
    mbr = db.query(MBR).filter(MBR.id == payload.mbr_id).first()
    if not mbr:
        raise HTTPException(status_code=404, detail="MBR not found")
    if mbr.status not in {MBRStatus.APPROVED, MBRStatus.EFFECTIVE}:
        raise HTTPException(status_code=400, detail="Can only schedule APPROVED or EFFECTIVE MBRs")

    entry = BatchSchedule(
        schedule_number=_gen_number(db),
        mbr_id=mbr.id,
        mbr_number=mbr.mbr_number,
        mbr_version=mbr.version,
        product_name=mbr.product_name,
        product_code=mbr.product_code,
        planned_batch_size=payload.planned_batch_size or mbr.batch_size,
        batch_unit=payload.batch_unit or mbr.batch_unit,
        scheduled_start=payload.scheduled_start,
        scheduled_end=payload.scheduled_end,
        assigned_operator_id=payload.assigned_operator_id,
        equipment_line=payload.equipment_line,
        priority=payload.priority,
        notes=payload.notes,
        created_by_id=current_user.id,
    )
    db.add(entry)
    db.flush()
    log_event(db, AuditAction.CREATE, user=current_user, resource_type="schedule",
              resource_id=entry.id,
              description=f"Scheduled batch for {entry.product_name} ({entry.schedule_number}): "
                          f"{entry.scheduled_start.strftime('%Y-%m-%d')}",
              request=request)
    notify_permission(
        db, "ebr:read", NotificationType.SYSTEM,
        title=f"Batch scheduled: {entry.product_name}",
        message=f"{current_user.full_name} scheduled {entry.product_name} "
                f"({entry.schedule_number}) for "
                f"{entry.scheduled_start.strftime('%Y-%m-%d %H:%M')}.",
        resource_type="schedule", resource_id=str(entry.id),
        exclude_user_id=current_user.id,
    )
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{schedule_id}", response_model=ScheduleOut)
def get_schedule(
    schedule_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    e = db.query(BatchSchedule).filter(BatchSchedule.id == schedule_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    return e


@router.put("/{schedule_id}", response_model=ScheduleOut)
def update_schedule(
    schedule_id: UUID,
    payload: ScheduleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("ebr:create")),
):
    e = db.query(BatchSchedule).filter(BatchSchedule.id == schedule_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    if e.status in {ScheduleStatus.COMPLETED, ScheduleStatus.CANCELLED}:
        raise HTTPException(status_code=400, detail=f"Cannot edit a {e.status.value} schedule")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(e, k, v)

    log_event(db, AuditAction.UPDATE, user=current_user, resource_type="schedule",
              resource_id=schedule_id,
              description=f"Updated schedule {e.schedule_number}", request=request)
    db.commit()
    db.refresh(e)
    return e


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(
    schedule_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("ebr:create")),
):
    e = db.query(BatchSchedule).filter(BatchSchedule.id == schedule_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    if e.status not in {ScheduleStatus.PLANNED, ScheduleStatus.CANCELLED}:
        raise HTTPException(status_code=400, detail="Only PLANNED or CANCELLED entries can be deleted")
    log_event(db, AuditAction.DELETE, user=current_user, resource_type="schedule",
              resource_id=schedule_id,
              description=f"Deleted schedule {e.schedule_number}", request=request)
    db.delete(e)
    db.commit()


# ── Status transitions ────────────────────────────────────────────────────────

@router.post("/{schedule_id}/confirm", response_model=ScheduleOut)
def confirm_schedule(
    schedule_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("ebr:create")),
):
    e = db.query(BatchSchedule).filter(BatchSchedule.id == schedule_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    if e.status != ScheduleStatus.PLANNED:
        raise HTTPException(status_code=400, detail="Only PLANNED entries can be confirmed")
    e.status = ScheduleStatus.CONFIRMED
    log_event(db, AuditAction.UPDATE, user=current_user, resource_type="schedule",
              resource_id=schedule_id,
              description=f"Confirmed schedule {e.schedule_number}", request=request)
    db.commit()
    db.refresh(e)
    return e


@router.post("/{schedule_id}/cancel", response_model=ScheduleOut)
def cancel_schedule(
    schedule_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("ebr:create")),
):
    e = db.query(BatchSchedule).filter(BatchSchedule.id == schedule_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    if e.status in {ScheduleStatus.COMPLETED, ScheduleStatus.CANCELLED}:
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {e.status.value} schedule")
    e.status = ScheduleStatus.CANCELLED
    log_event(db, AuditAction.UPDATE, user=current_user, resource_type="schedule",
              resource_id=schedule_id,
              description=f"Cancelled schedule {e.schedule_number}", request=request)
    db.commit()
    db.refresh(e)
    return e


# ── Convert to EBR ────────────────────────────────────────────────────────────

@router.post("/{schedule_id}/convert", response_model=ScheduleOut)
def convert_to_ebr(
    schedule_id: UUID,
    payload: ConvertPayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("ebr:create")),
):
    """Convert a scheduled batch entry into a live EBR (initiates execution)."""
    e = db.query(BatchSchedule).filter(BatchSchedule.id == schedule_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    if e.status == ScheduleStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot convert a cancelled schedule")
    if e.ebr_id:
        raise HTTPException(status_code=400, detail="Schedule already converted to an EBR")
    if db.query(EBR).filter(EBR.batch_number == payload.batch_number).first():
        raise HTTPException(status_code=400, detail="Batch number already exists")

    mbr = db.query(MBR).filter(MBR.id == e.mbr_id).first()
    if not mbr:
        raise HTTPException(status_code=404, detail="MBR no longer exists")

    # Generate EBR number
    from ..routers.ebr import generate_ebr_number
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
        planned_batch_size=payload.planned_batch_size or e.planned_batch_size or mbr.batch_size,
        batch_unit=payload.batch_unit or e.batch_unit or mbr.batch_unit,
        notes=payload.notes or e.notes,
        initiated_by_id=current_user.id,
        status=EBRStatus.INITIATED,
    )
    db.add(ebr)
    db.flush()

    # Copy steps + parameters + IPQCs + materials from MBR (same logic as ebr router)
    for s in mbr.steps:
        step = EBRStep(
            ebr_id=ebr.id, mbr_step_id=str(s.id),
            step_number=s.step_number, title=s.title,
            description=s.description, is_critical=s.is_critical,
            expected_duration_minutes=s.expected_duration_minutes,
            expected_yield=s.expected_yield, yield_unit=s.yield_unit,
            notes_template=s.notes, order=s.order,
        )
        db.add(step)
        db.flush()
        for p in s.parameters:
            db.add(EBRParameterResult(
                step_id=step.id, parameter_name=p.name, unit=p.unit,
                target_value=p.target_value, min_value=p.min_value,
                max_value=p.max_value, is_critical=p.is_critical,
            ))
        for ipqc in s.ipqcs:
            db.add(EBRIPQCResult(
                step_id=step.id, test_name=ipqc.test_name, method=ipqc.method,
                acceptance_criteria=ipqc.acceptance_criteria,
                frequency=ipqc.frequency, responsible_role=ipqc.responsible_role,
            ))
    for i, m in enumerate(mbr.materials):
        db.add(EBRMaterialDispensing(
            ebr_id=ebr.id, material_name=m.material_name, material_code=m.material_code,
            required_quantity=m.quantity, unit=m.unit, grade=m.grade,
            is_active_ingredient=m.is_active_ingredient, order=i,
        ))

    # Link schedule → EBR and mark IN_PROGRESS
    e.ebr_id = ebr.id
    e.converted_at = datetime.utcnow()
    e.converted_by_id = current_user.id
    e.status = ScheduleStatus.IN_PROGRESS

    log_event(db, AuditAction.CREATE, user=current_user, resource_type="ebr",
              resource_id=ebr.id,
              description=f"Created EBR {ebr.ebr_number} from schedule {e.schedule_number}",
              request=request)
    log_event(db, AuditAction.UPDATE, user=current_user, resource_type="schedule",
              resource_id=schedule_id,
              description=f"Schedule {e.schedule_number} converted to EBR {ebr.ebr_number}",
              request=request)
    db.commit()
    db.refresh(e)
    return e
