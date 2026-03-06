"""
SSS Corp ERP — Fixed Asset Models
Phase C13: Asset Register + Depreciation (Thai Tax Law Compliant)

Business Rules:
  BR#137 — Straight-Line depreciation = (cost - salvage) / (life × 12)
  BR#138 — Cannot generate depreciation for same period twice (UNIQUE)
  BR#139 — DISPOSED/RETIRED assets stop depreciating
  BR#140 — Cannot change acquisition_cost/date if depreciation entries exist
  BR#141 — asset_code unique per org
  BR#142 — Delete = soft delete, must have no depreciation entries
  BR#143 — Dispose requires ACTIVE status, auto-calc gain/loss
  BR#144 — tool_id unique — 1 tool = 1 asset only
"""

import enum
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.user import TimestampMixin, OrgMixin


# ============================================================
# Enums
# ============================================================

class DepreciationMethod(str, enum.Enum):
    """Depreciation calculation method."""
    STRAIGHT_LINE = "STRAIGHT_LINE"


class AssetStatus(str, enum.Enum):
    """Asset lifecycle status."""
    ACTIVE = "ACTIVE"
    FULLY_DEPRECIATED = "FULLY_DEPRECIATED"
    DISPOSED = "DISPOSED"
    RETIRED = "RETIRED"


# ============================================================
# ASSET CATEGORY  (Master Data — Thai Tax Law defaults)
# ============================================================

class AssetCategory(Base, TimestampMixin, OrgMixin):
    """
    Asset category with Thai Revenue Department depreciation defaults.
    e.g. "BLDG" = อาคารถาวร (20 years, 5%/yr)
         "COMP" = คอมพิวเตอร์ (3 years, 33.33%/yr)
    """
    __tablename__ = "asset_categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(
        String(20), nullable=False
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    useful_life_years: Mapped[int] = mapped_column(
        Integer, nullable=False
    )
    depreciation_rate: Mapped[object] = mapped_column(
        Numeric(5, 2), nullable=False  # e.g. 20.00 = 20%/yr
    )
    depreciation_method: Mapped[DepreciationMethod] = mapped_column(
        Enum(DepreciationMethod, name="depreciation_method_enum"),
        nullable=False,
        default=DepreciationMethod.STRAIGHT_LINE,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "org_id", "code",
            name="uq_asset_category_org_code",
        ),
        CheckConstraint(
            "useful_life_years > 0",
            name="ck_asset_category_life_positive",
        ),
        CheckConstraint(
            "depreciation_rate > 0 AND depreciation_rate <= 100",
            name="ck_asset_category_rate_range",
        ),
        Index("ix_asset_category_org", "org_id"),
    )


# ============================================================
# FIXED ASSET  (Asset Register)
# ============================================================

class FixedAsset(Base, TimestampMixin, OrgMixin):
    """
    Fixed asset register — tracks all company-owned assets.
    Links to cost center, category, optionally tool and PO.
    Depreciation is calculated monthly via generate_depreciation_entries().
    """
    __tablename__ = "fixed_assets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_code: Mapped[str] = mapped_column(
        String(50), nullable=False
    )
    asset_name: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    description: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("asset_categories.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Financial
    acquisition_date: Mapped[object] = mapped_column(
        Date, nullable=False
    )
    acquisition_cost: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False  # ราคาทุน
    )
    salvage_value: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False, default=0  # มูลค่าซาก
    )
    useful_life_years: Mapped[int] = mapped_column(
        Integer, nullable=False
    )
    depreciation_method: Mapped[DepreciationMethod] = mapped_column(
        Enum(DepreciationMethod, name="depreciation_method_enum", create_type=False),
        nullable=False,
        default=DepreciationMethod.STRAIGHT_LINE,
    )

    # Computed / Denormalized (updated on depreciation run)
    accumulated_depreciation: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    net_book_value: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )

    # Status
    status: Mapped[AssetStatus] = mapped_column(
        Enum(AssetStatus, name="asset_status_enum"),
        nullable=False,
        default=AssetStatus.ACTIVE,
    )
    disposed_date: Mapped[object | None] = mapped_column(
        Date, nullable=True
    )
    disposal_amount: Mapped[object | None] = mapped_column(
        Numeric(12, 2), nullable=True  # ราคาขาย/จำหน่าย
    )

    # Location & Ownership
    cost_center_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cost_centers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    location: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    responsible_employee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Links
    tool_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tools.id", ondelete="SET NULL"),
        nullable=True,
    )
    po_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchase_orders.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Audit
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "org_id", "asset_code",
            name="uq_fixed_asset_org_code",
        ),
        CheckConstraint(
            "acquisition_cost > 0",
            name="ck_asset_cost_positive",
        ),
        CheckConstraint(
            "salvage_value >= 0",
            name="ck_asset_salvage_non_negative",
        ),
        CheckConstraint(
            "useful_life_years > 0",
            name="ck_asset_life_positive",
        ),
        CheckConstraint(
            "accumulated_depreciation >= 0",
            name="ck_asset_accum_dep_non_negative",
        ),
        CheckConstraint(
            "net_book_value >= 0",
            name="ck_asset_nbv_non_negative",
        ),
        Index("ix_fixed_asset_org_status", "org_id", "status"),
        Index("ix_fixed_asset_org_category", "org_id", "category_id"),
        Index("ix_fixed_asset_tool", "tool_id", unique=True,
              postgresql_where="tool_id IS NOT NULL"),
    )


# ============================================================
# DEPRECIATION ENTRY  (Monthly depreciation records)
# ============================================================

class DepreciationEntry(Base, TimestampMixin, OrgMixin):
    """
    Monthly depreciation record generated by depreciation run.
    One entry per asset per month. Immutable once generated.

    Straight-Line formula (BR#137):
      monthly_dep = (acquisition_cost - salvage_value) / (useful_life_years × 12)
    """
    __tablename__ = "depreciation_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fixed_assets.id", ondelete="RESTRICT"),
        nullable=False,
    )
    period_year: Mapped[int] = mapped_column(Integer, nullable=False)
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)

    depreciation_amount: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False  # ค่าเสื่อมเดือนนี้
    )
    accumulated_depreciation: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False  # ค่าเสื่อมสะสมหลังเดือนนี้
    )
    net_book_value: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False  # NBV หลังเดือนนี้
    )

    generated_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "asset_id", "period_year", "period_month",
            name="uq_depreciation_asset_period",
        ),
        CheckConstraint(
            "depreciation_amount >= 0",
            name="ck_depreciation_amount_non_negative",
        ),
        CheckConstraint(
            "accumulated_depreciation >= 0",
            name="ck_depreciation_accum_non_negative",
        ),
        CheckConstraint(
            "net_book_value >= 0",
            name="ck_depreciation_nbv_non_negative",
        ),
        CheckConstraint(
            "period_month >= 1 AND period_month <= 12",
            name="ck_depreciation_month_range",
        ),
        Index(
            "ix_depreciation_asset_period",
            "asset_id", "period_year", "period_month",
        ),
        Index(
            "ix_depreciation_org_period",
            "org_id", "period_year", "period_month",
        ),
    )
