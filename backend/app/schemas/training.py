from datetime import date, datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from ..models.training import TrainingType, TrainingStatus


class _UserSnap(BaseModel):
    id: UUID
    full_name: str
    username: str
    model_config = {"from_attributes": True}


class TrainingCreate(BaseModel):
    trainee_id: UUID
    training_type: TrainingType
    title: str
    description: Optional[str] = None
    reference_doc: Optional[str] = None
    training_date: date
    expiry_date: Optional[date] = None
    trainer_id: Optional[UUID] = None
    trainer_name: Optional[str] = None
    passed: Optional[bool] = None
    score: Optional[float] = None
    notes: Optional[str] = None


class TrainingUpdate(BaseModel):
    training_type: Optional[TrainingType] = None
    title: Optional[str] = None
    description: Optional[str] = None
    reference_doc: Optional[str] = None
    training_date: Optional[date] = None
    expiry_date: Optional[date] = None
    trainer_id: Optional[UUID] = None
    trainer_name: Optional[str] = None
    passed: Optional[bool] = None
    score: Optional[float] = None
    notes: Optional[str] = None


class TrainingOut(BaseModel):
    id: UUID
    record_number: str
    training_type: TrainingType
    title: str
    description: Optional[str] = None
    reference_doc: Optional[str] = None
    training_date: date
    expiry_date: Optional[date] = None
    passed: Optional[bool] = None
    score: Optional[float] = None
    notes: Optional[str] = None
    status: TrainingStatus
    created_at: datetime
    updated_at: datetime
    trainee: _UserSnap
    trainer: Optional[_UserSnap] = None
    trainer_name: Optional[str] = None
    created_by: _UserSnap

    model_config = {"from_attributes": True}


class TrainingList(BaseModel):
    items: List[TrainingOut]
    total: int
    page: int
    size: int


# ── Qualification Matrix ───────────────────────────────────────────────────────

class MatrixCell(BaseModel):
    record_id: Optional[UUID] = None
    status: Optional[TrainingStatus] = None   # None = not trained
    title: Optional[str] = None
    training_date: Optional[date] = None
    expiry_date: Optional[date] = None


class MatrixRow(BaseModel):
    training_type: TrainingType
    label: str
    operators: dict[str, MatrixCell]   # keyed by user_id (str)


class QualificationMatrix(BaseModel):
    operators: List[_UserSnap]
    rows: List[MatrixRow]
    summary: dict[str, dict]           # user_id → {current, due_soon, expired, total}
