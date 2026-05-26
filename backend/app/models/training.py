import uuid
import enum
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Float, Boolean, Text,
    DateTime, Date, ForeignKey, Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..database import Base


class TrainingType(str, enum.Enum):
    GMP_BASICS  = "GMP_BASICS"    # General GMP / 21 CFR Part 211
    SOP         = "SOP"           # Standard Operating Procedure
    EQUIPMENT   = "EQUIPMENT"     # Equipment operation & qualification
    PROCESS     = "PROCESS"       # Manufacturing process
    SAFETY      = "SAFETY"        # EHS / safety
    REGULATORY  = "REGULATORY"    # Regulatory / compliance
    COMPUTER    = "COMPUTER"      # Computer system / 21 CFR Part 11
    OTHER       = "OTHER"


class TrainingStatus(str, enum.Enum):
    CURRENT   = "CURRENT"    # Valid, not expiring soon
    DUE_SOON  = "DUE_SOON"   # Expires within 30 days
    EXPIRED   = "EXPIRED"    # Past expiry date
    PENDING   = "PENDING"    # Assigned but not yet completed


class TrainingRecord(Base):
    __tablename__ = "training_records"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_number = Column(String(50), unique=True, nullable=False, index=True)  # TRN-2026-0001

    # Who was trained
    trainee_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                        nullable=False, index=True)

    # What
    training_type  = Column(SAEnum(TrainingType), nullable=False, index=True)
    title          = Column(String(300), nullable=False)
    description    = Column(Text, nullable=True)
    reference_doc  = Column(String(200), nullable=True)  # e.g. "SOP-GR-001 v3.2"

    # When
    training_date = Column(Date, nullable=False)
    expiry_date   = Column(Date, nullable=True)  # null = never expires

    # Who delivered the training
    trainer_id   = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    trainer_name = Column(String(200), nullable=True)  # for external trainers

    # Outcome
    passed = Column(Boolean, nullable=True)   # null = no assessment
    score  = Column(Float, nullable=True)     # 0–100

    notes = Column(Text, nullable=True)

    # Metadata
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at    = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at    = Column(DateTime(timezone=True), default=datetime.utcnow,
                           onupdate=datetime.utcnow, nullable=False)

    trainee    = relationship("User", foreign_keys=[trainee_id])
    trainer    = relationship("User", foreign_keys=[trainer_id])
    created_by = relationship("User", foreign_keys=[created_by_id])

    @property
    def status(self) -> TrainingStatus:
        if self.passed is False:
            return TrainingStatus.PENDING
        if self.expiry_date is None:
            return TrainingStatus.CURRENT
        today = date.today()
        if self.expiry_date < today:
            return TrainingStatus.EXPIRED
        delta = (self.expiry_date - today).days
        if delta <= 30:
            return TrainingStatus.DUE_SOON
        return TrainingStatus.CURRENT
