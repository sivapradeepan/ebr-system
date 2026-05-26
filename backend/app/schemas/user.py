import re
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class PermissionOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    resource: str
    action: str

    model_config = {"from_attributes": True}


class RoleOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    is_system: bool
    permissions: List[PermissionOut] = []

    model_config = {"from_attributes": True}


class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    department: Optional[str] = None
    employee_id: Optional[str] = None


class UserCreate(UserBase):
    password: str
    role_ids: List[UUID] = []

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    department: Optional[str] = None
    employee_id: Optional[str] = None
    is_active: Optional[bool] = None
    role_ids: Optional[List[UUID]] = None


class UserOut(UserBase):
    id: UUID
    is_active: bool
    is_locked: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    roles: List[RoleOut] = []

    model_config = {"from_attributes": True}


class UserList(BaseModel):
    items: List[UserOut]
    total: int
    page: int
    size: int
