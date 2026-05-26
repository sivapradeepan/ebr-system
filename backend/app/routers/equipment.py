from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from ..database import get_db
from ..dependencies import get_current_user
from ..core.rbac import require_permission
from ..core.audit_logger import log_event
from ..models.equipment import Equipment, EquipmentStatus, EquipmentLog, CleaningLog
from ..models.user import User
from ..models.audit import AuditAction
from ..schemas.equipment import (
    EquipmentCreate, EquipmentUpdate, EquipmentOut, EquipmentList,
    EquipmentLogCreate, EquipmentLogUpdate, EquipmentLogOut, EquipmentLogList,
    CleaningLogCreate, CleaningLogOut, CleaningLogList,
)

router = APIRouter(prefix="/equipment", tags=["Equipment"])


def generate_equipment_id(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(func.count(Equipment.id)).scalar() + 1
    return f"EQ-{year}-{count:04d}"


@router.get("", response_model=EquipmentList)
def list_equipment(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str = Query(None),
    status: str = Query(None),
    category: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("equipment:read")),
):
    q = db.query(Equipment)
    if search:
        s = f"%{search}%"
        q = q.filter(or_(
            Equipment.name.ilike(s),
            Equipment.equipment_id.ilike(s),
            Equipment.manufacturer.ilike(s),
            Equipment.serial_number.ilike(s),
            Equipment.location.ilike(s),
        ))
    if status:
        q = q.filter(Equipment.status == status)
    if category:
        q = q.filter(Equipment.category.ilike(f"%{category}%"))

    total = q.count()
    items = q.order_by(Equipment.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return EquipmentList(items=items, total=total, page=page, size=size)


@router.post("", response_model=EquipmentOut, status_code=status.HTTP_201_CREATED)
def create_equipment(
    payload: EquipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("equipment:manage")),
):
    eq = Equipment(
        **payload.model_dump(),
        equipment_id=generate_equipment_id(db),
        created_by_id=current_user.id,
    )
    db.add(eq)
    db.flush()
    log_event(db, AuditAction.CREATE, user=current_user,
              resource_type="equipment", resource_id=str(eq.id),
              description=f"Created equipment: {eq.name} ({eq.equipment_id})")
    db.commit()
    db.refresh(eq)
    return eq


@router.get("/{equipment_id}", response_model=EquipmentOut)
def get_equipment(
    equipment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("equipment:read")),
):
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return eq


@router.put("/{equipment_id}", response_model=EquipmentOut)
def update_equipment(
    equipment_id: str,
    payload: EquipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("equipment:manage")),
):
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")

    old_status = eq.status
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(eq, k, v)
    eq.updated_at = datetime.utcnow()

    log_event(db, AuditAction.UPDATE, user=current_user,
              resource_type="equipment", resource_id=str(eq.id),
              description=f"Updated equipment: {eq.name}",
              old_value={"status": old_status} if "status" in data else None,
              new_value={"status": eq.status} if "status" in data else None)
    db.commit()
    db.refresh(eq)
    return eq


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(
    equipment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("equipment:manage")),
):
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")

    log_event(db, AuditAction.DELETE, user=current_user,
              resource_type="equipment", resource_id=str(eq.id),
              description=f"Deleted equipment: {eq.name} ({eq.equipment_id})")
    db.delete(eq)
    db.commit()


# ── Equipment Logs ────────────────────────────────────────────────────────────

@router.get("/{equipment_id}/logs", response_model=EquipmentLogList)
def list_logs(
    equipment_id: str,
    log_type: str = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("equipment:read")),
):
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")
    q = db.query(EquipmentLog).filter(EquipmentLog.equipment_id == equipment_id)
    if log_type:
        q = q.filter(EquipmentLog.log_type == log_type)
    total = q.count()
    items = q.order_by(EquipmentLog.performed_date.desc()).offset((page - 1) * size).limit(size).all()
    return EquipmentLogList(items=items, total=total)


@router.post("/{equipment_id}/logs", response_model=EquipmentLogOut, status_code=status.HTTP_201_CREATED)
def create_log(
    equipment_id: str,
    payload: EquipmentLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("equipment:manage")),
):
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")
    log = EquipmentLog(**payload.model_dump(), equipment_id=equipment_id, created_by_id=current_user.id)
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.patch("/{equipment_id}/logs/{log_id}", response_model=EquipmentLogOut)
def update_log(
    equipment_id: str,
    log_id: str,
    payload: EquipmentLogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("equipment:manage")),
):
    log = db.query(EquipmentLog).filter(
        EquipmentLog.id == log_id, EquipmentLog.equipment_id == equipment_id
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(log, k, v)
    db.commit()
    db.refresh(log)
    return log


@router.delete("/{equipment_id}/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_log(
    equipment_id: str,
    log_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("equipment:manage")),
):
    log = db.query(EquipmentLog).filter(
        EquipmentLog.id == log_id, EquipmentLog.equipment_id == equipment_id
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    db.delete(log)
    db.commit()


# ── Cleaning Status ───────────────────────────────────────────────────────────

@router.get("/{equipment_id}/cleaning", response_model=CleaningLogList)
def list_cleaning_logs(
    equipment_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("equipment:read")),
):
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")
    q = db.query(CleaningLog).filter(CleaningLog.equipment_id == equipment_id)
    total = q.count()
    items = q.order_by(CleaningLog.performed_at.desc()).offset((page - 1) * size).limit(size).all()
    return CleaningLogList(items=items, total=total)


@router.post("/{equipment_id}/cleaning", response_model=CleaningLogOut, status_code=status.HTTP_201_CREATED)
def add_cleaning_log(
    equipment_id: str,
    payload: CleaningLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("equipment:manage")),
):
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")

    entry = CleaningLog(
        **payload.model_dump(),
        equipment_id=equipment_id,
        status_from=eq.cleaning_status,
        performed_at=payload.performed_at or datetime.utcnow(),
        created_by_id=current_user.id,
    )
    db.add(entry)

    # Update current cleaning status on equipment
    eq.cleaning_status = payload.status_to
    eq.cleaning_status_updated_at = entry.performed_at
    eq.cleaning_status_updated_by_id = current_user.id

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{equipment_id}/cleaning/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cleaning_log(
    equipment_id: str,
    log_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("equipment:manage")),
):
    entry = db.query(CleaningLog).filter(
        CleaningLog.id == log_id, CleaningLog.equipment_id == equipment_id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Cleaning log not found")
    db.delete(entry)
    db.commit()
