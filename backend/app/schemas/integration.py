from __future__ import annotations
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

from ..models.integration import (
    IDocDirection, IDocStatus, IDocType, IDocConnStatus,
    OPCSecurityMode, OPCConnStatus, OPCDataType,
)


# ── IDoc Schemas ──────────────────────────────────────────────────────────────

class IDocConnectionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sap_host: str
    sap_system_number: str
    sap_client: str
    sap_user: str
    sap_password: str
    rfc_destination: Optional[str] = None
    partner_number: Optional[str] = None
    inbound_enabled: bool = True
    outbound_enabled: bool = True
    auto_process: bool = False
    simulation_mode: bool = False


class IDocConnectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sap_host: Optional[str] = None
    sap_system_number: Optional[str] = None
    sap_client: Optional[str] = None
    sap_user: Optional[str] = None
    sap_password: Optional[str] = None
    rfc_destination: Optional[str] = None
    partner_number: Optional[str] = None
    inbound_enabled: Optional[bool] = None
    outbound_enabled: Optional[bool] = None
    auto_process: Optional[bool] = None
    simulation_mode: Optional[bool] = None
    is_active: Optional[bool] = None


class IDocConnectionOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    sap_host: str
    sap_system_number: str
    sap_client: str
    sap_user: str
    rfc_destination: Optional[str]
    partner_number: Optional[str]
    inbound_enabled: bool
    outbound_enabled: bool
    auto_process: bool
    simulation_mode: bool
    status: IDocConnStatus
    last_connected_at: Optional[datetime]
    last_error: Optional[str]
    is_active: bool
    created_at: datetime
    message_count: Optional[int] = 0

    class Config:
        from_attributes = True


class IDocConnectionList(BaseModel):
    items: List[IDocConnectionOut]
    total: int


class IDocMessageCreate(BaseModel):
    connection_id: UUID
    direction: IDocDirection
    idoc_type: IDocType
    idoc_number: Optional[str] = None
    message_type: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    payload: Optional[Any] = None


class IDocMessageOut(BaseModel):
    id: UUID
    connection_id: UUID
    direction: IDocDirection
    idoc_type: IDocType
    idoc_number: Optional[str]
    message_type: Optional[str]
    status: IDocStatus
    error_message: Optional[str]
    retry_count: int
    reference_type: Optional[str]
    reference_id: Optional[str]
    payload: Optional[Any]
    processed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class IDocMessageList(BaseModel):
    items: List[IDocMessageOut]
    total: int


# ── OPC Schemas ───────────────────────────────────────────────────────────────

class OPCServerCreate(BaseModel):
    name: str
    description: Optional[str] = None
    endpoint_url: str
    security_mode: OPCSecurityMode = OPCSecurityMode.NONE
    username: Optional[str] = None
    password: Optional[str] = None
    certificate_path: Optional[str] = None
    polling_interval_ms: int = 1000
    connection_timeout_s: int = 10
    simulation_mode: bool = False


class OPCServerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    endpoint_url: Optional[str] = None
    security_mode: Optional[OPCSecurityMode] = None
    username: Optional[str] = None
    password: Optional[str] = None
    certificate_path: Optional[str] = None
    polling_interval_ms: Optional[int] = None
    connection_timeout_s: Optional[int] = None
    simulation_mode: Optional[bool] = None
    is_active: Optional[bool] = None


class OPCServerOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    endpoint_url: str
    security_mode: OPCSecurityMode
    username: Optional[str]
    polling_interval_ms: int
    connection_timeout_s: int
    simulation_mode: bool
    status: OPCConnStatus
    last_connected_at: Optional[datetime]
    last_error: Optional[str]
    is_active: bool
    created_at: datetime
    tag_count: Optional[int] = 0

    class Config:
        from_attributes = True


class OPCServerList(BaseModel):
    items: List[OPCServerOut]
    total: int


class OPCTagCreate(BaseModel):
    server_id: UUID
    node_id: str
    display_name: str
    description: Optional[str] = None
    data_type: OPCDataType = OPCDataType.FLOAT
    unit: Optional[str] = None
    high_limit: Optional[float] = None
    low_limit: Optional[float] = None


class OPCTagUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    data_type: Optional[OPCDataType] = None
    unit: Optional[str] = None
    high_limit: Optional[float] = None
    low_limit: Optional[float] = None
    is_active: Optional[bool] = None


class OPCTagOut(BaseModel):
    id: UUID
    server_id: UUID
    node_id: str
    display_name: str
    description: Optional[str]
    data_type: OPCDataType
    unit: Optional[str]
    current_value: Optional[str]
    quality: Optional[str]
    last_updated: Optional[datetime]
    high_limit: Optional[float]
    low_limit: Optional[float]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class OPCTagList(BaseModel):
    items: List[OPCTagOut]
    total: int


class OPCTagReadingOut(BaseModel):
    id: UUID
    tag_id: UUID
    value: str
    quality: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True


class OPCEBRMappingCreate(BaseModel):
    tag_id: UUID
    mbr_id: Optional[UUID] = None
    step_title: Optional[str] = None
    parameter_name: str
    auto_fill: bool = False
    transform_formula: Optional[str] = None


class OPCEBRMappingOut(BaseModel):
    id: UUID
    tag_id: UUID
    mbr_id: Optional[UUID]
    step_title: Optional[str]
    parameter_name: str
    auto_fill: bool
    transform_formula: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class OPCEquipmentMappingCreate(BaseModel):
    tag_id: UUID
    equipment_id: UUID
    log_field: str
    log_type: Optional[str] = None
    auto_fill: bool = False
    transform_formula: Optional[str] = None


class OPCEquipmentMappingUpdate(BaseModel):
    log_field: Optional[str] = None
    log_type: Optional[str] = None
    auto_fill: Optional[bool] = None
    transform_formula: Optional[str] = None
    is_active: Optional[bool] = None


class OPCEquipmentMappingOut(BaseModel):
    id: UUID
    tag_id: UUID
    equipment_id: UUID
    log_field: str
    log_type: Optional[str]
    auto_fill: bool
    transform_formula: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
