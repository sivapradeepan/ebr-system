from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
import uuid


class SignPayload(BaseModel):
    resource_type: str          # "mbr", "ebr", "deviation", "capa"
    resource_id: uuid.UUID
    action: str                 # "submit", "approve", "reject", "close"
    meaning: str                # selected meaning/intent
    comments: Optional[str] = None
    password: str               # re-authentication — 21 CFR §11.200(a)(1)


class ESignatureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    signature_number: str
    signer_full_name: str
    signer_username: str
    resource_type: str
    resource_id: str
    resource_identifier: str
    action: str
    meaning: str
    comments: Optional[str]
    signed_at: datetime
    ip_address: Optional[str]
    password_verified: bool


class ESignatureList(BaseModel):
    items: list[ESignatureOut]
    total: int
