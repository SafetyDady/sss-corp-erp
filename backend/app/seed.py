"""
Seed script — Create test users and default org for development.
Run: python -m app.seed
"""

import asyncio
from uuid import UUID

from sqlalchemy import select
from app.core.database import AsyncSessionLocal, engine, Base
from app.core.config import DEFAULT_ORG_ID
from app.core.security import hash_password
from app.models import User, Organization


TEST_USERS = [
    {"email": "owner@sss-corp.com", "password": "owner123", "full_name": "Owner Admin", "role": "owner"},
    {"email": "manager@sss-corp.com", "password": "manager123", "full_name": "Manager User", "role": "manager"},
    {"email": "supervisor@sss-corp.com", "password": "supervisor123", "full_name": "Supervisor User", "role": "supervisor"},
    {"email": "staff@sss-corp.com", "password": "staff123", "full_name": "Staff User", "role": "staff"},
    {"email": "viewer@sss-corp.com", "password": "viewer123", "full_name": "Viewer User", "role": "viewer"},
]


async def seed():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # Ensure default organization exists
        org_result = await db.execute(
            select(Organization).where(Organization.id == DEFAULT_ORG_ID)
        )
        if not org_result.scalar_one_or_none():
            org = Organization(
                id=DEFAULT_ORG_ID,
                code="SSS",
                name="SSS Corp",
            )
            db.add(org)
            print("  ✅ Default organization: SSS Corp")
        else:
            print("  ⏭  Default organization (exists)")

        # Create test users
        for user_data in TEST_USERS:
            result = await db.execute(
                select(User).where(User.email == user_data["email"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                # Update org_id if not set
                if not existing.org_id:
                    existing.org_id = DEFAULT_ORG_ID
                    print(f"  🔄 {user_data['email']} (org_id updated)")
                else:
                    print(f"  ⏭  {user_data['email']} (exists)")
                continue

            user = User(
                email=user_data["email"],
                hashed_password=hash_password(user_data["password"]),
                full_name=user_data["full_name"],
                role=user_data["role"],
                org_id=DEFAULT_ORG_ID,
            )
            db.add(user)
            print(f"  ✅ {user_data['email']} ({user_data['role']})")

        await db.commit()
    print("\n🌱 Seed complete!")


if __name__ == "__main__":
    asyncio.run(seed())
