"""
Notification helper — creates Notification records for targeted users.

Usage:
    notify_permission(db, "ebr:approve", NotificationType.EBR_SUBMITTED,
                      "Batch submitted", "EBR-2026-0001 submitted for review",
                      resource_type="ebr", resource_id=str(ebr.id),
                      exclude_user_id=current_user.id)

    notify_user(db, user_id, NotificationType.EBR_APPROVED, ...)
"""
from uuid import UUID
from typing import Optional
from sqlalchemy.orm import Session
from ..models.notification import Notification, NotificationType
from ..models.user import User, Role, Permission


def notify_user(
    db: Session,
    user_id: UUID,
    ntype: NotificationType,
    title: str,
    message: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
) -> None:
    """Create a notification for a single user."""
    db.add(Notification(
        user_id=user_id,
        type=ntype,
        title=title,
        message=message,
        resource_type=resource_type,
        resource_id=resource_id,
    ))


def notify_permission(
    db: Session,
    permission_name: str,
    ntype: NotificationType,
    title: str,
    message: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    exclude_user_id: Optional[UUID] = None,
) -> None:
    """
    Notify all active users who hold the given permission.
    Optionally exclude the user who triggered the event.
    """
    users = (
        db.query(User)
        .join(User.roles)
        .join(Role.permissions)
        .filter(
            Permission.name == permission_name,
            User.is_active.is_(True),
        )
        .distinct()
        .all()
    )
    for user in users:
        if exclude_user_id and user.id == exclude_user_id:
            continue
        notify_user(db, user.id, ntype, title, message, resource_type, resource_id)
