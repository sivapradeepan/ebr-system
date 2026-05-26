import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, Integer, Float, DateTime, ForeignKey, Enum as SAEnum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from ..database import Base


# ── IDoc Enums ────────────────────────────────────────────────────────────────

class IDocDirection(str, enum.Enum):
    INBOUND = "INBOUND"
    OUTBOUND = "OUTBOUND"


class IDocStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    ERROR = "ERROR"
    IGNORED = "IGNORED"


class IDocType(str, enum.Enum):
    MATMAS = "MATMAS"       # Material master
    PRODORD = "PRODORD"     # Production order
    BATCHA = "BATCHA"       # Batch master
    ZMBR_OUT = "ZMBR_OUT"  # Custom: outbound batch record
    LOIPRO = "LOIPRO"       # Process order
    MBGMCR = "MBGMCR"      # Goods movement
    OTHER = "OTHER"


class IDocConnStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    ERROR = "ERROR"


# ── OPC Enums ─────────────────────────────────────────────────────────────────

class OPCSecurityMode(str, enum.Enum):
    NONE = "NONE"
    SIGN = "SIGN"
    SIGN_AND_ENCRYPT = "SIGN_AND_ENCRYPT"


class OPCConnStatus(str, enum.Enum):
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    ERROR = "ERROR"
    CONNECTING = "CONNECTING"


class OPCDataType(str, enum.Enum):
    BOOLEAN = "Boolean"
    INT16 = "Int16"
    INT32 = "Int32"
    INT64 = "Int64"
    FLOAT = "Float"
    DOUBLE = "Double"
    STRING = "String"
    DATETIME = "DateTime"


# ── IDoc Models ───────────────────────────────────────────────────────────────

class IDocConnection(Base):
    __tablename__ = "idoc_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)

    # SAP connection params
    sap_host = Column(String(200), nullable=False)
    sap_system_number = Column(String(2), nullable=False)   # e.g. "00"
    sap_client = Column(String(3), nullable=False)           # e.g. "100"
    sap_user = Column(String(100), nullable=False)
    sap_password = Column(String(200), nullable=False)       # stored hashed/encrypted in prod
    rfc_destination = Column(String(100))
    partner_number = Column(String(50))                      # SAP logical system name

    # Message routing
    inbound_enabled = Column(Boolean, default=True, nullable=False)
    outbound_enabled = Column(Boolean, default=True, nullable=False)
    auto_process = Column(Boolean, default=False, nullable=False)

    simulation_mode = Column(Boolean, default=False, nullable=False)

    status = Column(SAEnum(IDocConnStatus), default=IDocConnStatus.INACTIVE, nullable=False)
    last_connected_at = Column(DateTime)
    last_error = Column(Text)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    created_by = relationship("User", foreign_keys=[created_by_id])
    messages = relationship("IDocMessage", back_populates="connection", cascade="all, delete-orphan")


class IDocMessage(Base):
    __tablename__ = "idoc_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connection_id = Column(UUID(as_uuid=True), ForeignKey("idoc_connections.id", ondelete="CASCADE"), nullable=False)

    direction = Column(SAEnum(IDocDirection), nullable=False)
    idoc_type = Column(SAEnum(IDocType), nullable=False)
    idoc_number = Column(String(50), index=True)             # SAP IDoc number
    message_type = Column(String(50))                        # MATMAS05, PRODORD02, etc.

    status = Column(SAEnum(IDocStatus), default=IDocStatus.QUEUED, nullable=False)
    error_message = Column(Text)
    retry_count = Column(Integer, default=0, nullable=False)

    # Linked EBR/MBR objects
    reference_type = Column(String(50))                      # "mbr", "ebr", "material", etc.
    reference_id = Column(String(50))

    payload = Column(JSON)                                   # Raw IDoc segment data
    processed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    connection = relationship("IDocConnection", back_populates="messages")


# ── OPC Models ────────────────────────────────────────────────────────────────

