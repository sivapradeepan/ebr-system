from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID
from ..models.mbr import MBRStatus


# ── Parameter ──────────────────────────────────────────────────────────────
class MBRStepParameterCreate(BaseModel):
    name: str
    unit: Optional[str] = None
    target_value: Optional[str] = None
    min_value: Optional[str] = None
    max_value: Optional[str] = None
    is_critical: bool = False
    notes: Optional[str] = None


class MBRStepParameterOut(MBRStepParameterCreate):
    id: UUID
    model_config = {"from_attributes": True}


# ── IPQC ───────────────────────────────────────────────────────────────────
class MBRStepIPQCCreate(BaseModel):
    test_name: str
    method: Optional[str] = None
    acceptance_criteria: str
    frequency: Optional[str] = None
    responsible_role: Optional[str] = None
    notes: Optional[str] = None


class MBRStepIPQCOut(MBRStepIPQCCreate):
    id: UUID
    model_config = {"from_attributes": True}


# ── Step ───────────────────────────────────────────────────────────────────
class MBRStepCreate(BaseModel):
    step_number: int
    title: str
    description: Optional[str] = None
    expected_duration_minutes: Optional[int] = None
    expected_yield: Optional[float] = None
    yield_unit: Optional[str] = None
    is_critical: bool = False
    notes: Optional[str] = None
    parameters: List[MBRStepParameterCreate] = []
    ipqcs: List[MBRStepIPQCCreate] = []


class MBRStepOut(BaseModel):
    id: UUID
    step_number: int
    title: str
    description: Optional[str] = None
    expected_duration_minutes: Optional[int] = None
    expected_yield: Optional[float] = None
    yield_unit: Optional[str] = None
    is_critical: bool
    notes: Optional[str] = None
    order: int
    parameters: List[MBRStepParameterOut] = []
    ipqcs: List[MBRStepIPQCOut] = []
    model_config = {"from_attributes": True}


# ── Material ───────────────────────────────────────────────────────────────
class MBRMaterialCreate(BaseModel):
    material_name: str
    material_code: Optional[str] = None
    quantity: float
    unit: str
    grade: Optional[str] = None
    is_active_ingredient: bool = False
    supplier: Optional[str] = None
    notes: Optional[str] = None


class MBRMaterialOut(MBRMaterialCreate):
    id: UUID
    order: int
    model_config = {"from_attributes": True}


# ── Equipment ──────────────────────────────────────────────────────────────
class MBREquipmentCreate(BaseModel):
    equipment_name: str
    equipment_code: Optional[str] = None
    capacity: Optional[str] = None
    notes: Optional[str] = None


class MBREquipmentOut(MBREquipmentCreate):
    id: UUID
    order: int
    model_config = {"from_attributes": True}


# ── MBR Create / Update ────────────────────────────────────────────────────
class MBRCreate(BaseModel):
    title: str
    product_name: str
    product_code: str
    dosage_form: Optional[str] = None
    strength: Optional[str] = None
    batch_size: Optional[float] = None
    batch_unit: Optional[str] = None
    theoretical_yield: Optional[float] = None
    yield_unit: Optional[str] = None
    description: Optional[str] = None
    storage_conditions: Optional[str] = None
    manufacturing_site: Optional[str] = None
    notes: Optional[str] = None
    materials: List[MBRMaterialCreate] = []
    equipment: List[MBREquipmentCreate] = []
    steps: List[MBRStepCreate] = []


class MBRUpdate(MBRCreate):
    pass


class WorkflowAction(BaseModel):
    comments: Optional[str] = None


# ── MBR Output ─────────────────────────────────────────────────────────────
class UserBrief(BaseModel):
    id: UUID
    username: str
    full_name: str
    model_config = {"from_attributes": True}


class MBRSummary(BaseModel):
    id: UUID
    mbr_number: str
    version: str
    title: str
    product_name: str
    product_code: str
    dosage_form: Optional[str] = None
    strength: Optional[str] = None
    batch_size: Optional[float] = None
    batch_unit: Optional[str] = None
    status: MBRStatus
    effective_date: Optional[date] = None
    created_by: UserBrief
    approved_by: Optional[UserBrief] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class MBROut(MBRSummary):
    description: Optional[str] = None
    storage_conditions: Optional[str] = None
    manufacturing_site: Optional[str] = None
    theoretical_yield: Optional[float] = None
    yield_unit: Optional[str] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None
    approved_at: Optional[datetime] = None
    parent_mbr_id: Optional[UUID] = None
    materials: List[MBRMaterialOut] = []
    equipment: List[MBREquipmentOut] = []
    steps: List[MBRStepOut] = []
    model_config = {"from_attributes": True}


class MBRList(BaseModel):
    items: List[MBRSummary]
    total: int
    page: int
    size: int
