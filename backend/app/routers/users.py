from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User, Role
from ..models.audit import AuditAction
from ..schemas.user import UserCreate, UserUpdate, UserOut, UserList
from ..core.security import hash_password
from ..core.audit_logger import log_event
from ..core.rbac import require_permission
from ..dependencies import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


def _snapshot(user: User) -> dict:
    return {"id": str(user.id), "username": user.username, "email": user.email, "full_name": user.full_name}


@router.get("", response_model=UserList)
async def list_users(
    page: int = 1,
    size: int = 20,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("users:read")),
):
    query = db.query(User)
    if search:
        query = query.filter(
            User.username.ilike(f"%{search}%") |
            User.full_name.ilike(f"%{search}%") |
            User.email.ilike(f"%{search}%")
        )
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    total = query.count()
    users = query.offset((page - 1) * size).limit(size).all()
    return UserList(items=users, total=total, page=page, size=size)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("users:create")),
):
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    roles = []
    for role_id in payload.role_ids:
        role = db.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(status_code=404, detail=f"Role {role_id} not found")
        roles.append(role)

    user = User(
        username=payload.username,
        email=str(payload.email),
        full_name=payload.full_name,
        department=payload.department,
        employee_id=payload.employee_id,
        hashed_password=hash_password(payload.password),
        created_by=current_user.id,
        roles=roles,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_event(db, AuditAction.CREATE, user=current_user, resource_type="user",
              resource_id=user.id, description=f"Created user '{user.username}'",
              new_value=_snapshot(user), request=request)
    return user


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __ = Depends(require_permission("users:read")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("users:update")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_data = _snapshot(user)
    for field, value in payload.model_dump(exclude_unset=True, exclude={"role_ids"}).items():
        setattr(user, field, value)

    if payload.role_ids is not None:
        roles = []
        for role_id in payload.role_ids:
            role = db.query(Role).filter(Role.id == role_id).first()
            if not role:
                raise HTTPException(status_code=404, detail=f"Role {role_id} not found")
            roles.append(role)
        user.roles = roles

    db.commit()
    db.refresh(user)

    log_event(db, AuditAction.UPDATE, user=current_user, resource_type="user",
              resource_id=user_id, description=f"Updated user '{user.username}'",
              old_value=old_data, new_value=_snapshot(user), request=request)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("users:delete")),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    log_event(db, AuditAction.DELETE, user=current_user, resource_type="user",
              resource_id=user_id, description=f"Deleted user '{user.username}'",
              old_value=_snapshot(user), request=request)
    db.delete(user)
    db.commit()


@router.post("/{user_id}/unlock")
async def unlock_user(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("users:update")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_locked = False
    user.failed_login_attempts = 0
    user.locked_at = None
    db.commit()
    log_event(db, AuditAction.UPDATE, user=current_user, resource_type="user",
              resource_id=user_id, description=f"Unlocked user '{user.username}'", request=request)
    return {"message": "User unlocked successfully"}
