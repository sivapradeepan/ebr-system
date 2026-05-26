from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.audit import AuditLog, AuditAction
from ..models.user import User
from ..schemas.audit import AuditLogList
from ..core.rbac import require_permission
from ..dependencies import get_current_user

router = APIRouter(prefix="/audit", tags=["Audit Trail"])


@router.get("", response_model=AuditLogList)
async def get_audit_logs(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    action: Optional[AuditAction] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __ = Depends(require_permission("audit:read")),
):
    query = db.query(AuditLog)

    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if username:
        query = query.filter(AuditLog.username.ilike(f"%{username}%"))
    if action:
        query = query.filter(AuditLog.action == action)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if resource_id:
        query = query.filter(AuditLog.resource_id == resource_id)
    if start_date:
        query = query.filter(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.filter(AuditLog.timestamp <= end_date)

    query = query.order_by(AuditLog.timestamp.desc())
    total = query.count()
    logs = query.offset((page - 1) * size).limit(size).all()

    return AuditLogList(items=logs, total=total, page=page, size=size)
