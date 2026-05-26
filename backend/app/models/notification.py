import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..database import Base


class NotificationType(str, enum.Enum):
    EBR_SUBMITTED      = "EBR_SUBMITTED"       # batch submitted for QA review
    EBR_APPROVED       = "EBR_APPROVED"         # batch released
    EBR_REJECTED       = "EBR_REJECTED"         # batch rejected
    MBR_SUBMITTED      = "MBR_SUBMITTED"        # MBR submitted for review
    MBR_APPROVED       = "MBR_APPROVED"         # MBR approved
    MBR_REJECTED       = "MBR_REJECTED"         # MBR rejected
    DEVIATION_OPENED   = "DEVIATION_OPENED"     # new deviation raised
    DEVIATION_CLOSED   = "DEVIATION_CLOSED"     # deviation closed
    CAPA_OPENED        = "CAPA_OPENED"          # new CAPA created
    CAPA_OVERDUE       = "CAPA_OVERDUE"         # CAPA past due date
    SYSTEM             = "SYSTEM"               # generic system message


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)

    type         = Column(SAEnum(NotificationType), nullable=False, index=True)
    title        = Column(String(200), nullable=False)
    message      = Column(Text, nullable=False)

    # Link back to the originating resource so the UI can navigate to it
    resource_type = Column(String(50), nullable=True)   # "ebr", "mbr", "deviation", "capa"
    resource_id   = Column(String(36), nullable=True)

    is_read    = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
