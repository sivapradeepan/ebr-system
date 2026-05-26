import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, Integer, Date, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from ..database import Base


class LogType(str, enum.Enum):
    MAINTENANCE = "MAINTENANCE"
    CALIBRATION = "CALIBRATION"
    REPAIR = "REPAIR"
    INSPECTION = "INSPECTION"
    INCIDENT = "INCIDENT"
    CLEANING = "CLEANING"
    QUALIFICATION = "QUALIFICATION"
    OTHER = "OTHER"


class LogOutcome(str, enum.Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    CONDITIONAL = "CONDITIONAL"
    PENDING = "PENDING"


class EquipmentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    UNDER_MAINTENANCE = "UNDER_MAINTENANCE"
    CALIBRATION_DUE = "CALIBRATION_DUE"
    RETIRED = "RETIRED"


class CleaningStatus(str, enum.Enum):
    CLEAN = "CLEAN"
    DIRTY = "DIRTY"
    SANITIZED = "SANITIZED"
    STERILIZED = "STERILIZED"
    IN_USE = "IN_USE"
    QUARANTINE = "QUARANTINE"
    CLEANING_IN_PROGRESS = "CLEANING_IN_PROGRESS"
    AWAITING_VERIFICATION = "AWAITING_VERIFICATION"


class MaterialType(str, enum.Enum):
    API = "API"
    EXCIPIENT = "EXCIPIENT"
    PACKAGING = "PACKAGING"
    SOLVENT = "SOLVENT"
    REAGENT = "REAGENT"
    OTHER = "OTHER"


class MaterialStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    DISCONTINUED = "DISCONTINUED"


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipment_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False)       # e.g. Mixer, Granulator, Tablet Press
    manufacturer = Column(String(200))
    model_number = Column(String(100))
    serial_number = Column(String(100))
    location = Column(String(200))
    status = Column(SAEnum(EquipmentStatus), default=EquipmentStatus.ACTIVE, nullable=False)

    # Calibration tracking
    last_calibration_date = Column(Date)
    calibration_due_date = Column(Date)
    calibration_certificate = Column(String(200))

    # Maintenance tracking
    last_maintenance_date = Column(Date)
    next_maintenance_date = Column(Date)
    maintenance_interval_days = Column(Integer)

    notes = Column(Text)
    is_active = Column(Boolean, default=True, nullable=False)

    # Cleaning status
    cleaning_status = Column(SAEnum(CleaningStatus), default=CleaningStatus.CLEAN, nullable=False)
    cleaning_status_updated_at = Column(DateTime)
    cleaning_status_updated_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    created_by = relationship("User", foreign_keys=[created_by_id])
    cleaning_status_updated_by = relationship("User", foreign_keys=[cleaning_status_updated_by_id])
    logs = relationship("EquipmentLog", back_populates="equipment", cascade="all, delete-orphan", order_by="EquipmentLog.performed_date.desc()")
    cleaning_logs = relationship("CleaningLog", back_populates="equipment", cascade="all, delete-orphan", order_by="CleaningLog.performed_at.desc()")
    opc_mappings = relationship("OPCEquipmentMapping", back_populates="equipment", cascade="all, delete-orphan")


class EquipmentLog(Base):
    __tablename__ = "equipment_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipment_id = Column(UUID(as_uuid=True), ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False)

    log_type = Column(SAEnum(LogType), nullable=False)
    outcome = Column(SAEnum(LogOutcome), default=LogOutcome.PASS, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    performed_by = Column(String(200))           # technician / vendor name
    performed_date = Column(Date, nullable=False)
    next_due_date = Column(Date)
    certificate_number = Column(String(100))
    cost = Column(String(50))
    downtime_hours = Column(Integer)
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_by = relationship("User", foreign_keys=[created_by_id])
    equipment = relationship("Equipment", back_populates="logs")


class CleaningLog(Base):
    __tablename__ = "equipment_cleaning_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipment_id = Column(UUID(as_uuid=True), ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False)

    status_from = Column(SAEnum(CleaningStatus))          # previous status
    status_to = Column(SAEnum(CleaningStatus), nullable=False)  # new status
    cleaning_method = Column(String(200))                 # e.g. CIP, SIP, Manual, Rinse
    cleaning_agent = Column(String(200))                  # e.g. IPA 70%, WFI
    performed_by = Column(String(200))
    performed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    verified_by = Column(String(200))
    verified_at = Column(DateTime)
    batch_number = Column(String(100))                    # previous batch if dirty after use
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_by = relationship("User", foreign_keys=[created_by_id])
    equipment = relationship("Equipment", back_populates="cleaning_logs")


class Material(Base):
    __tablename__ = "materials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    material_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    material_type = Column(SAEnum(MaterialType), nullable=False)

    # Identification
    cas_number = Column(String(50))
    pharmacopoeia_standard = Column(String(100))   # USP, EP, BP, etc.
    grade = Column(String(100))                    # Pharmaceutical, Analytical, etc.

    # Supplier
    supplier_name = Column(String(200))
    supplier_code = Column(String(100))
    manufacturer_name = Column(String(200))

    # Specifications
    unit_of_measure = Column(String(50), nullable=False)
    storage_conditions = Column(String(500))
    shelf_life_days = Column(Integer)
    reorder_point = Column(String(50))

    notes = Column(Text)
    status = Column(SAEnum(MaterialStatus), default=MaterialStatus.ACTIVE, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    created_by = relationship("User", foreign_keys=[created_by_id])
