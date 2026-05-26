from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, SessionLocal
from .models import user as _user_models, audit as _audit_models, mbr as _mbr_models, ebr as _ebr_models, equipment as _equipment_models, quality as _quality_models, esignature as _esig_models, notification as _notification_models, schedule as _schedule_models, training as _training_models, integration as _integration_models  # noqa: register models
from .routers import auth, users, roles, audit, mbr, ebr, equipment, material, quality, esignature, reports, notifications, schedule, training, idoc, opc
from .config import settings
from .core.security import hash_password
from .core.rbac import PERMISSIONS, DEFAULT_ROLES
from .models.user import User, Role, Permission


def seed_database(db):
    # Seed permissions
    for perm_name, resource, action, description in PERMISSIONS:
        if not db.query(Permission).filter(Permission.name == perm_name).first():
            db.add(Permission(name=perm_name, resource=resource, action=action, description=description))
    db.commit()

    # Seed default roles
    for role_name, role_data in DEFAULT_ROLES.items():
        if not db.query(Role).filter(Role.name == role_name).first():
            perms = db.query(Permission).filter(Permission.name.in_(role_data["permissions"])).all()
            db.add(Role(
                name=role_name,
                description=role_data["description"],
                is_system=role_data["is_system"],
                permissions=perms,
            ))
    db.commit()

    # Seed admin user
    if not db.query(User).filter(User.username == settings.FIRST_ADMIN_USERNAME).first():
        admin_role = db.query(Role).filter(Role.name == "Administrator").first()
        db.add(User(
            username=settings.FIRST_ADMIN_USERNAME,
            email=settings.FIRST_ADMIN_EMAIL,
            full_name="System Administrator",
            hashed_password=hash_password(settings.FIRST_ADMIN_PASSWORD),
            is_active=True,
            roles=[admin_role] if admin_role else [],
        ))
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="21 CFR Part 11 Compliant Electronic Batch Record System",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(roles.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(mbr.router, prefix="/api/v1")
app.include_router(ebr.router, prefix="/api/v1")
app.include_router(equipment.router, prefix="/api/v1")
app.include_router(material.router, prefix="/api/v1")
app.include_router(quality.router, prefix="/api/v1")
app.include_router(esignature.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(schedule.router, prefix="/api/v1")
app.include_router(training.router, prefix="/api/v1")
app.include_router(idoc.router, prefix="/api/v1")
app.include_router(opc.router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "version": settings.VERSION, "app": settings.APP_NAME}
