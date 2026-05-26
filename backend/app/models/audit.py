import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from ..database import Base


class AuditAction(str, enum.Enum):
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    LOGIN_FAILED = "LOGIN_FAILED"
    PASSWORD_CHANGE = "PASSWORD_CHANGE"
    ACCOUNT_LOCKED = "ACCOUNT_LOCKED"
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    VIEW = "VIEW"
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    SIGN = "SIGN"
    PRINT = "PRINT"
    EXPORT = "EXPORT"


class AuditStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)

    user_id = Column(String(36), nullable=True, index=True)
    username = Column(String(50), nullable=True)

    action = Column(SAEnum(AuditAction), nullable=False, index=True)
    resource_type = Column(String(50), nullable=True, index=True)
    resource_id = Column(String(36), nullable=True, index=True)
    description = Column(String(1000), nullable=True)

    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)

    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    status = Column(SAEnum(AuditStatus), default=AuditStatus.SUCCESS, nullable=False)

    # 21 CFR Part 11: Audit logs must NEVER be modified or deleted.
    # Enforce at DB level via row-level security and application policy.
