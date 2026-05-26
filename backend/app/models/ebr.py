import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Date, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..database import Base


class EBRStatus(str, enum.Enum):
    INITIATED = "INITIATED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class EBRStepStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class EBR(Base):
    __tablename__ = "ebrs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ebr_number = Column(String(50), unique=True, nullable=False, index=True)
    batch_number = Column(String(100), unique=True, nullable=False, index=True)

    # MBR snapshot (locked at creation)
    mbr_id = Column(UUID(as_uuid=True), ForeignKey("mbrs.id"), nullable=False)
    mbr_number = Column(String(50), nullable=False)
    mbr_version = Column(String(20), nullable=False)
    product_name = Column(String(255), nullable=False)
    product_code = Column(String(100), nullable=False)
    strength = Column(String(100), nullable=True)
    dosage_form = Column(String(100), nullable=True)

    # Batch quantities
    planned_batch_size = Column(Float, nullable=True)
    batch_unit = Column(String(50), nullable=True)
    actual_yield = Column(Float, nullable=True)
    actual_yield_unit = Column(String(50), nullable=True)
    yield_percentage = Column(Float, nullable=True)

    status = Column(SAEnum(EBRStatus), default=EBRStatus.INITIATED, nullable=False, index=True)

    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    initiated_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reviewed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    mbr = relationship("MBR")
    initiated_by = relationship("User", foreign_keys=[initiated_by_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    steps = relationship("EBRStep", back_populates="ebr", cascade="all, delete-orphan", order_by="EBRStep.order")
    materials = relationship("EBRMaterialDispensing", back_populates="ebr", cascade="all, delete-orphan", order_by="EBRMaterialDispensing.order")


class EBRStep(Base):
    __tablename__ = "ebr_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ebr_id = Column(UUID(as_uuid=True), ForeignKey("ebrs.id", ondelete="CASCADE"), nullable=False, index=True)
    mbr_step_id = Column(String(36), nullable=True)  # reference only, no FK to allow MBR edits

    # Snapshot from MBR step
    step_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_critical = Column(Boolean, default=False, nullable=False)
    expected_duration_minutes = Column(Integer, nullable=True)
    expected_yield = Column(Float, nullable=True)
    yield_unit = Column(String(50), nullable=True)
    notes_template = Column(String(1000), nullable=True)
    order = Column(Integer, default=0, nullable=False)

    # Execution data
    status = Column(SAEnum(EBRStepStatus), default=EBRStepStatus.PENDING, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    actual_yield = Column(Float, nullable=True)
    operator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    operator_signed_at = Column(DateTime(timezone=True), nullable=True)
    execution_notes = Column(Text, nullable=True)

    ebr = relationship("EBR", back_populates="steps")
    operator = relationship("User", foreign_keys=[operator_id])
    parameter_results = relationship("EBRParameterResult", back_populates="step", cascade="all, delete-orphan")
    ipqc_results = relationship("EBRIPQCResult", back_populates="step", cascade="all, delete-orphan")


class EBRParameterResult(Base):
    __tablename__ = "ebr_parameter_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    step_id = Column(UUID(as_uuid=True), ForeignKey("ebr_steps.id", ondelete="CASCADE"), nullable=False, index=True)

    # Snapshot from MBR parameter
    parameter_name = Column(String(255), nullable=False)
    unit = Column(String(50), nullable=True)
    target_value = Column(String(100), nullable=True)
    min_value = Column(String(100), nullable=True)
    max_value = Column(String(100), nullable=True)
    is_critical = Column(Boolean, default=False)

    # Recorded data
    actual_value = Column(String(100), nullable=True)
    is_in_range = Column(Boolean, nullable=True)
    recorded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    recorded_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(String(500), nullable=True)

    step = relationship("EBRStep", back_populates="parameter_results")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])


class EBRIPQCResult(Base):
    __tablename__ = "ebr_ipqc_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    step_id = Column(UUID(as_uuid=True), ForeignKey("ebr_steps.id", ondelete="CASCADE"), nullable=False, index=True)

    # Snapshot from MBR IPQC
    test_name = Column(String(255), nullable=False)
    method = Column(String(255), nullable=True)
    acceptance_criteria = Column(String(500), nullable=False)
    frequency = Column(String(255), nullable=True)
    responsible_role = Column(String(100), nullable=True)

    # Results
    actual_result = Column(String(500), nullable=True)
    passed = Column(Boolean, nullable=True)
    performed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    performed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(String(500), nullable=True)

    step = relationship("EBRStep", back_populates="ipqc_results")
    performed_by = relationship("User", foreign_keys=[performed_by_id])


class EBRMaterialDispensing(Base):
    __tablename__ = "ebr_material_dispensings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ebr_id = Column(UUID(as_uuid=True), ForeignKey("ebrs.id", ondelete="CASCADE"), nullable=False, index=True)

    # Snapshot from MBR material
    material_name = Column(String(255), nullable=False)
    material_code = Column(String(100), nullable=True)
    required_quantity = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False)
    grade = Column(String(100), nullable=True)
    is_active_ingredient = Column(Boolean, default=False)
    order = Column(Integer, default=0)

    # Dispensing data
    actual_quantity = Column(Float, nullable=True)
    lot_number = Column(String(100), nullable=True)
    expiry_date = Column(Date, nullable=True)
    dispensed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    dispensed_at = Column(DateTime(timezone=True), nullable=True)
    is_dispensed = Column(Boolean, default=False, nullable=False)
    notes = Column(String(500), nullable=True)

    ebr = relationship("EBR", back_populates="materials")
    dispensed_by = relationship("User", foreign_keys=[dispensed_by_id])
