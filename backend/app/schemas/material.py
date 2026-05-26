from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
import uuid
from ..models.equipment import MaterialType, MaterialStatus


class MaterialCreate(BaseModel):
    name: str
    material_type: MaterialType
    cas_number: Optional[str] = None
    pharmacopoeia_standard: Optional[str] = None
    grade: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_code: Optional[str] = None
    manufacturer_name: Optional[str] = None
    unit_of_measure: str
    storage_conditions: Optional[str] = None
    shelf_life_days: Optional[int] = None
    reorder_point: Optional[str] = None
    notes: Optional[str] = None


class MaterialUpdate(BaseModel):
    name: Optional[str] = None
    material_type: Optional[MaterialType] = None
    cas_number: Optional[str] = None
    pharmacopoeia_standard: Optional[str] = None
    grade: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_code: Optional[str] = None
    manufacturer_name: Optional[str] = None
    unit_of_measure: Optional[str] = None
    storage_conditions: Optional[str] = None
    shelf_life_days: Optional[int] = None
    reorder_point: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[MaterialStatus] = None


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    full_name: str
    username: str


class MaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    material_code: str
    name: str
    material_type: MaterialType
    cas_number: Optional[str]
    pharmacopoeia_standard: Optional[str]
    grade: Optional[str]
    supplier_name: Optional[str]
    supplier_code: Optional[str]
    manufacturer_name: Optional[str]
    unit_of_measure: str
    storage_conditions: Optional[str]
    shelf_life_days: Optional[int]
    reorder_point: Optional[str]
    notes: Optional[str]
    status: MaterialStatus
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UserBrief]


class MaterialList(BaseModel):
    items: list[MaterialOut]
    total: int
    page: int
    size: int
