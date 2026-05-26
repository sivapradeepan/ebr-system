from typing import List
from fastapi import Depends, HTTPException, status
from ..models.user import User


def get_user_permissions(user: User) -> List[str]:
    permissions = set()
    for role in user.roles:
        for perm in role.permissions:
            permissions.add(perm.name)
    return list(permissions)


def has_permission(user: User, permission: str) -> bool:
    user_perms = get_user_permissions(user)
    return permission in user_perms or "admin:all" in user_perms


def require_permission(permission: str):
    from ..dependencies import get_current_user

    def check(current_user: User = Depends(get_current_user)):
        if not current_user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
        if not has_permission(current_user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: '{permission}' required",
            )
        return current_user
    return check


# All system permissions
PERMISSIONS = [
    ("users:create", "users", "create", "Create new users"),
    ("users:read", "users", "read", "View users"),
    ("users:update", "users", "update", "Update users"),
    ("users:delete", "users", "delete", "Delete users"),
    ("roles:create", "roles", "create", "Create roles"),
    ("roles:read", "roles", "read", "View roles"),
    ("roles:update", "roles", "update", "Update roles"),
    ("roles:delete", "roles", "delete", "Delete roles"),
    ("audit:read", "audit", "read", "View audit logs"),
    ("mbr:create", "mbr", "create", "Create master batch records"),
    ("mbr:read", "mbr", "read", "View master batch records"),
    ("mbr:update", "mbr", "update", "Update master batch records"),
    ("mbr:approve", "mbr", "approve", "Approve master batch records"),
    ("mbr:delete", "mbr", "delete", "Delete master batch records"),
    ("ebr:create", "ebr", "create", "Create executed batch records"),
    ("ebr:read", "ebr", "read", "View executed batch records"),
    ("ebr:execute", "ebr", "execute", "Execute/fill batch records"),
    ("ebr:review", "ebr", "review", "Review batch records"),
    ("ebr:approve", "ebr", "approve", "Approve/release batch records"),
    ("equipment:read", "equipment", "read", "View equipment"),
    ("equipment:manage", "equipment", "manage", "Manage equipment"),
    ("materials:read", "materials", "read", "View materials"),
    ("materials:manage", "materials", "manage", "Manage materials"),
    ("quality:read", "quality", "read", "View quality records"),
    ("quality:manage", "quality", "manage", "Manage quality records"),
    ("integration:read", "integration", "read", "View IDoc and OPC integrations"),
    ("integration:manage", "integration", "manage", "Manage IDoc and OPC integrations"),
    ("admin:all", "admin", "all", "Full system access"),
]

DEFAULT_ROLES = {
    "Administrator": {
        "description": "Full system access",
        "is_system": True,
        "permissions": ["admin:all", "integration:read", "integration:manage"],
    },
    "Production Manager": {
        "description": "Manages production operations and batch records",
        "is_system": True,
        "permissions": [
            "mbr:create", "mbr:read", "mbr:update", "mbr:approve",
            "ebr:create", "ebr:read", "ebr:execute", "ebr:review",
            "equipment:read", "equipment:manage",
            "materials:read", "materials:manage",
            "users:read", "audit:read",
        ],
    },
    "Operator": {
        "description": "Executes batch records on the production floor",
        "is_system": True,
        "permissions": ["mbr:read", "ebr:read", "ebr:execute", "equipment:read", "materials:read"],
    },
    "QA Specialist": {
        "description": "Quality assurance review and approval",
        "is_system": True,
        "permissions": [
            "mbr:read", "mbr:approve",
            "ebr:read", "ebr:review", "ebr:approve",
            "quality:read", "quality:manage",
            "audit:read", "users:read",
        ],
    },
    "Reviewer": {
        "description": "Read-only access to review records",
        "is_system": True,
        "permissions": ["mbr:read", "ebr:read", "equipment:read", "materials:read", "quality:read"],
    },
}
