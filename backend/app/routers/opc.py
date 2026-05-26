import random
import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..dependencies import get_current_user
from ..core.rbac import require_permission
from ..models.user import User
from ..models.integration import (
    OPCServer, OPCTag, OPCTagReading, OPCEBRMapping, OPCEquipmentMapping,
    OPCConnStatus, OPCDataType,
)
from ..models.equipment import Equipment
from ..schemas.integration import (
    OPCServerCreate, OPCServerUpdate, OPCServerOut, OPCServerList,
    OPCTagCreate, OPCTagUpdate, OPCTagOut, OPCTagList,
    OPCTagReadingOut, OPCEBRMappingCreate, OPCEBRMappingOut,
    OPCEquipmentMappingCreate, OPCEquipmentMappingUpdate, OPCEquipmentMappingOut,
)

router = APIRouter(prefix="/integrations/opc", tags=["OPC Integration"])

# Simulated tag value generators keyed by data_type
def _sim_value(tag: OPCTag) -> str:
    name_lower = tag.display_name.lower()
    if tag.data_type == OPCDataType.BOOLEAN:
        return str(random.choice([True, False])).lower()
    if tag.data_type == OPCDataType.STRING:
        return random.choice(["Running", "Idle", "Fault", "Standby"])
    if tag.data_type == OPCDataType.DATETIME:
        return datetime.utcnow().isoformat()
    # Numeric — use context-aware ranges
    if "temp" in name_lower:
        base, noise = 25.0, 2.0
    elif "pressure" in name_lower:
        base, noise = 1.013, 0.05
    elif "speed" in name_lower or "rpm" in name_lower:
        base, noise = 1500.0, 50.0
    elif "humidity" in name_lower:
        base, noise = 45.0, 5.0
    elif "flow" in name_lower:
        base, noise = 10.0, 1.0
    elif "weight" in name_lower or "mass" in name_lower:
        base, noise = 100.0, 0.5
    elif "ph" in name_lower:
        base, noise = 7.0, 0.2
    else:
        lo = tag.low_limit if tag.low_limit is not None else 0.0
        hi = tag.high_limit if tag.high_limit is not None else 100.0
        base, noise = (lo + hi) / 2, (hi - lo) * 0.05
    val = base + random.uniform(-noise, noise)
    # Integer types
    if tag.data_type in (OPCDataType.INT16, OPCDataType.INT32, OPCDataType.INT64):
        return str(int(val))
    return f"{val:.3f}"


def _server_out(srv: OPCServer, db: Session) -> OPCServerOut:
    count = db.query(func.count(OPCTag.id)).filter(OPCTag.server_id == srv.id).scalar()
    out = OPCServerOut.model_validate(srv)
    out.tag_count = count
    return out


# ── Servers ─────────────────────────────��─────────────────────────────────────

