from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID


class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permission_ids: List[UUID] = []


class RoleUpdate(BaseModel):
    description: Optional[str] = None
    permission_ids: Optional[List[UUID]] = None
