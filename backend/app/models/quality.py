import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..database import Base


class DeviationType(str, enum.Enum):
    PROCESS = "PROCESS"
    EQUIPMENT = "EQUIPMENT"
    MATERIAL = "MATERIAL"
    ENVIRONMENTAL = "ENVIRONMENTAL"
    DOCUMENTATION = "DOCUMENTATION"
    OTHER = "OTHER"


class DeviationSeverity(str, enum.Enum):
    CRITICAL = "CRITICAL"
    MAJOR = "MAJOR"
    MINOR = "MINOR"


class DeviationStatus(str, enum.Enum):
    OPEN = "OPEN"
    UNDER_INVESTIGATION = "UNDER_INVESTIGATION"
    PENDING_CAPA = "PENDING_CAPA"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class CAPAType(str, enum.Enum):
    CORRECTIVE = "CORRECTIVE"
    PREVENTIVE = "PREVENTIVE"
    BOTH = "BOTH"


class CAPAStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    VERIFIED = "VERIFIED"
    CLOSED = "CLOSED"


class Deviation(Base):
    __tablename__ = "deviations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deviation_number = Column(String(50), unique=True, nullable=False, index=True)

    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=False)
    deviation_type = Column(SAEnum(DeviationType), nullable=False)
    severity = Column(SAEnum(DeviationSeverity), nullable=False)
    status = Column(SAEnum(DeviationStatus), default=DeviationStatus.OPEN, nullable=False)

    # EBR linkage (optional — deviations can be standalone)
    ebr_id = Column(UUID(as_uuid=True), ForeignKey("ebrs.id", ondelete="SET NULL"), nullable=True)
    ebr_step_id = Column(String(36), nullable=True)   # no FK — snapshot reference
    batch_number = Column(String(100), nullable=True)  # snapshot
    product_name = Column(String(200), nullable=True)  # snapshot

    # Detection
    detected_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    detected_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Immediate action
    immediate_action = Column(Text)

    # Investigation
    root_cause = Column(Text)
    investigation_summary = Column(Text)
    investigated_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    investigated_at = Column(DateTime, nullable=True)

    # Closure
    closure_comments = Column(Text)
    closed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    closed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    detected_by = relationship("User", foreign_keys=[detected_by_id])
    investigated_by = relationship("User", foreign_keys=[investigated_by_id])
    closed_by = relationship("User", foreign_keys=[closed_by_id])
    ebr = relationship("EBR", foreign_keys=[ebr_id])
    capas = relationship("CAPA", back_populates="deviation", cascade="all, delete-orphan")


class CAPA(Base):
    __tablename__ = "capas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    capa_number = Column(String(50), unique=True, nullable=False, index=True)

    deviation_id = Column(UUID(as_uuid=True), ForeignKey("deviations.id", ondelete="CASCADE"), nullable=False)

    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=False)
    capa_type = Column(SAEnum(CAPAType), nullable=False)
    status = Column(SAEnum(CAPAStatus), default=CAPAStatus.OPEN, nullable=False)

    assigned_to_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    due_date = Column(Date, nullable=True)

    # Completion
    completion_notes = Column(Text)
    completed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Effectiveness verification
    effectiveness_check = Column(Text)
    verified_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)

    # Closure
    closed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    closed_at = Column(DateTime, nullable=True)

    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    deviation = relationship("Deviation", back_populates="capas")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    completed_by = relationship("User", foreign_keys=[completed_by_id])
    verified_by = relationship("User", foreign_keys=[verified_by_id])
    closed_by = relationship("User", foreign_keys=[closed_by_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
