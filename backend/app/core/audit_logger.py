from typing import Optional, Any
from sqlalchemy.orm import Session
from fastapi import Request
from ..models.audit import AuditLog, AuditAction, AuditStatus
from ..models.user import User


def log_event(
    db: Session,
    action: AuditAction,
    *,
    user: Optional[User] = None,
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[Any] = None,
    description: Optional[str] = None,
    old_value: Optional[Any] = None,
    new_value: Optional[Any] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    status: AuditStatus = AuditStatus.SUCCESS,
    request: Optional[Request] = None,
) -> AuditLog:
    if user:
        user_id = str(user.id)
        username = user.username
    if request:
        if not ip_address and request.client:
            ip_address = request.client.host
        if not user_agent:
            user_agent = request.headers.get("user-agent")

    log = AuditLog(
        user_id=user_id,
        username=username,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        description=description,
        old_value=old_value,
        new_value=new_value,
        ip_address=ip_address,
        user_agent=user_agent,
        status=status,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
