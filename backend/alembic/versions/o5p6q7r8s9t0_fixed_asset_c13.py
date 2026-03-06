"""
C13: Fixed Asset Management — 3 new tables
(asset_categories, fixed_assets, depreciation_entries)

Revision ID: o5p6q7r8s9t0
Revises: n4o5p6q7r8s9
Create Date: 2026-03-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "o5p6q7r8s9t0"
down_revision = "n4o5p6q7r8s9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Enums ---
    depreciation_method_enum = postgresql.ENUM(
        "STRAIGHT_LINE", name="depreciation_method_enum", create_type=False
    )
    asset_status_enum = postgresql.ENUM(
        "ACTIVE", "FULLY_DEPRECIATED", "DISPOSED", "RETIRED",
        name="asset_status_enum", create_type=False,
    )
    depreciation_method_enum.create(op.get_bind(), checkfirst=True)
    asset_status_enum.create(op.get_bind(), checkfirst=True)

    # --- 1. asset_categories ---
    op.create_table(
        "asset_categories",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("useful_life_years", sa.Integer, nullable=False),
        sa.Column("depreciation_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("depreciation_method", depreciation_method_enum, nullable=False, server_default="STRAIGHT_LINE"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("org_id", "code", name="uq_asset_categories_org_code"),
    )

    # --- 2. fixed_assets ---
    op.create_table(
        "fixed_assets",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("asset_code", sa.String(50), nullable=False),
        sa.Column("asset_name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("asset_categories.id"), nullable=False),
        # Financial
        sa.Column("acquisition_date", sa.Date, nullable=False),
        sa.Column("acquisition_cost", sa.Numeric(12, 2), nullable=False),
        sa.Column("salvage_value", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("useful_life_years", sa.Integer, nullable=False),
        sa.Column("depreciation_method", depreciation_method_enum, nullable=False, server_default="STRAIGHT_LINE"),
        # Computed/Denormalized
        sa.Column("accumulated_depreciation", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("net_book_value", sa.Numeric(12, 2), nullable=False, server_default="0"),
        # Status
        sa.Column("status", asset_status_enum, nullable=False, server_default="ACTIVE"),
        sa.Column("disposed_date", sa.Date, nullable=True),
        sa.Column("disposal_amount", sa.Numeric(12, 2), nullable=True),
        # Location & Ownership
        sa.Column("cost_center_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("cost_centers.id"), nullable=False),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("responsible_employee_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), nullable=True),
        # Links
        sa.Column("tool_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("tools.id"), nullable=True),
        sa.Column("po_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("purchase_orders.id"), nullable=True),
        # Audit
        sa.Column("created_by", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        # Constraints
        sa.UniqueConstraint("org_id", "asset_code", name="uq_fixed_assets_org_code"),
        sa.CheckConstraint("acquisition_cost > 0", name="ck_fixed_assets_cost_positive"),
        sa.CheckConstraint("salvage_value >= 0", name="ck_fixed_assets_salvage_non_negative"),
        sa.CheckConstraint("useful_life_years > 0", name="ck_fixed_assets_life_positive"),
        sa.CheckConstraint("net_book_value >= 0", name="ck_fixed_assets_nbv_non_negative"),
    )
    # Indexes
    op.create_index("ix_fixed_assets_org_status", "fixed_assets", ["org_id", "status"])
    op.create_index("ix_fixed_assets_org_category", "fixed_assets", ["org_id", "category_id"])
    # Partial unique index for tool_id (only when not NULL)
    op.create_index(
        "ix_fixed_assets_tool_unique",
        "fixed_assets",
        ["tool_id"],
        unique=True,
        postgresql_where=sa.text("tool_id IS NOT NULL"),
    )

    # --- 3. depreciation_entries ---
    op.create_table(
        "depreciation_entries",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("asset_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("fixed_assets.id"), nullable=False),
        sa.Column("period_year", sa.Integer, nullable=False),
        sa.Column("period_month", sa.Integer, nullable=False),
        sa.Column("depreciation_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("accumulated_depreciation", sa.Numeric(12, 2), nullable=False),
        sa.Column("net_book_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("generated_by", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        # Constraints
        sa.UniqueConstraint("asset_id", "period_year", "period_month", name="uq_depreciation_asset_period"),
        sa.CheckConstraint("depreciation_amount >= 0", name="ck_depreciation_amount_non_negative"),
        sa.CheckConstraint("period_month >= 1 AND period_month <= 12", name="ck_depreciation_month_range"),
    )
    # Indexes
    op.create_index("ix_depreciation_asset_period", "depreciation_entries", ["asset_id", "period_year", "period_month"])
    op.create_index("ix_depreciation_org_period", "depreciation_entries", ["org_id", "period_year", "period_month"])


def downgrade() -> None:
    op.drop_table("depreciation_entries")
    op.drop_table("fixed_assets")
    op.drop_table("asset_categories")

    # Drop enums
    sa.Enum(name="asset_status_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="depreciation_method_enum").drop(op.get_bind(), checkfirst=True)
