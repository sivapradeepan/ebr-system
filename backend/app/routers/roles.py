from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import Role, Permission, User
from ..models.audit import AuditAction
from ..schemas.user import RoleOut
from ..schemas.role import RoleCreate, RoleUpdate
from ..core.audit_logger import log_event
from ..core.rbac import require_permission
from ..dependencies import get_current_user

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("", response_model=List[RoleOut])
async def list_roles(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Role).all()


@router.get("/permissions")
async def list_permissions(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    perms = db.query(Permission).all()
    return [{"id": str(p.id), "name": p.name, "description": p.description, "resource": p.resource, "action": p.action} for p in perms]


@router.post("", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("roles:create")),
):
    if db.query(Role).filter(Role.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Role name already exists")

    permissions = []
    for perm_id in payload.permission_ids:
        perm = db.query(Permission).filter(Permission.id == perm_id).first()
        if not perm:
            raise HTTPException(status_code=404, detail=f"Permission {perm_id} not found")
        permissions.append(perm)

    role = Role(name=payload.name, description=payload.description, permissions=permissions)
    db.add(role)
    db.commit()
    db.refresh(role)

    log_event(db, AuditAction.CREATE, user=current_user, resource_type="role",
              resource_id=role.id, description=f"Created role '{role.name}'", request=request)
    return role


@router.patch("/{role_id}", response_model=RoleOut)
async def update_role(
    role_id: UUID,
    payload: RoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("roles:update")),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if payload.description is not None:
        role.description = payload.description
    if payload.permission_ids is not None:
        permissions = []
        for perm_id in payload.permission_ids:
            perm = db.query(Permission).filter(Permission.id == perm_id).first()
            if not perm:
                raise HTTPException(status_code=404, detail=f"Permission {perm_id} not found")
            permissions.append(perm)
        role.permissions = permissions

    db.commit()
    db.refresh(role)
    log_event(db, AuditAction.UPDATE, user=current_user, resource_type="role",
              resource_id=role_id, description=f"Updated role '{role.name}'", request=request)
    return role


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(require_permission("roles:delete")),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=400, detail="System roles cannot be deleted")

    log_event(db, AuditAction.DELETE, user=current_user, resource_type="role",
              resource_id=role_id, description=f"Deleted role '{role.name}'", request=request)
    db.delete(role)
    db.commit()
