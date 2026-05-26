from datetime import datetime, date, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from ..database import get_db
from ..dependencies import get_current_user
from ..models.training import TrainingRecord, TrainingType, TrainingStatus
from ..models.user import User
from ..models.audit import AuditAction
from ..schemas.training import (
    TrainingCreate, TrainingUpdate, TrainingOut, TrainingList,
    QualificationMatrix, MatrixRow, MatrixCell,
)
from ..core.audit_logger import log_event
from ..core.notifier import notify_user
from ..models.notification import NotificationType

router = APIRouter(prefix="/training", tags=["Training Records"])

TYPE_LABELS = {
    TrainingType.GMP_BASICS:  "GMP Basics",
    TrainingType.SOP:         "SOP Training",
    TrainingType.EQUIPMENT:   "Equipment",
    TrainingType.PROCESS:     "Process",
    TrainingType.SAFETY:      "Safety",
    TrainingType.REGULATORY:  "Regulatory",
    TrainingType.COMPUTER:    "Computer Systems",
    TrainingType.OTHER:       "Other",
}


def _gen_number(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(func.count(TrainingRecord.id)).scalar() + 1
    return f"TRN-{year}-{count:04d}"


def _compute_status(rec: TrainingRecord) -> TrainingStatus:
    if rec.passed is False:
        return TrainingStatus.PENDING
    if rec.expiry_date is None:
        return TrainingStatus.CURRENT
    today = date.today()
    if rec.expiry_date < today:
        return TrainingStatus.EXPIRED
    if (rec.expiry_date - today).days <= 30:
        return TrainingStatus.DUE_SOON
    return TrainingStatus.CURRENT


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=TrainingList)
def list_training(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    trainee_id: Optional[UUID] = None,
    training_type: Optional[TrainingType] = None,
    status_filter: Optional[TrainingStatus] = Query(None, alias="status"),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(TrainingRecord)
    if trainee_id:
        q = q.filter(TrainingRecord.trainee_id == trainee_id)
    if training_type:
        q = q.filter(TrainingRecord.training_type == training_type)
    if search:
        q = q.filter(
            TrainingRecord.title.ilike(f"%{search}%") |
            TrainingRecord.reference_doc.ilike(f"%{search}%") |
            TrainingRecord.record_number.ilike(f"%{search}%")
        )
    total_unfiltered = q.count()
    all_recs = q.order_by(TrainingRecord.training_date.desc()).all()

    # Apply computed status filter in Python (status is a property, not a DB column)
    if status_filter:
        all_recs = [r for r in all_recs if _compute_status(r) == status_filter]

    total = len(all_recs)
    items = all_recs[(page - 1) * size: page * size]
    return TrainingList(items=items, total=total, page=page, size=size)


@router.get("/my", response_model=TrainingList)
def my_training(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(TrainingRecord).filter(TrainingRecord.trainee_id == current_user.id)
    total = q.count()
    items = q.order_by(TrainingRecord.training_date.desc()).offset((page - 1) * size).limit(size).all()
    return TrainingList(items=items, total=total, page=page, size=size)


@router.get("/due-soon")
def due_soon_summary(
    days: int = Query(30, ge=1, le=90),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Records expiring within `days` days — for dashboard alerts."""
    threshold = date.today() + timedelta(days=days)
    recs = (
        db.query(TrainingRecord)
        .filter(
            TrainingRecord.expiry_date.isnot(None),
            TrainingRecord.expiry_date <= threshold,
            TrainingRecord.expiry_date >= date.today(),
        )
        .order_by(TrainingRecord.expiry_date.asc())
        .all()
    )
    expired = (
        db.query(TrainingRecord)
        .filter(
            TrainingRecord.expiry_date.isnot(None),
            TrainingRecord.expiry_date < date.today(),
        )
        .count()
    )
    return {
        "due_soon": [
            {
                "record_number": r.record_number,
                "title": r.title,
                "trainee": r.trainee.full_name,
                "expiry_date": r.expiry_date.isoformat(),
                "days_remaining": (r.expiry_date - date.today()).days,
            }
            for r in recs
        ],
        "expired_count": expired,
        "due_soon_count": len(recs),
    }


@router.get("/matrix", response_model=QualificationMatrix)
def qualification_matrix(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Returns a training type × operator matrix showing qualification status.
    Only includes active users who have at least one training record.
    """
    # All active users who have any training record
    trained_user_ids = (
        db.query(TrainingRecord.trainee_id)
        .distinct()
        .subquery()
    )
    operators = (
        db.query(User)
        .filter(User.id.in_(trained_user_ids), User.is_active.is_(True))
        .order_by(User.full_name)
        .all()
    )

    # All training records
    all_recs = db.query(TrainingRecord).all()

    # Build lookup: (trainee_id, training_type) → best (most current) record
    lookup: dict[tuple, TrainingRecord] = {}
    for rec in all_recs:
        key = (str(rec.trainee_id), rec.training_type)
        existing = lookup.get(key)
        if existing is None:
            lookup[key] = rec
        else:
            # Keep the one with the later training_date
            if rec.training_date > existing.training_date:
                lookup[key] = rec

    rows: list[MatrixRow] = []
    for ttype in TrainingType:
        cells: dict[str, MatrixCell] = {}
        for op in operators:
            rec = lookup.get((str(op.id), ttype))
            if rec is None:
                cells[str(op.id)] = MatrixCell()
            else:
                cells[str(op.id)] = MatrixCell(
                    record_id=rec.id,
                    status=_compute_status(rec),
                    title=rec.title,
                    training_date=rec.training_date,
                    expiry_date=rec.expiry_date,
                )
        # Only include this row if at least one operator has a record for this type
        if any(c.status is not None for c in cells.values()):
            rows.append(MatrixRow(
                training_type=ttype,
                label=TYPE_LABELS[ttype],
                operators=cells,
            ))

    # Per-operator summary
    summary: dict[str, dict] = {}
    for op in operators:
        op_recs = [r for r in all_recs if str(r.trainee_id) == str(op.id)]
        statuses = [_compute_status(r) for r in op_recs]
        summary[str(op.id)] = {
            "current":  statuses.count(TrainingStatus.CURRENT),
            "due_soon": statuses.count(TrainingStatus.DUE_SOON),
            "expired":  statuses.count(TrainingStatus.EXPIRED),
            "pending":  statuses.count(TrainingStatus.PENDING),
            "total":    len(statuses),
        }

    return QualificationMatrix(operators=operators, rows=rows, summary=summary)


@router.post("", response_model=TrainingOut, status_code=status.HTTP_201_CREATED)
def create_training(
    payload: TrainingCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trainee = db.query(User).filter(User.id == payload.trainee_id).first()
    if not trainee:
        raise HTTPException(status_code=404, detail="Trainee not found")

    rec = TrainingRecord(
        **payload.model_dump(),
        record_number=_gen_number(db),
        created_by_id=current_user.id,
    )
    db.add(rec)
    db.flush()

    log_event(db, AuditAction.CREATE, user=current_user, resource_type="training",
              resource_id=rec.id,
              description=f"Recorded training {rec.record_number}: '{rec.title}' for {trainee.full_name}",
              request=request)

    # Notify trainee
    if str(payload.trainee_id) != str(current_user.id):
        notify_user(
            db, payload.trainee_id, NotificationType.SYSTEM,
            title="New training record added",
            message=f"{current_user.full_name} recorded training '{rec.title}' "
                    f"({TYPE_LABELS.get(rec.training_type, rec.training_type.value)}) for you.",
            resource_type="training", resource_id=str(rec.id),
        )

    db.commit()
    db.refresh(rec)
    return rec


@router.get("/{record_id}", response_model=TrainingOut)
def get_training(
    record_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rec = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Training record not found")
    return rec


@router.put("/{record_id}", response_model=TrainingOut)
def update_training(
    record_id: UUID,
    payload: TrainingUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rec = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Training record not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(rec, k, v)

    log_event(db, AuditAction.UPDATE, user=current_user, resource_type="training",
              resource_id=record_id,
              description=f"Updated training record {rec.record_number}", request=request)
    db.commit()
    db.refresh(rec)
    return rec


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_training(
    record_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rec = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Training record not found")
    log_event(db, AuditAction.DELETE, user=current_user, resource_type="training",
              resource_id=record_id,
              description=f"Deleted training record {rec.record_number}", request=request)
    db.delete(rec)
    db.commit()
