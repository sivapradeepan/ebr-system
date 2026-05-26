from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, model_validator
from ..models.schedule import ScheduleStatus, SchedulePriority


class _UserSnap(BaseModel):
    id: UUID
    full_name: str
    username: str
    model_config = {"from_attributes": True}


class ScheduleCreate(BaseModel):
    mbr_id: UUID
    planned_batch_size: Optional[float] = None
    batch_unit: Optional[str] = None
    scheduled_start: datetime
    scheduled_end: datetime
    assigned_operator_id: Optional[UUID] = None
    equipment_line: Optional[str] = None
    priority: SchedulePriority = SchedulePriority.MEDIUM
    notes: Optional[str] = None

    @model_validator(mode="after")
    def end_after_start(self):
        if self.scheduled_end <= self.scheduled_start:
            raise ValueError("scheduled_end must be after scheduled_start")
        return self


class ScheduleUpdate(BaseModel):
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    assigned_operator_id: Optional[UUID] = None
    equipment_line: Optional[str] = None
    priority: Optional[SchedulePriority] = None
    notes: Optional[str] = None
    planned_batch_size: Optional[float] = None
    batch_unit: Optional[str] = None


class ScheduleOut(BaseModel):
    id: UUID
    schedule_number: str
    mbr_id: UUID
    mbr_number: str
    mbr_version: str
    product_name: str
    product_code: str
    planned_batch_size: Optional[float] = None
    batch_unit: Optional[str] = None
    scheduled_start: datetime
    scheduled_end: datetime
    equipment_line: Optional[str] = None
    status: ScheduleStatus
    priority: SchedulePriority
    notes: Optional[str] = None
    ebr_id: Optional[UUID] = None
    converted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    assigned_operator: Optional[_UserSnap] = None
    converted_by: Optional[_UserSnap] = None
    created_by: _UserSnap

    model_config = {"from_attributes": True}


class ScheduleList(BaseModel):
    items: List[ScheduleOut]
    total: int
    page: int
    size: int


class ConvertPayload(BaseModel):
    batch_number: str
    planned_batch_size: Optional[float] = None
    batch_unit: Optional[str] = None
    notes: Optional[str] = None
