from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.user import User
from ..models.audit import AuditAction, AuditStatus
from ..core.security import verify_password, create_access_token, create_refresh_token, decode_token
from ..core.audit_logger import log_event
from ..dependencies import get_current_user
from ..config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.username == payload.username) | (User.email == payload.username)
    ).first()

    if user and user.is_locked:
        if user.locked_at and (datetime.utcnow() - user.locked_at.replace(tzinfo=None)) > timedelta(minutes=settings.ACCOUNT_LOCKOUT_MINUTES):
            user.is_locked = False
            user.failed_login_attempts = 0
            user.locked_at = None
            db.commit()
        else:
            log_event(db, AuditAction.LOGIN_FAILED, user=user,
                      description="Login attempt on locked account", status=AuditStatus.FAILURE, request=request)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Account is locked. Contact your administrator.")

    if not user or not verify_password(payload.password, user.hashed_password):
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
                user.is_locked = True
                user.locked_at = datetime.utcnow()
                db.commit()
                log_event(db, AuditAction.ACCOUNT_LOCKED, user=user,
                          description=f"Account locked after {settings.MAX_LOGIN_ATTEMPTS} failed attempts", request=request)
            else:
                db.commit()
        log_event(db, AuditAction.LOGIN_FAILED, username=payload.username,
                  description="Invalid credentials", status=AuditStatus.FAILURE, request=request)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    user.failed_login_attempts = 0
    user.last_login = datetime.utcnow()
    db.commit()

    token_data = {"sub": str(user.id), "username": user.username}
    log_event(db, AuditAction.LOGIN, user=user, description="Successful login", request=request)

    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user={
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "roles": [{"id": str(r.id), "name": r.name} for r in user.roles],
            "permissions": list({p.name for r in user.roles for p in r.permissions}),
        },
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    token_data = decode_token(payload.refresh_token)
    if not token_data or token_data.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = db.query(User).filter(User.id == token_data.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    new_data = {"sub": str(user.id), "username": user.username}
    return TokenResponse(
        access_token=create_access_token(new_data),
        refresh_token=create_refresh_token(new_data),
        user={
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "roles": [{"id": str(r.id), "name": r.name} for r in user.roles],
            "permissions": list({p.name for r in user.roles for p in r.permissions}),
        },
    )


@router.post("/logout")
async def logout(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log_event(db, AuditAction.LOGOUT, user=current_user, description="User logged out", request=request)
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "department": current_user.department,
        "employee_id": current_user.employee_id,
        "last_login": current_user.last_login,
        "roles": [{"id": str(r.id), "name": r.name} for r in current_user.roles],
        "permissions": list({p.name for r in current_user.roles for p in r.permissions}),
    }
