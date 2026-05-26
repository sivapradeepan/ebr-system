from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from ..models.notification import NotificationType


class NotificationOut(BaseModel):
    id: UUID
    type: NotificationType
    title: str
    message: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationList(BaseModel):
    items: List[NotificationOut]
    total: int
    unread: int


class UnreadCount(BaseModel):
    unread: int
