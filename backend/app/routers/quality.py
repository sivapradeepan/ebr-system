from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from ..database import get_db
from ..core.rbac import require_permission
from ..core.audit_logger import log_event
from ..core.notifier import notify_permission
from ..models.notification import NotificationType
from ..models.quality import (
    Deviation, CAPA, DeviationStatus, CAPAStatus,
)
from ..models.user import User
from ..models.audit import AuditAction
from ..schemas.quality import (
    DeviationCreate, DeviationUpdate, InvestigatePayload, ResolvePayload,
    DeviationOut, DeviationList,
    CAPACreate, CAPAUpdate, CompletePayload, VerifyPayload,
    CAPAOut, CAPAList,
)

router = APIRouter(tags=["Quality"])


def generate_deviation_number(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(func.count(Deviation.id)).scalar() + 1
    return f"DEV-{year}-{count:04d}"


def generate_capa_number(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(func.count(CAPA.id)).scalar() + 1
    return f"CAPA-{year}-{count:04d}"


# ─── Deviations ───────────────────────────────────────────────────────────────

@router.get("/deviations", response_model=DeviationList)
def list_deviations(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str = Query(None),
    deviation_type: str = Query(None),
    severity: str = Query(None),
    status: str = Query(None),
    ebr_id: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quality:read")),
):
    q = db.query(Deviation)
    if search:
        s = f"%{search}%"
        q = q.filter(or_(
            Deviation.title.ilike(s),
            Deviation.deviation_number.ilike(s),
            Deviation.batch_number.ilike(s),
            Deviation.product_name.ilike(s),
        ))
    if deviation_type:
        q = q.filter(Deviation.deviation_type == deviation_type)
    if severity:
        q = q.filter(Deviation.severity == severity)
    if status:
        q = q.filter(Deviation.status == status)
    if ebr_id:
        q = q.filter(Deviation.ebr_id == ebr_id)

    total = q.count()
    items = q.order_by(Deviation.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return DeviationList(items=items, total=total, page=page, size=size)


@router.post("/deviations", response_model=DeviationOut, status_code=status.HTTP_201_CREATED)
def create_deviation(
    payload: DeviationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quality:manage")),
):
    dev = Deviation(
        **payload.model_dump(),
        deviation_number=generate_deviation_number(db),
        detected_by_id=current_user.id,
    )
    db.add(dev)
    db.flush()
    log_event(db, AuditAction.CREATE, user=current_user,
              resource_type="deviation", resource_id=str(dev.id),
              description=f"Raised deviation: {dev.deviation_number} — {dev.title}")
    notify_permission(
        db, "quality:manage", NotificationType.DEVIATION_OPENED,
        title=f"New {dev.severity.value} deviation: {dev.deviation_number}",
        message=f"{current_user.full_name} raised a {dev.severity.value} deviation: "
                f'"{dev.title}"{(" — Batch: " + dev.batch_number) if dev.batch_number else ""}.',
        resource_type="deviation", resource_id=str(dev.id),
        exclude_user_id=current_user.id,
    )
    db.commit()
    db.refresh(dev)
    return dev


@router.get("/deviations/{deviation_id}", response_model=DeviationOut)
def get_deviation(
    deviation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quality:read")),
):
    dev = db.query(Deviation).filter(Deviation.id == deviation_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Deviation not found")
    return dev


@router.put("/deviations/{deviation_id}", response_model=DeviationOut)
def update_deviation(
    deviation_id: str,
    payload: DeviationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quality:manage")),
):
    dev = db.query(Deviation).filter(Deviation.id == deviation_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Deviation not found")
    if dev.status == DeviationStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Closed deviations cannot be edited")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(dev, k, v)
    dev.updated_at = datetime.utcnow()
    log_event(db, AuditAction.UPDATE, user=current_user,
              resource_type="deviation", resource_id=str(dev.id),
              description=f"Updated deviation: {dev.deviation_number}")
    db.commit()
    db.refresh(dev)
    return dev


@router.post("/deviations/{deviation_id}/investigate", response_model=DeviationOut)
def investigate_deviation(
    deviation_id: str,
    payload: InvestigatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quality:manage")),
):
    dev = db.query(Deviation).filter(Deviation.id == deviation_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Deviation not found")
    if dev.status not in (DeviationStatus.OPEN, DeviationStatus.UNDER_INVESTIGATION):
        raise HTTPException(status_code=400, detail=f"Cannot investigate a {dev.status} deviation")

    dev.status = DeviationStatus.UNDER_INVESTIGATION
    dev.root_cause = payload.root_cause
    dev.investigation_summary = payload.investigation_summary
    dev.investigated_by_id = current_user.id
    dev.investigated_at = datetime.utcnow()
    dev.updated_at = datetime.utcnow()
    log_event(db, AuditAction.UPDATE, user=current_user,
              resource_type="deviation", resource_id=str(dev.id),
              description=f"Investigation recorded for {dev.deviation_number}")
    db.commit()
    db.refresh(dev)
    return dev


@router.post("/deviations/{deviation_id}/pending-capa", response_model=DeviationOut)
def set_pending_capa(
    deviation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quality:manage")),
):
    dev = db.query(Deviation).filter(Deviation.id == deviation_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Deviation not found")
    if dev.status != DeviationStatus.UNDER_INVESTIGATION:
        raise HTTPException(status_code=400, detail="Deviation must be under investigation first")

    dev.status = DeviationStatus.PENDING_CAPA
    dev.updated_at = datetime.utcnow()
    log_event(db, AuditAction.UPDATE, user=current_user,
              resource_type="deviation", resource_id=str(dev.id),
              description=f"Deviation {dev.deviation_number} pending CAPA")
    db.commit()
    db.refresh(dev)
    return dev


@router.post("/deviations/{deviation_id}/resolve", response_model=DeviationOut)
def resolve_deviation(
    deviation_id: str,
    payload: ResolvePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quality:manage")),
):
    dev = db.query(Deviation).filter(Deviation.id == deviation_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Deviation not found")
    if dev.status not in (DeviationStatus.UNDER_INVESTIGATION, DeviationStatus.PENDING_CAPA):
        raise HTTPException(status_code=400, detail=f"Cannot resolve a {dev.status} deviation")

    dev.status = DeviationStatus.RESOLVED
    dev.closure_comments = payload.closure_comments
    dev.updated_at = datetime.utcnow()
    log_event(db, AuditAction.UPDATE, user=current_user,
              resource_type="deviation", resource_id=str(dev.id),
              description=f"Deviation {dev.deviation_number} resolved")
    db.commit()
    db.refresh(dev)
    return dev


@router.post("/deviations/{deviation_id}/close", response_model=DeviationOut)
def close_deviation(
    deviation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quality:manage")),
):
    dev = db.query(Deviation).filter(Deviation.id == deviation_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Deviation not found")
    if dev.status != DeviationStatus.RESOLVED:
        raise HTTPException(status_code=400, detail="Deviation must be resolved before closing")

    dev.status = DeviationStatus.CLOSED
    dev.closed_by_id = current_user.id
    dev.closed_at = datetime.utcnow()
    dev.updated_at = datetime.utcnow()
    log_event(db, AuditAction.UPDATE, user=current_user,
              resource_type="deviation", resource_id=str(dev.id),
              description=f"Deviation {dev.deviation_number} closed by {current_user.username}")
    db.commit()
    db.refresh(dev)
    return dev


# ─── CAPAs ────────────────────────────────────────────────────────────────────

@router.get("/capas", response_model=CAPAList)
def list_capas(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str = Query(None),
    capa_type: str = Query(None),
    status: str = Query(None),
    deviation_id: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quality:read")),
):
    q = db.query(CAPA)
    if search:
        s = f"%{search}%"
        q = q.filter(or_(CAPA.title.ilike(s), CAPA.capa_number.ilike(s)))
    if capa_type:
        q = q.filter(CAPA.capa_type == capa_type)
    if status:
        q = q.filter(CAPA.status == status)
    if deviation_id:
        q = q.filter(CAPA.deviation_id == deviation_id)

    total = q.count()
    items = q.order_by(CAPA.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return CAPAList(items=items, total=total, page=page, size=size)


@router.post("/capas", response_model=CAPAOut, status_code=status.HTTP_201_CREATED)
def create_capa(
    payload: CAPACreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quality:manage")),
):
    dev = db.query(Deviation).filter(Deviation.id == payload.deviation_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Deviation not found")
    if dev.status == DeviationStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot add CAPA to a closed deviation")

    capa = CAPA(
        **payload.model_dump(),
        capa_number=generate_capa_number(db),
        created_by_id=current_user.id,
    )
    db.add(capa)
    db.flush()

    # Auto-transition deviation to PENDING_CAPA if it's resolved or under investigation
    if dev.status == DeviationStatus.UNDER_INVESTIGATION:
        dev.status = DeviationStatus.PENDING_CAPA

    log_event(db, AuditAction.CREATE, user=current_user,
              resource_type="capa", resource_id=str(capa.id),
              description=f"Created CAPA: {capa.capa_number} for {dev.deviation_number}")
    db.commit()
    db.refresh(capa)
    return capa


@router.get("/capas/{capa_id}", response_model=CAPAOut)
def get_capa(
    capa_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quality:read")),
):
    capa = db.query(CAPA).filter(CAPA.id == capa_id).first()
    if not capa:
        raise HTTPException(status_code=404, detail="CAPA not found")
    return capa


@router.put("/capas/{capa_id}", response_model=CAPAOut)
def update_capa(
    capa_id: str,
    payload: CAPAUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quality:manage")),
):
    capa = db.query(CAPA).filter(CAPA.id == capa_id).first()
    if not capa:
        raise HTTPException(status_code=404, detail="CAPA not found")
    if capa.status == CAPAStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Closed CAPAs cannot be edited")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(capa, k, v)
    capa.updated_at = datetime.utcnow()
    log_event(db, AuditAction.UPDATE, user=current_user,
              resource_type="capa", resource_id=str(capa.id),
              description=f"Updated CAPA: {capa.capa_number}")
    db.commit()
    db.refresh(capa)
    return capa


@router.post("/capas/{capa_id}/start", response_model=CAPAOut)
def start_capa(
    capa_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quality:manage")),
):
    capa = db.query(CAPA).filter(CAPA.id == capa_id).first()
    if not capa:
        raise HTTPException(status_code=404, detail="CAPA not found")
    if capa.status != CAPAStatus.OPEN:
        raise HTTPException(status_code=400, detail="CAPA is not in OPEN status")

    capa.status = CAPAStatus.IN_PROGRESS
    capa.updated_at = datetime.utcnow()
    log_event(db, AuditAction.UPDATE, user=current_user,
              resource_type="capa", resource_id=str(capa.id),
              description=f"CAPA {capa.capa_number} started")
    db.commit()
    db.refresh(capa)
    return capa


@router.post("/capas/{capa_id}/complete", response_model=CAPAOut)
def complete_capa(
    capa_id: str,
    payload: CompletePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quality:manage")),
):
    capa = db.query(CAPA).filter(CAPA.id == capa_id).first()
    if not capa:
        raise HTTPException(status_code=404, detail="CAPA not found")
    if capa.status != CAPAStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="CAPA must be IN_PROGRESS to complete")

    capa.status = CAPAStatus.PENDING_VERIFICATION
    capa.completion_notes = payload.completion_notes
    capa.completed_by_id = current_user.id
    capa.completed_at = datetime.utcnow()
    capa.updated_at = datetime.utcnow()
    log_event(db, AuditAction.UPDATE, user=current_user,
              resource_type="capa", resource_id=str(capa.id),
              description=f"CAPA {capa.capa_number} completed, pending verification")
    db.commit()
    db.refresh(capa)
    return capa


@router.post("/capas/{capa_id}/verify", response_model=CAPAOut)
def verify_capa(
    capa_id: str,
    payload: VerifyPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quality:manage")),
):
    capa = db.query(CAPA).filter(CAPA.id == capa_id).first()
    if not capa:
        raise HTTPException(status_code=404, detail="CAPA not found")
    if capa.status != CAPAStatus.PENDING_VERIFICATION:
        raise HTTPException(status_code=400, detail="CAPA must be pending verification")

    capa.status = CAPAStatus.VERIFIED
    capa.effectiveness_check = payload.effectiveness_check
    capa.verified_by_id = current_user.id
    capa.verified_at = datetime.utcnow()
    capa.updated_at = datetime.utcnow()
    log_event(db, AuditAction.UPDATE, user=current_user,
              resource_type="capa", resource_id=str(capa.id),
              description=f"CAPA {capa.capa_number} effectiveness verified")
    db.commit()
    db.refresh(capa)
    return capa


@router.post("/capas/{capa_id}/close", response_model=CAPAOut)
def close_capa(
    capa_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quality:manage")),
):
    capa = db.query(CAPA).filter(CAPA.id == capa_id).first()
    if not capa:
        raise HTTPException(status_code=404, detail="CAPA not found")
    if capa.status != CAPAStatus.VERIFIED:
        raise HTTPException(status_code=400, detail="CAPA must be verified before closing")

    capa.status = CAPAStatus.CLOSED
    capa.closed_by_id = current_user.id
    capa.closed_at = datetime.utcnow()
    capa.updated_at = datetime.utcnow()
    log_event(db, AuditAction.UPDATE, user=current_user,
              resource_type="capa", resource_id=str(capa.id),
              description=f"CAPA {capa.capa_number} closed")
    db.commit()
    db.refresh(capa)
    return capa
