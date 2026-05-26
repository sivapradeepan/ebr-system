import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Text, Boolean,
    DateTime, ForeignKey, Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..database import Base


class ScheduleStatus(str, enum.Enum):
    PLANNED     = "PLANNED"
    CONFIRMED   = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED   = "COMPLETED"
    CANCELLED   = "CANCELLED"


class SchedulePriority(str, enum.Enum):
    HIGH   = "HIGH"
    MEDIUM = "MEDIUM"
    LOW    = "LOW"


class BatchSchedule(Base):
    __tablename__ = "batch_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    schedule_number = Column(String(50), unique=True, nullable=False, index=True)

    # MBR snapshot (locked at planning time)
    mbr_id      = Column(UUID(as_uuid=True), ForeignKey("mbrs.id"), nullable=False)
    mbr_number  = Column(String(50),  nullable=False)
    mbr_version = Column(String(20),  nullable=False)
    product_name = Column(String(255), nullable=False)
    product_code = Column(String(100), nullable=False)

    # Batch parameters
    planned_batch_size = Column(Float,  nullable=True)
    batch_unit         = Column(String(50), nullable=True)

    # Scheduling
    scheduled_start = Column(DateTime(timezone=True), nullable=False)
    scheduled_end   = Column(DateTime(timezone=True), nullable=False)

    # Assignment
    assigned_operator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    equipment_line       = Column(String(200), nullable=True)  # free-text: which line/suite

    # Classification
    status   = Column(SAEnum(ScheduleStatus),  default=ScheduleStatus.PLANNED,  nullable=False, index=True)
    priority = Column(SAEnum(SchedulePriority), default=SchedulePriority.MEDIUM, nullable=False)
    notes    = Column(Text, nullable=True)

    # EBR linkage — set when converted
    ebr_id         = Column(UUID(as_uuid=True), ForeignKey("ebrs.id"), nullable=True)
    converted_at   = Column(DateTime(timezone=True), nullable=True)
    converted_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Metadata
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at    = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at    = Column(DateTime(timezone=True), default=datetime.utcnow,
                           onupdate=datetime.utcnow, nullable=False)

    mbr              = relationship("MBR", foreign_keys=[mbr_id])
    assigned_operator = relationship("User", foreign_keys=[assigned_operator_id])
    converted_by     = relationship("User", foreign_keys=[converted_by_id])
    created_by       = relationship("User", foreign_keys=[created_by_id])
    ebr              = relationship("EBR", foreign_keys=[ebr_id])
