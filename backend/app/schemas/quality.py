from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
import uuid
from ..models.quality import (
    DeviationType, DeviationSeverity, DeviationStatus,
    CAPAType, CAPAStatus,
)


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    full_name: str
    username: str


# ─── Deviation ────────────────────────────────────────────────────────────────

class DeviationCreate(BaseModel):
    title: str
    description: str
    deviation_type: DeviationType
    severity: DeviationSeverity
    immediate_action: Optional[str] = None
    ebr_id: Optional[uuid.UUID] = None
    ebr_step_id: Optional[str] = None
    batch_number: Optional[str] = None
    product_name: Optional[str] = None


class DeviationUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deviation_type: Optional[DeviationType] = None
    severity: Optional[DeviationSeverity] = None
    immediate_action: Optional[str] = None


class InvestigatePayload(BaseModel):
    root_cause: str
    investigation_summary: str


class ResolvePayload(BaseModel):
    closure_comments: str


class CAPASummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    capa_number: str
    title: str
    capa_type: CAPAType
    status: CAPAStatus
    due_date: Optional[date]
    assigned_to: Optional[UserBrief]


class DeviationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    deviation_number: str
    title: str
    description: str
    deviation_type: DeviationType
    severity: DeviationSeverity
    status: DeviationStatus
    ebr_id: Optional[uuid.UUID]
    ebr_step_id: Optional[str]
    batch_number: Optional[str]
    product_name: Optional[str]
    immediate_action: Optional[str]
    root_cause: Optional[str]
    investigation_summary: Optional[str]
    closure_comments: Optional[str]
    detected_at: datetime
    investigated_at: Optional[datetime]
    closed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    detected_by: UserBrief
    investigated_by: Optional[UserBrief]
    closed_by: Optional[UserBrief]
    capas: list[CAPASummary]


class DeviationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    deviation_number: str
    title: str
    deviation_type: DeviationType
    severity: DeviationSeverity
    status: DeviationStatus
    batch_number: Optional[str]
    product_name: Optional[str]
    detected_at: datetime
    detected_by: UserBrief


class DeviationList(BaseModel):
    items: list[DeviationSummary]
    total: int
    page: int
    size: int


# ─── CAPA ─────────────────────────────────────────────────────────────────────

class CAPACreate(BaseModel):
    deviation_id: uuid.UUID
    title: str
    description: str
    capa_type: CAPAType
    assigned_to_id: Optional[uuid.UUID] = None
    due_date: Optional[date] = None


class CAPAUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    capa_type: Optional[CAPAType] = None
    assigned_to_id: Optional[uuid.UUID] = None
    due_date: Optional[date] = None


class CompletePayload(BaseModel):
    completion_notes: str


class VerifyPayload(BaseModel):
    effectiveness_check: str


class DeviationBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    deviation_number: str
    title: str
    severity: DeviationSeverity
    batch_number: Optional[str]


class CAPAOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    capa_number: str
    deviation_id: uuid.UUID
    title: str
    description: str
    capa_type: CAPAType
    status: CAPAStatus
    due_date: Optional[date]
    completion_notes: Optional[str]
    effectiveness_check: Optional[str]
    completed_at: Optional[datetime]
    verified_at: Optional[datetime]
    closed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    deviation: DeviationBrief
    assigned_to: Optional[UserBrief]
    completed_by: Optional[UserBrief]
    verified_by: Optional[UserBrief]
    closed_by: Optional[UserBrief]
    created_by: UserBrief


class CAPAList(BaseModel):
    items: list[CAPAOut]
    total: int
    page: int
    size: int