class OPCServer(Base):
    __tablename__ = "opc_servers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)

    # OPC-UA connection
    endpoint_url = Column(String(500), nullable=False)       # opc.tcp://host:4840/...
    security_mode = Column(SAEnum(OPCSecurityMode), default=OPCSecurityMode.NONE, nullable=False)
    username = Column(String(100))
    password = Column(String(200))
    certificate_path = Column(String(500))

    # Polling
    polling_interval_ms = Column(Integer, default=1000, nullable=False)
    connection_timeout_s = Column(Integer, default=10, nullable=False)

    simulation_mode = Column(Boolean, default=False, nullable=False)

    status = Column(SAEnum(OPCConnStatus), default=OPCConnStatus.DISCONNECTED, nullable=False)
    last_connected_at = Column(DateTime)
    last_error = Column(Text)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    created_by = relationship("User", foreign_keys=[created_by_id])
    tags = relationship("OPCTag", back_populates="server", cascade="all, delete-orphan")


class OPCTag(Base):
    __tablename__ = "opc_tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("opc_servers.id", ondelete="CASCADE"), nullable=False)

    node_id = Column(String(200), nullable=False)            # e.g. ns=2;s=Device1.Temperature
    display_name = Column(String(200), nullable=False)
    description = Column(Text)
    data_type = Column(SAEnum(OPCDataType), default=OPCDataType.FLOAT, nullable=False)
    unit = Column(String(50))                                # °C, bar, rpm, etc.

    # Live value (updated by polling)
    current_value = Column(String(200))
    quality = Column(String(50))                             # Good, Bad, Uncertain
    last_updated = Column(DateTime)

    # Limits for alarm
    high_limit = Column(Float)
    low_limit = Column(Float)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    server = relationship("OPCServer", back_populates="tags")
    readings = relationship("OPCTagReading", back_populates="tag", cascade="all, delete-orphan")
    ebr_mappings = relationship("OPCEBRMapping", back_populates="tag", cascade="all, delete-orphan")
    equipment_mappings = relationship("OPCEquipmentMapping", back_populates="tag", cascade="all, delete-orphan")


class OPCTagReading(Base):
    __tablename__ = "opc_tag_readings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tag_id = Column(UUID(as_uuid=True), ForeignKey("opc_tags.id", ondelete="CASCADE"), nullable=False)

    value = Column(String(200), nullable=False)
    quality = Column(String(50))
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    tag = relationship("OPCTag", back_populates="readings")


class OPCEBRMapping(Base):
    __tablename__ = "opc_ebr_mappings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tag_id = Column(UUID(as_uuid=True), ForeignKey("opc_tags.id", ondelete="CASCADE"), nullable=False)

    # What EBR field this tag maps to
    mbr_id = Column(UUID(as_uuid=True), ForeignKey("mbrs.id", ondelete="CASCADE"))
    step_title = Column(String(200))                         # Target step title
    parameter_name = Column(String(200), nullable=False)     # Target parameter name

    # Auto-fill behaviour
    auto_fill = Column(Boolean, default=False, nullable=False)
    transform_formula = Column(String(200))                  # e.g. "value * 1.8 + 32"

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    tag = relationship("OPCTag", back_populates="ebr_mappings")


class OPCEquipmentMapping(Base):
    __tablename__ = "opc_equipment_mappings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tag_id = Column(UUID(as_uuid=True), ForeignKey("opc_tags.id", ondelete="CASCADE"), nullable=False)
    equipment_id = Column(UUID(as_uuid=True), ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False)

    # Which log field this tag maps to (e.g. "temperature", "pressure", "notes")
    log_field = Column(String(200), nullable=False)
    log_type = Column(String(50))                            # Filter: only apply to this log type (optional)

    # Auto-fill behaviour
    auto_fill = Column(Boolean, default=False, nullable=False)
    transform_formula = Column(String(200))                  # e.g. "value * 1.8 + 32"

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    tag = relationship("OPCTag", back_populates="equipment_mappings")
    equipment = relationship("Equipment", back_populates="opc_mappings")
