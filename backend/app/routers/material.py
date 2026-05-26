from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from ..database import get_db
from ..dependencies import get_current_user
from ..core.rbac import require_permission
from ..core.audit_logger import log_event
from ..models.equipment import Material, MaterialStatus
from ..models.user import User
from ..models.audit import AuditAction
from ..schemas.material import MaterialCreate, MaterialUpdate, MaterialOut, MaterialList

router = APIRouter(prefix="/materials", tags=["Materials"])


def generate_material_code(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(func.count(Material.id)).scalar() + 1
    return f"MAT-{year}-{count:04d}"


@router.get("", response_model=MaterialList)
def list_materials(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str = Query(None),
    material_type: str = Query(None),
    status: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials:read")),
):
    q = db.query(Material)
    if search:
        s = f"%{search}%"
        q = q.filter(or_(
            Material.name.ilike(s),
            Material.material_code.ilike(s),
            Material.supplier_name.ilike(s),
            Material.cas_number.ilike(s),
        ))
    if material_type:
        q = q.filter(Material.material_type == material_type)
    if status:
        q = q.filter(Material.status == status)

    total = q.count()
    items = q.order_by(Material.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return MaterialList(items=items, total=total, page=page, size=size)


@router.post("", response_model=MaterialOut, status_code=status.HTTP_201_CREATED)
def create_material(
    payload: MaterialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials:manage")),
):
    mat = Material(
        **payload.model_dump(),
        material_code=generate_material_code(db),
        created_by_id=current_user.id,
    )
    db.add(mat)
    db.flush()
    log_event(db, AuditAction.CREATE, user=current_user,
              resource_type="material", resource_id=str(mat.id),
              description=f"Created material: {mat.name} ({mat.material_code})")
    db.commit()
    db.refresh(mat)
    return mat


@router.get("/{material_id}", response_model=MaterialOut)
def get_material(
    material_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials:read")),
):
    mat = db.query(Material).filter(Material.id == material_id).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")
    return mat


@router.put("/{material_id}", response_model=MaterialOut)
def update_material(
    material_id: str,
    payload: MaterialUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials:manage")),
):
    mat = db.query(Material).filter(Material.id == material_id).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(mat, k, v)
    mat.updated_at = datetime.utcnow()

    log_event(db, AuditAction.UPDATE, user=current_user,
              resource_type="material", resource_id=str(mat.id),
              description=f"Updated material: {mat.name}")
    db.commit()
    db.refresh(mat)
    return mat


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    material_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials:manage")),
):
    mat = db.query(Material).filter(Material.id == material_id).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")

    log_event(db, AuditAction.DELETE, user=current_user,
              resource_type="material", resource_id=str(mat.id),
              description=f"Deleted material: {mat.name} ({mat.material_code})")
    db.delete(mat)
    db.commit()
