import random
import string
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
    IDocConnection, IDocMessage,
    IDocConnStatus, IDocStatus, IDocDirection, IDocType,
)
from ..schemas.integration import (
    IDocConnectionCreate, IDocConnectionUpdate, IDocConnectionOut, IDocConnectionList,
    IDocMessageCreate, IDocMessageOut, IDocMessageList,
)

router = APIRouter(prefix="/integrations/idoc", tags=["IDoc Integration"])


def _conn_out(conn: IDocConnection, db: Session) -> IDocConnectionOut:
    count = db.query(func.count(IDocMessage.id)).filter(IDocMessage.connection_id == conn.id).scalar()
    out = IDocConnectionOut.model_validate(conn)
    out.message_count = count
    return out


# ── Connections ───────────────────────────────────────────────────────────────

@router.get("/connections", response_model=IDocConnectionList)
def list_connections(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:read")),
):
    q = db.query(IDocConnection)
    total = q.count()
    items = q.order_by(IDocConnection.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return IDocConnectionList(items=[_conn_out(c, db) for c in items], total=total)


@router.post("/connections", response_model=IDocConnectionOut, status_code=status.HTTP_201_CREATED)
def create_connection(
    payload: IDocConnectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    if db.query(IDocConnection).filter(IDocConnection.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Connection name already exists")
    conn = IDocConnection(**payload.model_dump(), created_by_id=current_user.id)
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return _conn_out(conn, db)


@router.get("/connections/{conn_id}", response_model=IDocConnectionOut)
def get_connection(
    conn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:read")),
):
    conn = db.query(IDocConnection).filter(IDocConnection.id == conn_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return _conn_out(conn, db)


@router.patch("/connections/{conn_id}", response_model=IDocConnectionOut)
def update_connection(
    conn_id: str,
    payload: IDocConnectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    conn = db.query(IDocConnection).filter(IDocConnection.id == conn_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(conn, field, value)
    db.commit()
    db.refresh(conn)
    return _conn_out(conn, db)


@router.delete("/connections/{conn_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connection(
    conn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    conn = db.query(IDocConnection).filter(IDocConnection.id == conn_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    db.delete(conn)
    db.commit()


@router.post("/connections/{conn_id}/test")
def test_connection(
    conn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    conn = db.query(IDocConnection).filter(IDocConnection.id == conn_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    if conn.simulation_mode:
        conn.status = IDocConnStatus.ACTIVE
        conn.last_connected_at = datetime.utcnow()
        conn.last_error = None
        db.commit()
        return {"success": True, "message": "Simulation mode: connection test successful", "simulated": True}

    # Real RFC ping would go here (pyrfc / suds)
    conn.status = IDocConnStatus.ERROR
    conn.last_error = "Real RFC connectivity not configured — enable simulation mode to test"
    db.commit()
    return {"success": False, "message": conn.last_error, "simulated": False}


@router.post("/connections/{conn_id}/simulate-inbound")
def simulate_inbound(
    conn_id: str,
    idoc_type: IDocType = Query(IDocType.PRODORD),
    count: int = Query(3, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    """Generate simulated inbound IDoc messages for testing."""
    conn = db.query(IDocConnection).filter(IDocConnection.id == conn_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    if not conn.simulation_mode:
        raise HTTPException(status_code=400, detail="Simulation mode is not enabled for this connection")

    type_payloads = {
        IDocType.MATMAS: lambda: {
            "E1MARAM": {"MATNR": f"MAT-{''.join(random.choices(string.digits, k=6))}", "MAKTX": "Simulated Material", "MEINS": "KG"},
        },
        IDocType.PRODORD: lambda: {
            "E1AFKOL": {"AUFNR": f"PO-{''.join(random.choices(string.digits, k=8))}", "MATNR": f"MAT-{random.randint(1000,9999)}", "GAMNG": str(random.randint(100, 1000))},
        },
        IDocType.BATCHA: lambda: {
            "E1OBATX": {"MATNR": f"MAT-{random.randint(1000,9999)}", "CHARG": f"BT-{random.randint(10000,99999)}", "VFDAT": "20271231"},
        },
    }

    created = []
    for _ in range(count):
        payload_fn = type_payloads.get(idoc_type, lambda: {"data": "simulated"})
        msg = IDocMessage(
            connection_id=conn.id,
            direction=IDocDirection.INBOUND,
            idoc_type=idoc_type,
            idoc_number=f"SIM-{''.join(random.choices(string.digits, k=10))}",
            message_type=f"{idoc_type.value}05",
            status=IDocStatus.QUEUED,
            payload=payload_fn(),
        )
        db.add(msg)
        created.append(msg)
    db.commit()
    return {"created": len(created), "message": f"Generated {len(created)} simulated {idoc_type.value} IDocs"}


@router.post("/connections/{conn_id}/process-queue")
def process_queue(
    conn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    """Process all QUEUED messages for this connection."""
    conn = db.query(IDocConnection).filter(IDocConnection.id == conn_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    queued = db.query(IDocMessage).filter(
        IDocMessage.connection_id == conn_id,
        IDocMessage.status == IDocStatus.QUEUED,
    ).all()

    processed = 0
    errors = 0
    for msg in queued:
        if conn.simulation_mode:
            # Simulate random success/failure
            if random.random() > 0.1:
                msg.status = IDocStatus.PROCESSED
                msg.processed_at = datetime.utcnow()
                processed += 1
            else:
                msg.status = IDocStatus.ERROR
                msg.error_message = "Simulated processing error"
                errors += 1
        else:
            msg.status = IDocStatus.ERROR
            msg.error_message = "Real processing not configured"
            errors += 1
    db.commit()
    return {"processed": processed, "errors": errors, "total": len(queued)}


# ── Messages ──────────────────────────────────────────────────────────────────

@router.get("/messages", response_model=IDocMessageList)
def list_messages(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    connection_id: Optional[str] = Query(None),
    direction: Optional[IDocDirection] = Query(None),
    idoc_type: Optional[IDocType] = Query(None),
    msg_status: Optional[IDocStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:read")),
):
    q = db.query(IDocMessage)
    if connection_id:
        q = q.filter(IDocMessage.connection_id == connection_id)
    if direction:
        q = q.filter(IDocMessage.direction == direction)
    if idoc_type:
        q = q.filter(IDocMessage.idoc_type == idoc_type)
    if msg_status:
        q = q.filter(IDocMessage.status == msg_status)
    total = q.count()
    items = q.order_by(IDocMessage.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return IDocMessageList(items=items, total=total)


@router.post("/messages", response_model=IDocMessageOut, status_code=status.HTTP_201_CREATED)
def create_message(
    payload: IDocMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    conn = db.query(IDocConnection).filter(IDocConnection.id == str(payload.connection_id)).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    msg = IDocMessage(**payload.model_dump())
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.post("/messages/{msg_id}/retry")
def retry_message(
    msg_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    msg = db.query(IDocMessage).filter(IDocMessage.id == msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.status not in (IDocStatus.ERROR, IDocStatus.IGNORED):
        raise HTTPException(status_code=400, detail="Only ERROR or IGNORED messages can be retried")
    msg.status = IDocStatus.QUEUED
    msg.retry_count += 1
    msg.error_message = None
    db.commit()
    return {"message": "Message queued for retry"}


@router.delete("/messages/{msg_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(
    msg_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("integration:manage")),
):
    msg = db.query(IDocMessage).filter(IDocMessage.id == msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    db.delete(msg)
    db.commit()
