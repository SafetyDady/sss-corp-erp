"""
SSS Corp ERP — Organization Models
Phase 4.1: Organization, Department, OrgWorkConfig, OrgApprovalConfig
Go-Live G6: DeptMenuConfig — per-department sidebar menu visibility

Department ↔ CostCenter = 1:1
Employee → Department (many-to-one)
Department.head_id → Employee (nullable, department head)
"""

import enum
import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.user import TimestampMixin, OrgMixin


# ============================================================
# ORGANIZATION
# ============================================================

class Organization(Base, TimestampMixin):
    """
    Top-level organization (tenant).
    Each org has its own departments, employees, and data.
    """
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tax_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<Organization {self.code} {self.name}>"


# ============================================================
# DEPARTMENT  (1:1 with CostCenter)
# ============================================================

class Department(Base, TimestampMixin, OrgMixin):
    """
    Department within an organization.
    - 1:1 mapping with CostCenter (enforced by UQ)
    - head_id points to Employee who heads this department
    """
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    cost_center_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cost_centers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    head_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("org_id", "code", name="uq_department_org_code"),
        UniqueConstraint("org_id", "cost_center_id", name="uq_department_org_cc"),
    )

    def __repr__(self) -> str:
        return f"<Department {self.code} {self.name}>"


# ============================================================
# ORG WORK CONFIG  (1 per org)
# ============================================================

class OrgWorkConfig(Base, TimestampMixin):
    """
    Organization-level work configuration.
    - working_days: JSON array of ISO weekday numbers [1=Mon..7=Sun]
    - hours_per_day: standard working hours
    """
    __tablename__ = "org_work_configs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    working_days: Mapped[list] = mapped_column(
        JSON, nullable=False, default=[1, 2, 3, 4, 5, 6]
    )
    hours_per_day: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), nullable=False, default=Decimal("8.00")
    )

    def __repr__(self) -> str:
        return f"<OrgWorkConfig org={self.org_id} days={self.working_days} hrs={self.hours_per_day}>"


# ============================================================
# ORG APPROVAL CONFIG  (per module per org)
# ============================================================

class OrgApprovalConfig(Base, TimestampMixin):
    """
    Per-module approval bypass configuration.
    module_key values: 'purchasing.po', 'sales.order', 'hr.timesheet',
                       'hr.leave', 'workorder.order'
    """
    __tablename__ = "org_approval_configs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    module_key: Mapped[str] = mapped_column(String(50), nullable=False)
    require_approval: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    __table_args__ = (
        UniqueConstraint("org_id", "module_key", name="uq_org_approval_module"),
        Index("ix_org_approval_org", "org_id"),
    )

    def __repr__(self) -> str:
        return f"<OrgApprovalConfig {self.module_key} require={self.require_approval}>"


# ============================================================
# DEPT MENU CONFIG  (Go-Live G6 — per dept sidebar visibility)
# ============================================================

# Valid menu keys matching frontend sidebar routes
VALID_MENU_KEYS = [
    "dashboard", "supply-chain", "work-orders", "purchasing",
    "sales", "hr", "customers", "planning", "master", "finance", "admin",
]


class DeptMenuConfig(Base, TimestampMixin):
    """
    Per-department sidebar menu visibility.
    - department_id NULL → org-wide default template
    - is_visible=False → menu item hidden for this department
    - When no config exists → all menus visible (default behavior)
    """
    __tablename__ = "dept_menu_configs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=True,
    )
    menu_key: Mapped[str] = mapped_column(String(50), nullable=False)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("org_id", "department_id", "menu_key", name="uq_dept_menu_org_dept_key"),
        Index("ix_dept_menu_org_dept", "org_id", "department_id"),
    )


# ============================================================
# ORG TAX CONFIG  (1 per org — C5 Tax Calculation)
# ============================================================

# ============================================================
# ROLE PERMISSION OVERRIDE  (A5 — persistent custom permissions)
# ============================================================

class RolePermissionOverride(Base, TimestampMixin):
    """
    Persisted custom permissions per role per org.
    Overrides the hardcoded defaults in permissions.py.
    permissions_json = JSON array of permission strings.
    """
    __tablename__ = "role_permission_overrides"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    role_name: Mapped[str] = mapped_column(String(50), nullable=False)
    permissions_json: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list
    )

    __table_args__ = (
        UniqueConstraint("org_id", "role_name", name="uq_role_perm_org_role"),
        Index("ix_role_perm_org", "org_id"),
    )

    def __repr__(self) -> str:
        return f"<RolePermissionOverride role={self.role_name} org={self.org_id}>"


class OrgTaxConfig(Base, TimestampMixin):
    """
    Organization-level tax configuration.
    - vat_enabled: global toggle for VAT calculation
    - default_vat_rate: default VAT rate for new PO/SO (e.g. 7.00 for Thailand)
    - wht_enabled: toggle for Withholding Tax (Phase C5.2)
    """
    __tablename__ = "org_tax_configs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    vat_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    default_vat_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("7.00")
    )
    wht_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "default_vat_rate >= 0 AND default_vat_rate <= 100",
            name="ck_org_tax_vat_range",
        ),
    )

    def __repr__(self) -> str:
        return f"<OrgTaxConfig org={self.org_id} vat={self.default_vat_rate}% enabled={self.vat_enabled}>"
