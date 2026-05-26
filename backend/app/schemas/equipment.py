from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
import uuid
from ..models.equipment import EquipmentStatus, LogType, LogOutcome, CleaningStatus


class EquipmentCreate(BaseModel):
    name: str
    category: str
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None
    status: EquipmentStatus = EquipmentStatus.ACTIVE
    last_calibration_date: Optional[date] = None
    calibration_due_date: Optional[date] = None
    calibration_certificate: Optional[str] = None
    last_maintenance_date: Optional[date] = None
    next_maintenance_date: Optional[date] = None
    maintenance_interval_days: Optional[int] = None
    notes: Optional[str] = None


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None
    status: Optional[EquipmentStatus] = None
    last_calibration_date: Optional[date] = None
    calibration_due_date: Optional[date] = None
    calibration_certificate: Optional[str] = None
    last_maintenance_date: Optional[date] = None
    next_maintenance_date: Optional[date] = None
    maintenance_interval_days: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    full_name: str
    username: str


class EquipmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    equipment_id: str
    name: str
    category: str
    manufacturer: Optional[str]
    model_number: Optional[str]
    serial_number: Optional[str]
    location: Optional[str]
    status: EquipmentStatus
    last_calibration_date: Optional[date]
    calibration_due_date: Optional[date]
    calibration_certificate: Optional[str]
    last_maintenance_date: Optional[date]
    next_maintenance_date: Optional[date]
    maintenance_interval_days: Optional[int]
    notes: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UserBrief]
    cleaning_status: CleaningStatus
    cleaning_status_updated_at: Optional[datetime]


class EquipmentList(BaseModel):
    items: list[EquipmentOut]
    total: int
    page: int
    size: int


class EquipmentLogCreate(BaseModel):
    log_type: LogType
    outcome: LogOutcome = LogOutcome.PASS
    title: str
    description: Optional[str] = None
    performed_by: Optional[str] = None
    performed_date: date
    next_due_date: Optional[date] = None
    certificate_number: Optional[str] = None
    cost: Optional[str] = None
    downtime_hours: Optional[int] = None
    notes: Optional[str] = None


class EquipmentLogUpdate(BaseModel):
    log_type: Optional[LogType] = None
    outcome: Optional[LogOutcome] = None
    title: Optional[str] = None
    description: Optional[str] = None
    performed_by: Optional[str] = None
    performed_date: Optional[date] = None
    next_due_date: Optional[date] = None
    certificate_number: Optional[str] = None
    cost: Optional[str] = None
    downtime_hours: Optional[int] = None
    notes: Optional[str] = None


class EquipmentLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    equipment_id: uuid.UUID
    log_type: LogType
    outcome: LogOutcome
    title: str
    description: Optional[str]
    performed_by: Optional[str]
    performed_date: date
    next_due_date: Optional[date]
    certificate_number: Optional[str]
    cost: Optional[str]
    downtime_hours: Optional[int]
    notes: Optional[str]
    created_at: datetime
    created_by: Optional[UserBrief]


class EquipmentLogList(BaseModel):
    items: list[EquipmentLogOut]
    total: int


class CleaningLogCreate(BaseModel):
    status_to: CleaningStatus
    cleaning_method: Optional[str] = None
    cleaning_agent: Optional[str] = None
    performed_by: Optional[str] = None
    performed_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    batch_number: Optional[str] = None
    notes: Optional[str] = None


class CleaningLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    equipment_id: uuid.UUID
    status_from: Optional[CleaningStatus]
    status_to: CleaningStatus
    cleaning_method: Optional[str]
    cleaning_agent: Optional[str]
    performed_by: Optional[str]
    performed_at: datetime
    verified_by: Optional[str]
    verified_at: Optional[datetime]
    batch_number: Optional[str]
    notes: Optional[str]
    created_at: datetime
    created_by: Optional[UserBrief]


class CleaningLogList(BaseModel):
    items: list[CleaningLogOut]
    total: int
