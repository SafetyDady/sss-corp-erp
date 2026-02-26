"""
Seed script — Create test users for development.
Run: python -m app.seed
"""

import asyncio

from sqlalchemy import select
from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import hash_password
from app.models import User


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
        for user_data in TEST_USERS:
            # Skip if exists
            result = await db.execute(
                select(User).where(User.email == user_data["email"])
            )
            if result.scalar_one_or_none():
                print(f"  ⏭  {user_data['email']} (exists)")
                continue

            user = User(
                email=user_data["email"],
                hashed_password=hash_password(user_data["password"]),
                full_name=user_data["full_name"],
                role=user_data["role"],
            )
            db.add(user)
            print(f"  ✅ {user_data['email']} ({user_data['role']})")

        await db.commit()
    print("\n🌱 Seed complete!")


if __name__ == "__main__":
    asyncio.run(seed())