@router.get("/servers", response_model=OPCServerList)
def list_servers(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:read")),
):
    q = db.query(OPCServer)
    total = q.count()
    items = q.order_by(OPCServer.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return OPCServerList(items=[_server_out(s, db) for s in items], total=total)


@router.post("/servers", response_model=OPCServerOut, status_code=status.HTTP_201_CREATED)
def create_server(
    payload: OPCServerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    if db.query(OPCServer).filter(OPCServer.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Server name already exists")
    srv = OPCServer(**payload.model_dump(), created_by_id=current_user.id)
    db.add(srv)
    db.commit()
    db.refresh(srv)
    return _server_out(srv, db)


@router.get("/servers/{server_id}", response_model=OPCServerOut)
def get_server(
    server_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:read")),
):
    srv = db.query(OPCServer).filter(OPCServer.id == server_id).first()
    if not srv:
        raise HTTPException(status_code=404, detail="Server not found")
    return _server_out(srv, db)


@router.patch("/servers/{server_id}", response_model=OPCServerOut)
def update_server(
    server_id: str,
    payload: OPCServerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    srv = db.query(OPCServer).filter(OPCServer.id == server_id).first()
    if not srv:
        raise HTTPException(status_code=404, detail="Server not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(srv, field, value)
    db.commit()
    db.refresh(srv)
    return _server_out(srv, db)


@router.delete("/servers/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_server(
    server_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    srv = db.query(OPCServer).filter(OPCServer.id == server_id).first()
    if not srv:
        raise HTTPException(status_code=404, detail="Server not found")
    db.delete(srv)
    db.commit()


@router.post("/servers/{server_id}/connect")
def connect_server(
    server_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    srv = db.query(OPCServer).filter(OPCServer.id == server_id).first()
    if not srv:
        raise HTTPException(status_code=404, detail="Server not found")

    if srv.simulation_mode:
        srv.status = OPCConnStatus.CONNECTED
        srv.last_connected_at = datetime.utcnow()
        srv.last_error = None
        db.commit()
        return {"success": True, "message": "Simulation mode: connected successfully", "simulated": True}

    srv.status = OPCConnStatus.ERROR
    srv.last_error = "Real OPC-UA connectivity not configured — enable simulation mode to test"
    db.commit()
    return {"success": False, "message": srv.last_error, "simulated": False}


@router.post("/servers/{server_id}/disconnect")
def disconnect_server(
    server_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    srv = db.query(OPCServer).filter(OPCServer.id == server_id).first()
    if not srv:
        raise HTTPException(status_code=404, detail="Server not found")
    srv.status = OPCConnStatus.DISCONNECTED
    db.commit()
    return {"success": True, "message": "Disconnected"}


@router.post("/servers/{server_id}/simulate-tags")
def simulate_default_tags(
    server_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    """Seed a set of typical pharma process tags for simulation."""
    srv = db.query(OPCServer).filter(OPCServer.id == server_id).first()
    if not srv:
        raise HTTPException(status_code=404, detail="Server not found")
    if not srv.simulation_mode:
        raise HTTPException(status_code=400, detail="Simulation mode is not enabled")

    default_tags = [
        {"node_id": "ns=2;s=Reactor1.Temperature",   "display_name": "Reactor 1 Temperature",   "data_type": OPCDataType.DOUBLE, "unit": "°C",  "low_limit": 20.0,  "high_limit": 80.0},
        {"node_id": "ns=2;s=Reactor1.Pressure",      "display_name": "Reactor 1 Pressure",       "data_type": OPCDataType.DOUBLE, "unit": "bar", "low_limit": 0.9,   "high_limit": 1.5},
        {"node_id": "ns=2;s=Mixer1.Speed",            "display_name": "Mixer 1 Speed",            "data_type": OPCDataType.INT32,  "unit": "rpm", "low_limit": 500.0, "high_limit": 3000.0},
        {"node_id": "ns=2;s=Granulator.Temperature",  "display_name": "Granulator Temperature",   "data_type": OPCDataType.DOUBLE, "unit": "°C",  "low_limit": 40.0,  "high_limit": 90.0},
        {"node_id": "ns=2;s=Granulator.HumidityIn",   "display_name": "Inlet Air Humidity",       "data_type": OPCDataType.DOUBLE, "unit": "%RH", "low_limit": 20.0,  "high_limit": 70.0},
        {"node_id": "ns=2;s=Scale1.Weight",            "display_name": "Dispensing Scale Weight",  "data_type": OPCDataType.DOUBLE, "unit": "kg",  "low_limit": 0.0,   "high_limit": 500.0},
        {"node_id": "ns=2;s=TabletPress.Speed",        "display_name": "Tablet Press Speed",       "data_type": OPCDataType.INT32,  "unit": "rpm", "low_limit": 10.0,  "high_limit": 60.0},
        {"node_id": "ns=2;s=TabletPress.Hardness",     "display_name": "Tablet Hardness",          "data_type": OPCDataType.DOUBLE, "unit": "N",   "low_limit": 30.0,  "high_limit": 150.0},
        {"node_id": "ns=2;s=CoatingPan.Temperature",   "display_name": "Coating Pan Temperature",  "data_type": OPCDataType.DOUBLE, "unit": "°C",  "low_limit": 35.0,  "high_limit": 55.0},
        {"node_id": "ns=2;s=CoatingPan.Speed",         "display_name": "Coating Pan Speed",        "data_type": OPCDataType.INT32,  "unit": "rpm", "low_limit": 2.0,   "high_limit": 20.0},
        {"node_id": "ns=2;s=WFI.pH",                   "display_name": "WFI pH",                   "data_type": OPCDataType.DOUBLE, "unit": "pH",  "low_limit": 5.0,   "high_limit": 7.0},
        {"node_id": "ns=2;s=WFI.FlowRate",             "display_name": "WFI Flow Rate",            "data_type": OPCDataType.DOUBLE, "unit": "L/h", "low_limit": 0.0,   "high_limit": 100.0},
    ]

    created = 0
    for t in default_tags:
        exists = db.query(OPCTag).filter(OPCTag.server_id == srv.id, OPCTag.node_id == t["node_id"]).first()
        if not exists:
            tag = OPCTag(server_id=srv.id, **t)
            db.add(tag)
            created += 1
    db.commit()
    return {"created": created, "message": f"Added {created} default simulation tags"}


# ── Tags ──────────────────────────────────────────────────────────────��───────

@router.get("/tags", response_model=OPCTagList)
def list_tags(
    server_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:read")),
):
    q = db.query(OPCTag)
    if server_id:
        q = q.filter(OPCTag.server_id == server_id)
    total = q.count()
    items = q.order_by(OPCTag.display_name).offset((page - 1) * size).limit(size).all()
    return OPCTagList(items=items, total=total)


@router.post("/tags", response_model=OPCTagOut, status_code=status.HTTP_201_CREATED)
def create_tag(
    payload: OPCTagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    srv = db.query(OPCServer).filter(OPCServer.id == str(payload.server_id)).first()
    if not srv:
        raise HTTPException(status_code=404, detail="Server not found")
    tag = OPCTag(**payload.model_dump())
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.patch("/tags/{tag_id}", response_model=OPCTagOut)
def update_tag(
    tag_id: str,
    payload: OPCTagUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    tag = db.query(OPCTag).filter(OPCTag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tag, field, value)
    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(
    tag_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    tag = db.query(OPCTag).filter(OPCTag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    db.commit()


@router.post("/tags/{tag_id}/refresh")
def refresh_tag(
    tag_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:read")),
):
    """Read current value for a single tag (simulated or real)."""
    tag = db.query(OPCTag).filter(OPCTag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    srv = db.query(OPCServer).filter(OPCServer.id == str(tag.server_id)).first()
    if srv and srv.simulation_mode:
        value = _sim_value(tag)
        quality = "Good"
    else:
        return {"success": False, "message": "Real OPC read not configured"}

    tag.current_value = value
    tag.quality = quality
    tag.last_updated = datetime.utcnow()

    reading = OPCTagReading(tag_id=tag.id, value=value, quality=quality)
    db.add(reading)
    db.commit()
    db.refresh(tag)
    return {"success": True, "value": value, "quality": quality, "timestamp": tag.last_updated}


@router.post("/servers/{server_id}/refresh-all")
def refresh_all_tags(
    server_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:read")),
):
    """Refresh live values for all active tags on this server."""
    srv = db.query(OPCServer).filter(OPCServer.id == server_id).first()
    if not srv:
        raise HTTPException(status_code=404, detail="Server not found")
    if not srv.simulation_mode:
        return {"success": False, "message": "Real OPC polling not configured"}

    tags = db.query(OPCTag).filter(OPCTag.server_id == server_id, OPCTag.is_active == True).all()
    now = datetime.utcnow()
    updated = 0
    for tag in tags:
        value = _sim_value(tag)
        tag.current_value = value
        tag.quality = "Good"
        tag.last_updated = now
        db.add(OPCTagReading(tag_id=tag.id, value=value, quality="Good", timestamp=now))
        updated += 1
    db.commit()
    return {"success": True, "updated": updated}


@router.get("/tags/{tag_id}/history", response_model=list)
def tag_history(
    tag_id: str,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:read")),
):
    tag = db.query(OPCTag).filter(OPCTag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    readings = (
        db.query(OPCTagReading)
        .filter(OPCTagReading.tag_id == tag_id)
        .order_by(OPCTagReading.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [OPCTagReadingOut.model_validate(r) for r in readings]


# ── EBR Mappings ────────────────────────────��─────────────────────────────────

@router.get("/mappings", response_model=list)
def list_mappings(
    tag_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:read")),
):
    q = db.query(OPCEBRMapping)
    if tag_id:
        q = q.filter(OPCEBRMapping.tag_id == tag_id)
    return [OPCEBRMappingOut.model_validate(m) for m in q.all()]


@router.post("/mappings", response_model=OPCEBRMappingOut, status_code=status.HTTP_201_CREATED)
def create_mapping(
    payload: OPCEBRMappingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    tag = db.query(OPCTag).filter(OPCTag.id == str(payload.tag_id)).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    mapping = OPCEBRMapping(**payload.model_dump())
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return mapping


@router.delete("/mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mapping(
    mapping_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    m = db.query(OPCEBRMapping).filter(OPCEBRMapping.id == mapping_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Mapping not found")
    db.delete(m)
    db.commit()


# ── Equipment Mappings ────────────────────────────────────────────────────────

@router.get("/equipment-mappings", response_model=list)
def list_equipment_mappings(
    equipment_id: Optional[str] = Query(None),
    tag_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:read")),
):
    q = db.query(OPCEquipmentMapping)
    if equipment_id:
        q = q.filter(OPCEquipmentMapping.equipment_id == equipment_id)
    if tag_id:
        q = q.filter(OPCEquipmentMapping.tag_id == tag_id)
    return [OPCEquipmentMappingOut.model_validate(m) for m in q.all()]


@router.post("/equipment-mappings", response_model=OPCEquipmentMappingOut, status_code=status.HTTP_201_CREATED)
def create_equipment_mapping(
    payload: OPCEquipmentMappingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    tag = db.query(OPCTag).filter(OPCTag.id == str(payload.tag_id)).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    equipment = db.query(Equipment).filter(Equipment.id == str(payload.equipment_id)).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    mapping = OPCEquipmentMapping(**payload.model_dump(), created_by_id=current_user.id)
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return mapping


@router.patch("/equipment-mappings/{mapping_id}", response_model=OPCEquipmentMappingOut)
def update_equipment_mapping(
    mapping_id: str,
    payload: OPCEquipmentMappingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    m = db.query(OPCEquipmentMapping).filter(OPCEquipmentMapping.id == mapping_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Mapping not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(m, field, value)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/equipment-mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment_mapping(
    mapping_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    m = db.query(OPCEquipmentMapping).filter(OPCEquipmentMapping.id == mapping_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Mapping not found")
    db.delete(m)
    db.commit()


@router.get("/equipment-mappings/{equipment_id}/autofill")
def autofill_equipment_log(
    equipment_id: str,
    log_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:read")),
):
    """Return current tag values for all active auto-fill mappings on this equipment."""
    q = db.query(OPCEquipmentMapping).filter(
        OPCEquipmentMapping.equipment_id == equipment_id,
        OPCEquipmentMapping.is_active == True,
        OPCEquipmentMapping.auto_fill == True,
    )
    if log_type:
        q = q.filter(
            (OPCEquipmentMapping.log_type == log_type) | (OPCEquipmentMapping.log_type == None)
        )
    mappings = q.all()

    result = {}
    for m in mappings:
        tag = db.query(OPCTag).filter(OPCTag.id == str(m.tag_id)).first()
        if not tag or not tag.current_value:
            continue
        value = tag.current_value
        if m.transform_formula:
            try:
                value = str(eval(m.transform_formula.replace("value", value), {"__builtins__": {}}, {}))
            except Exception:
                pass
        result[m.log_field] = {"value": value, "unit": tag.unit, "quality": tag.quality, "tag_name": tag.display_name}
    return result
