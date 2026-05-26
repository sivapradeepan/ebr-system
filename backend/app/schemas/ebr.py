from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID
from ..models.ebr import EBRStatus, EBRStepStatus


class UserBrief(BaseModel):
    id: UUID
    username: str
    full_name: str
    model_config = {"from_attributes": True}


# ── Parameter Result ────────────────────────────────────────────────────────
class EBRParameterResultOut(BaseModel):
    id: UUID
    parameter_name: str
    unit: Optional[str] = None
    target_value: Optional[str] = None
    min_value: Optional[str] = None
    max_value: Optional[str] = None
    is_critical: bool
    actual_value: Optional[str] = None
    is_in_range: Optional[bool] = None
    recorded_by: Optional[UserBrief] = None
    recorded_at: Optional[datetime] = None
    notes: Optional[str] = None
    model_config = {"from_attributes": True}


class ParameterRecordPayload(BaseModel):
    id: UUID
    actual_value: Optional[str] = None
    notes: Optional[str] = None


# ── IPQC Result ─────────────────────────────────────────────────────────────
class EBRIPQCResultOut(BaseModel):
    id: UUID
    test_name: str
    method: Optional[str] = None
    acceptance_criteria: str
    frequency: Optional[str] = None
    responsible_role: Optional[str] = None
    actual_result: Optional[str] = None
    passed: Optional[bool] = None
    performed_by: Optional[UserBrief] = None
    performed_at: Optional[datetime] = None
    notes: Optional[str] = None
    model_config = {"from_attributes": True}


class IPQCRecordPayload(BaseModel):
    id: UUID
    actual_result: Optional[str] = None
    passed: Optional[bool] = None
    notes: Optional[str] = None


# ── Step ────────────────────────────────────────────────────────────────────
class EBRStepOut(BaseModel):
    id: UUID
    step_number: int
    title: str
    description: Optional[str] = None
    is_critical: bool
    expected_duration_minutes: Optional[int] = None
    expected_yield: Optional[float] = None
    yield_unit: Optional[str] = None
    order: int
    status: EBRStepStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    actual_yield: Optional[float] = None
    operator: Optional[UserBrief] = None
    operator_signed_at: Optional[datetime] = None
    execution_notes: Optional[str] = None
    parameter_results: List[EBRParameterResultOut] = []
    ipqc_results: List[EBRIPQCResultOut] = []
    model_config = {"from_attributes": True}


class CompleteStepPayload(BaseModel):
    actual_yield: Optional[float] = None
    execution_notes: Optional[str] = None
    parameters: List[ParameterRecordPayload] = []
    ipqcs: List[IPQCRecordPayload] = []


class SaveStepPayload(BaseModel):
    actual_yield: Optional[float] = None
    execution_notes: Optional[str] = None
    parameters: List[ParameterRecordPayload] = []
    ipqcs: List[IPQCRecordPayload] = []


# ── Material ────────────────────────────────────────────────────────────────
class EBRMaterialDispensingOut(BaseModel):
    id: UUID
    material_name: str
    material_code: Optional[str] = None
    required_quantity: float
    unit: str
    grade: Optional[str] = None
    is_active_ingredient: bool
    order: int
    actual_quantity: Optional[float] = None
    lot_number: Optional[str] = None
    expiry_date: Optional[date] = None
    dispensed_by: Optional[UserBrief] = None
    dispensed_at: Optional[datetime] = None
    is_dispensed: bool
    notes: Optional[str] = None
    model_config = {"from_attributes": True}


class DispenseMaterialPayload(BaseModel):
    actual_quantity: float
    lot_number: str
    expiry_date: Optional[date] = None
    notes: Optional[str] = None


# ── EBR Create / Actions ────────────────────────────────────────────────────
class EBRCreate(BaseModel):
    mbr_id: UUID
    batch_number: str
    planned_batch_size: Optional[float] = None
    batch_unit: Optional[str] = None
    notes: Optional[str] = None


class FinalizePayload(BaseModel):
    actual_yield: Optional[float] = None
    actual_yield_unit: Optional[str] = None
    notes: Optional[str] = None


class WorkflowAction(BaseModel):
    comments: Optional[str] = None


# ── EBR Output ──────────────────────────────────────────────────────────────
class EBRSummary(BaseModel):
    id: UUID
    ebr_number: str
    batch_number: str
    mbr_number: str
    mbr_version: str
    product_name: str
    product_code: str
    strength: Optional[str] = None
    dosage_form: Optional[str] = None
    status: EBRStatus
    planned_batch_size: Optional[float] = None
    batch_unit: Optional[str] = None
    actual_yield: Optional[float] = None
    actual_yield_unit: Optional[str] = None
    yield_percentage: Optional[float] = None
    initiated_by: UserBrief
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class EBROut(EBRSummary):
    notes: Optional[str] = None
    reviewed_by: Optional[UserBrief] = None
    reviewed_at: Optional[datetime] = None
    approved_by: Optional[UserBrief] = None
    approved_at: Optional[datetime] = None
    steps: List[EBRStepOut] = []
    materials: List[EBRMaterialDispensingOut] = []
    model_config = {"from_attributes": True}


class EBRList(BaseModel):
    items: List[EBRSummary]
    total: int
    page: int
    size: int
