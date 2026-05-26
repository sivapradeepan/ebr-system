import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Date,
    Text, ForeignKey, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..database import Base


class MBRStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    EFFECTIVE = "EFFECTIVE"
    SUPERSEDED = "SUPERSEDED"
    OBSOLETE = "OBSOLETE"


class MBR(Base):
    __tablename__ = "mbrs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mbr_number = Column(String(50), unique=True, nullable=False, index=True)
    version = Column(String(20), nullable=False, default="1.0")
    title = Column(String(255), nullable=False)
    product_name = Column(String(255), nullable=False)
    product_code = Column(String(100), nullable=False, index=True)
    dosage_form = Column(String(100), nullable=True)
    strength = Column(String(100), nullable=True)
    batch_size = Column(Float, nullable=True)
    batch_unit = Column(String(50), nullable=True)
    theoretical_yield = Column(Float, nullable=True)
    yield_unit = Column(String(50), nullable=True)
    status = Column(SAEnum(MBRStatus), default=MBRStatus.DRAFT, nullable=False, index=True)
    effective_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    description = Column(Text, nullable=True)
    storage_conditions = Column(String(500), nullable=True)
    manufacturing_site = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    parent_mbr_id = Column(UUID(as_uuid=True), ForeignKey("mbrs.id"), nullable=True)  # for versioning

    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    created_by = relationship("User", foreign_keys=[created_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    materials = relationship("MBRMaterial", back_populates="mbr", cascade="all, delete-orphan", order_by="MBRMaterial.order")
    equipment = relationship("MBREquipment", back_populates="mbr", cascade="all, delete-orphan", order_by="MBREquipment.order")
    steps = relationship("MBRStep", back_populates="mbr", cascade="all, delete-orphan", order_by="MBRStep.order")


class MBRMaterial(Base):
    __tablename__ = "mbr_materials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mbr_id = Column(UUID(as_uuid=True), ForeignKey("mbrs.id", ondelete="CASCADE"), nullable=False, index=True)
    material_name = Column(String(255), nullable=False)
    material_code = Column(String(100), nullable=True)
    quantity = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False)
    grade = Column(String(100), nullable=True)
    is_active_ingredient = Column(Boolean, default=False, nullable=False)
    supplier = Column(String(255), nullable=True)
    notes = Column(String(500), nullable=True)
    order = Column(Integer, default=0, nullable=False)

    mbr = relationship("MBR", back_populates="materials")


class MBREquipment(Base):
    __tablename__ = "mbr_equipment"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mbr_id = Column(UUID(as_uuid=True), ForeignKey("mbrs.id", ondelete="CASCADE"), nullable=False, index=True)
    equipment_name = Column(String(255), nullable=False)
    equipment_code = Column(String(100), nullable=True)
    capacity = Column(String(100), nullable=True)
    notes = Column(String(500), nullable=True)
    order = Column(Integer, default=0, nullable=False)

    mbr = relationship("MBR", back_populates="equipment")


class MBRStep(Base):
    __tablename__ = "mbr_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mbr_id = Column(UUID(as_uuid=True), ForeignKey("mbrs.id", ondelete="CASCADE"), nullable=False, index=True)
    step_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    expected_duration_minutes = Column(Integer, nullable=True)
    expected_yield = Column(Float, nullable=True)
    yield_unit = Column(String(50), nullable=True)
    is_critical = Column(Boolean, default=False, nullable=False)
    notes = Column(String(1000), nullable=True)
    order = Column(Integer, default=0, nullable=False)

    mbr = relationship("MBR", back_populates="steps")
    parameters = relationship("MBRStepParameter", back_populates="step", cascade="all, delete-orphan")
    ipqcs = relationship("MBRStepIPQC", back_populates="step", cascade="all, delete-orphan")


class MBRStepParameter(Base):
    __tablename__ = "mbr_step_parameters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    step_id = Column(UUID(as_uuid=True), ForeignKey("mbr_steps.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    unit = Column(String(50), nullable=True)
    target_value = Column(String(100), nullable=True)
    min_value = Column(String(100), nullable=True)
    max_value = Column(String(100), nullable=True)
    is_critical = Column(Boolean, default=False, nullable=False)
    notes = Column(String(500), nullable=True)

    step = relationship("MBRStep", back_populates="parameters")


class MBRStepIPQC(Base):
    __tablename__ = "mbr_step_ipqcs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    step_id = Column(UUID(as_uuid=True), ForeignKey("mbr_steps.id", ondelete="CASCADE"), nullable=False)
    test_name = Column(String(255), nullable=False)
    method = Column(String(255), nullable=True)
    acceptance_criteria = Column(String(500), nullable=False)
    frequency = Column(String(255), nullable=True)
    responsible_role = Column(String(100), nullable=True)
    notes = Column(String(500), nullable=True)

    step = relationship("MBRStep", back_populates="ipqcs")
