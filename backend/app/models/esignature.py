"""
21 CFR Part 11 §11.50 Electronic Signature Components:
Each record must capture: (a) the printed name, (b) the date/time, (c) the meaning of the signature.
Passwords must be re-verified at time of signing. Records are IMMUTABLE.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..database import Base


class ESignature(Base):
    __tablename__ = "esignatures"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    signature_number = Column(String(50), unique=True, nullable=False, index=True)

    # §11.50(a) — Signatory identity (snapshot — immutable even if user is renamed)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    signer_full_name = Column(String(200), nullable=False)
    signer_username = Column(String(100), nullable=False)

    # What was signed
    resource_type = Column(String(50), nullable=False)        # "mbr", "ebr", "deviation", "capa"
    resource_id = Column(String(36), nullable=False, index=True)
    resource_identifier = Column(String(100), nullable=False) # e.g. "EBR-2026-0001"
    action = Column(String(50), nullable=False)               # "approve", "reject", "submit", "close"

    # §11.50(c) — Meaning/intent of signature
    meaning = Column(String(200), nullable=False)

    # §11.50(b) — Date and time (server-set, never client-supplied)
    signed_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Optional comments / reason
    comments = Column(Text)

    # Audit metadata
    ip_address = Column(String(45))                           # IPv4 or IPv6
    password_verified = Column(Boolean, nullable=False, default=True)  # always True if record exists

    user = relationship("User", foreign_keys=[user_id])
