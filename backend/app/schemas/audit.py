from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID
from ..models.audit import AuditAction, AuditStatus


class AuditLogOut(BaseModel):
    id: UUID
    timestamp: datetime
    user_id: Optional[str] = None
    username: Optional[str] = None
    action: AuditAction
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    description: Optional[str] = None
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    ip_address: Optional[str] = None
    status: AuditStatus

    model_config = {"from_attributes": True}


class AuditLogList(BaseModel):
    items: List[AuditLogOut]
    total: int
    page: int
    size: int
