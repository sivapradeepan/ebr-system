"""
21 CFR Part 11 Electronic Signature Router
Each signature atomically: verifies password, executes workflow action, persists immutable record.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..dependencies import get_current_user
from ..core.security import verify_password
from ..core.audit_logger import log_event
from ..models.esignature import ESignature
from ..models.user import User
from ..models.audit import AuditAction
from ..schemas.esignature import SignPayload, ESignatureOut, ESignatureList

# Workflow model imports
from ..models.mbr import MBR, MBRStatus
from ..models.ebr import EBR, EBRStatus
from ..models.quality import Deviation, CAPA, DeviationStatus, CAPAStatus
from ..core.notifier import notify_permission, notify_user
from ..models.notification import NotificationType

router = APIRouter(prefix="/esignatures", tags=["E-Signatures"])


def _generate_sig_number(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(func.count(ESignature.id)).scalar() + 1
    return f"SIG-{year}-{count:06d}"


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ─── Workflow action handlers ─────────────────────────────────────────────────

def _act_mbr(db: Session, resource_id: str, action: str, comments: str, user: User) -> tuple[str, str]:
    """Returns (resource_identifier, description)"""
    mbr = db.query(MBR).filter(MBR.id == resource_id).first()
    if not mbr:
        raise HTTPException(status_code=404, detail="MBR not found")

    if action == "submit":
        if mbr.status != MBRStatus.DRAFT:
            raise HTTPException(status_code=400, detail=f"Cannot submit a {mbr.status} MBR")
        if not mbr.steps:
            raise HTTPException(status_code=400, detail="MBR must have at least one step before submitting")
        mbr.status = MBRStatus.UNDER_REVIEW
        mbr.updated_at = datetime.utcnow()
        log_event(db, AuditAction.UPDATE, user=user, resource_type="mbr", resource_id=str(mbr.id),
                  description=f"MBR {mbr.mbr_number} submitted for review (e-signed)")
        notify_permission(db, "mbr:approve", NotificationType.MBR_SUBMITTED,
                          title=f"MBR {mbr.mbr_number} submitted for review",
                          message=f"{user.full_name} submitted MBR {mbr.mbr_number} ({mbr.product_name}) for review.",
                          resource_type="mbr", resource_id=str(mbr.id), exclude_user_id=user.id)

    elif action == "approve":
        if mbr.status != MBRStatus.UNDER_REVIEW:
            raise HTTPException(status_code=400, detail=f"Cannot approve a {mbr.status} MBR")
        mbr.status = MBRStatus.APPROVED
        mbr.approved_by_id = user.id
        mbr.approved_at = datetime.utcnow()
        mbr.updated_at = datetime.utcnow()
        log_event(db, AuditAction.APPROVE, user=user, resource_type="mbr", resource_id=str(mbr.id),
                  description=f"MBR {mbr.mbr_number} approved (e-signed)")
        if mbr.created_by_id:
            notify_user(db, mbr.created_by_id, NotificationType.MBR_APPROVED,
                        title=f"MBR {mbr.mbr_number} approved",
                        message=f"{user.full_name} approved MBR {mbr.mbr_number} ({mbr.product_name}).",
                        resource_type="mbr", resource_id=str(mbr.id))

    elif action == "reject":
        if mbr.status != MBRStatus.UNDER_REVIEW:
            raise HTTPException(status_code=400, detail=f"Cannot reject a {mbr.status} MBR")
        mbr.status = MBRStatus.DRAFT
        mbr.rejection_reason = comments
        mbr.updated_at = datetime.utcnow()
        log_event(db, AuditAction.REJECT, user=user, resource_type="mbr", resource_id=str(mbr.id),
                  description=f"MBR {mbr.mbr_number} rejected (e-signed): {comments}")
        if mbr.created_by_id:
            notify_user(db, mbr.created_by_id, NotificationType.MBR_REJECTED,
                        title=f"MBR {mbr.mbr_number} rejected",
                        message=f"{user.full_name} rejected MBR {mbr.mbr_number}. {comments}",
                        resource_type="mbr", resource_id=str(mbr.id))
    else:
        raise HTTPException(status_code=400, detail=f"Unknown MBR action: {action}")

    return mbr.mbr_number, f"E-signed {action} on MBR {mbr.mbr_number} v{mbr.version}"


def _act_ebr(db: Session, resource_id: str, action: str, comments: str, user: User) -> tuple[str, str]:
    ebr = db.query(EBR).filter(EBR.id == resource_id).first()
    if not ebr:
        raise HTTPException(status_code=404, detail="EBR not found")

    if action == "submit":
        if ebr.status != EBRStatus.COMPLETED:
            raise HTTPException(status_code=400, detail=f"Cannot submit a {ebr.status} batch for review")
        ebr.status = EBRStatus.UNDER_REVIEW
        ebr.updated_at = datetime.utcnow()
        log_event(db, AuditAction.UPDATE, user=user, resource_type="ebr", resource_id=str(ebr.id),
                  description=f"EBR {ebr.ebr_number} submitted for QA review (e-signed)")

    elif action == "approve":
        if ebr.status != EBRStatus.UNDER_REVIEW:
            raise HTTPException(status_code=400, detail=f"Cannot release a {ebr.status} batch")
        ebr.status = EBRStatus.APPROVED
        ebr.approved_by_id = user.id
        ebr.approved_at = datetime.utcnow()
        ebr.updated_at = datetime.utcnow()
        log_event(db, AuditAction.APPROVE, user=user, resource_type="ebr", resource_id=str(ebr.id),
                  description=f"EBR {ebr.ebr_number} released for distribution (e-signed)")

    elif action == "reject":
        if ebr.status != EBRStatus.UNDER_REVIEW:
            raise HTTPException(status_code=400, detail=f"Cannot reject a {ebr.status} batch")
        ebr.status = EBRStatus.REJECTED
        ebr.rejection_reason = comments
        ebr.updated_at = datetime.utcnow()
        log_event(db, AuditAction.REJECT, user=user, resource_type="ebr", resource_id=str(ebr.id),
                  description=f"EBR {ebr.ebr_number} rejected (e-signed): {comments}")
    else:
        raise HTTPException(status_code=400, detail=f"Unknown EBR action: {action}")

    return ebr.ebr_number, f"E-signed {action} on EBR {ebr.ebr_number}"


def _act_deviation(db: Session, resource_id: str, action: str, comments: str, user: User) -> tuple[str, str]:
    dev = db.query(Deviation).filter(Deviation.id == resource_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Deviation not found")

    if action == "close":
        if dev.status != DeviationStatus.RESOLVED:
            raise HTTPException(status_code=400, detail="Deviation must be RESOLVED before closing")
        dev.status = DeviationStatus.CLOSED
        dev.closed_by_id = user.id
        dev.closed_at = datetime.utcnow()
        dev.updated_at = datetime.utcnow()
        log_event(db, AuditAction.UPDATE, user=user, resource_type="deviation", resource_id=str(dev.id),
                  description=f"Deviation {dev.deviation_number} closed (e-signed)")
    else:
        raise HTTPException(status_code=400, detail=f"Unknown deviation action: {action}")

    return dev.deviation_number, f"E-signed closure of {dev.deviation_number}"


def _act_capa(db: Session, resource_id: str, action: str, comments: str, user: User) -> tuple[str, str]:
    capa = db.query(CAPA).filter(CAPA.id == resource_id).first()
    if not capa:
        raise HTTPException(status_code=404, detail="CAPA not found")

    if action == "close":
        if capa.status != CAPAStatus.VERIFIED:
            raise HTTPException(status_code=400, detail="CAPA must be VERIFIED before closing")
        capa.status = CAPAStatus.CLOSED
        capa.closed_by_id = user.id
        capa.closed_at = datetime.utcnow()
        capa.updated_at = datetime.utcnow()
        log_event(db, AuditAction.UPDATE, user=user, resource_type="capa", resource_id=str(capa.id),
                  description=f"CAPA {capa.capa_number} closed (e-signed)")
    else:
        raise HTTPException(status_code=400, detail=f"Unknown CAPA action: {action}")

    return capa.capa_number, f"E-signed closure of {capa.capa_number}"


DISPATCHERS = {
    "mbr":       _act_mbr,
    "ebr":       _act_ebr,
    "deviation": _act_deviation,
    "capa":      _act_capa,
}


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/sign", response_model=ESignatureOut, status_code=status.HTTP_201_CREATED)
def sign(
    payload: SignPayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 21 CFR §11.200(a)(1) — re-authentication at time of signing
    if not verify_password(payload.password, current_user.hashed_password):
        # Log the failed attempt
        log_event(db, AuditAction.LOGIN_FAILED, user=current_user,
                  resource_type=payload.resource_type, resource_id=str(payload.resource_id),
                  description=f"E-signature authentication failed for {payload.action} on {payload.resource_type}")
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Password verification failed — signature rejected")

    # Dispatch workflow action
    dispatcher = DISPATCHERS.get(payload.resource_type)
    if not dispatcher:
        raise HTTPException(status_code=400, detail=f"Unknown resource type: {payload.resource_type}")

    resource_identifier, audit_desc = dispatcher(
        db, str(payload.resource_id), payload.action, payload.comments or "", current_user
    )

    # Create immutable signature record
    sig = ESignature(
        signature_number=_generate_sig_number(db),
        user_id=current_user.id,
        signer_full_name=current_user.full_name,
        signer_username=current_user.username,
        resource_type=payload.resource_type,
        resource_id=str(payload.resource_id),
        resource_identifier=resource_identifier,
        action=payload.action,
        meaning=payload.meaning,
        comments=payload.comments,
        signed_at=datetime.utcnow(),
        ip_address=_get_client_ip(request),
        password_verified=True,
    )
    db.add(sig)

    log_event(db, AuditAction.SIGN, user=current_user,
              resource_type=payload.resource_type, resource_id=str(payload.resource_id),
              description=f"E-signature {sig.signature_number}: {audit_desc}")

    db.commit()
    db.refresh(sig)
    return sig


@router.get("", response_model=ESignatureList)
def list_signatures(
    resource_type: str = Query(None),
    resource_id: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ESignature)
    if resource_type:
        q = q.filter(ESignature.resource_type == resource_type)
    if resource_id:
        q = q.filter(ESignature.resource_id == resource_id)

    items = q.order_by(ESignature.signed_at.asc()).all()
    return ESignatureList(items=items, total=len(items))
