"""C11: Multi-Company Foundation — Company table + company_id FKs

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-03-05

Changes:
  - New table: companies (legal entity within an Org)
  - Add company_id FK to: cost_centers, departments, employees, payroll_runs,
    purchase_requisitions, purchase_orders, sales_orders, delivery_orders,
    warehouses, supplier_invoices, customer_invoices
  - Add department_id FK to: warehouses (managing department)
  - Add delivery_warehouse_id FK to: purchase_orders (delivery destination)
  - Add is_inter_company bool to: fixed_recharge_entries
  - Backfill: create DEFAULT company per org, update existing records
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers
revision = "l2m3n4o5p6q7"
down_revision = "k1l2m3n4o5p6"
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    """Check if table exists (dev mode: metadata.create_all may have created it)."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"),
        {"t": table_name},
    )
    return result.scalar()


def _column_exists(table_name: str, column_name: str) -> bool:
    """Check if column exists."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c)"),
        {"t": table_name, "c": column_name},
    )
    return result.scalar()


def _index_exists(index_name: str) -> bool:
    """Check if index exists."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :n)"),
        {"n": index_name},
    )
    return result.scalar()


def _fk_exists(constraint_name: str) -> bool:
    """Check if foreign key constraint exists."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = :n AND constraint_type = 'FOREIGN KEY')"),
        {"n": constraint_name},
    )
    return result.scalar()


def _add_column_safe(table: str, col_name: str, col_type):
    """Add column only if not exists."""
    if not _column_exists(table, col_name):
        op.add_column(table, sa.Column(col_name, col_type, nullable=True))


def _add_fk_safe(name: str, source: str, target: str, local_cols, remote_cols, ondelete="SET NULL"):
    """Add FK only if not exists."""
    if not _fk_exists(name):
        op.create_foreign_key(name, source, target, local_cols, remote_cols, ondelete=ondelete)


def _add_index_safe(name: str, table: str, columns):
    """Add index only if not exists."""
    if not _index_exists(name):
        op.create_index(name, table, columns)


def upgrade() -> None:
    # ============================================================
    # 1. Create companies table
    # ============================================================
    if not _table_exists("companies"):
        op.create_table(
            "companies",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("code", sa.String(50), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("tax_id", sa.String(20), nullable=True),
            sa.Column("address", sa.Text, nullable=True),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.UniqueConstraint("org_id", "code", name="uq_company_org_code"),
        )
    _add_index_safe("ix_company_org", "companies", ["org_id"])

    # ============================================================
    # 2. Add company_id FK to existing tables
    # ============================================================

    # cost_centers
    _add_column_safe("cost_centers", "company_id", UUID(as_uuid=True))
    _add_fk_safe("fk_cost_center_company", "cost_centers", "companies", ["company_id"], ["id"])
    _add_index_safe("ix_cost_center_company", "cost_centers", ["company_id"])

    # departments
    _add_column_safe("departments", "company_id", UUID(as_uuid=True))
    _add_fk_safe("fk_department_company", "departments", "companies", ["company_id"], ["id"])
    _add_index_safe("ix_department_company", "departments", ["company_id"])

    # employees
    _add_column_safe("employees", "company_id", UUID(as_uuid=True))
    _add_fk_safe("fk_employee_company", "employees", "companies", ["company_id"], ["id"])
    _add_index_safe("ix_employees_company", "employees", ["company_id"])

    # payroll_runs
    _add_column_safe("payroll_runs", "company_id", UUID(as_uuid=True))
    _add_fk_safe("fk_payroll_company", "payroll_runs", "companies", ["company_id"], ["id"])
    _add_index_safe("ix_payroll_company", "payroll_runs", ["company_id"])

    # purchase_requisitions
    _add_column_safe("purchase_requisitions", "company_id", UUID(as_uuid=True))
    _add_fk_safe("fk_pr_company", "purchase_requisitions", "companies", ["company_id"], ["id"])
    _add_index_safe("ix_pr_company", "purchase_requisitions", ["company_id"])

    # purchase_orders
    _add_column_safe("purchase_orders", "company_id", UUID(as_uuid=True))
    _add_fk_safe("fk_po_company", "purchase_orders", "companies", ["company_id"], ["id"])
    _add_column_safe("purchase_orders", "delivery_warehouse_id", UUID(as_uuid=True))
    _add_fk_safe("fk_po_delivery_warehouse", "purchase_orders", "warehouses", ["delivery_warehouse_id"], ["id"])
    _add_index_safe("ix_po_company", "purchase_orders", ["company_id"])
    _add_index_safe("ix_po_delivery_warehouse", "purchase_orders", ["delivery_warehouse_id"])

    # sales_orders
    _add_column_safe("sales_orders", "company_id", UUID(as_uuid=True))
    _add_fk_safe("fk_so_company", "sales_orders", "companies", ["company_id"], ["id"])
    _add_index_safe("ix_so_company", "sales_orders", ["company_id"])

    # delivery_orders
    _add_column_safe("delivery_orders", "company_id", UUID(as_uuid=True))
    _add_fk_safe("fk_do_company", "delivery_orders", "companies", ["company_id"], ["id"])
    _add_index_safe("ix_do_company", "delivery_orders", ["company_id"])

    # warehouses
    _add_column_safe("warehouses", "company_id", UUID(as_uuid=True))
    _add_fk_safe("fk_warehouse_company", "warehouses", "companies", ["company_id"], ["id"])
    _add_index_safe("ix_warehouse_company", "warehouses", ["company_id"])
    _add_column_safe("warehouses", "department_id", UUID(as_uuid=True))
    _add_fk_safe("fk_warehouse_department", "warehouses", "departments", ["department_id"], ["id"])
    _add_index_safe("ix_warehouse_department", "warehouses", ["department_id"])

    # supplier_invoices
    _add_column_safe("supplier_invoices", "company_id", UUID(as_uuid=True))
    _add_fk_safe("fk_supplier_invoice_company", "supplier_invoices", "companies", ["company_id"], ["id"])
    _add_index_safe("ix_invoice_company", "supplier_invoices", ["company_id"])

    # customer_invoices
    _add_column_safe("customer_invoices", "company_id", UUID(as_uuid=True))
    _add_fk_safe("fk_customer_invoice_company", "customer_invoices", "companies", ["company_id"], ["id"])
    _add_index_safe("ix_ci_company", "customer_invoices", ["company_id"])

    # ============================================================
    # 3. Add is_inter_company to fixed_recharge_entries
    # ============================================================
    if not _column_exists("fixed_recharge_entries", "is_inter_company"):
        op.add_column(
            "fixed_recharge_entries",
            sa.Column("is_inter_company", sa.Boolean, nullable=False, server_default=sa.text("false")),
        )

    # ============================================================
    # 4. Backfill — create DEFAULT company per org, update records
    # ============================================================
    # This uses raw SQL for performance and atomicity
    op.execute("""
        INSERT INTO companies (id, org_id, code, name, is_active, created_at, updated_at)
        SELECT
            gen_random_uuid(),
            o.id,
            'DEFAULT',
            o.name || ' (Default)',
            true,
            NOW(),
            NOW()
        FROM organizations o
        WHERE NOT EXISTS (
            SELECT 1 FROM companies c WHERE c.org_id = o.id
        )
    """)

    # Backfill company_id on all tables using the default company
    for table_name in [
        "cost_centers", "departments", "employees", "payroll_runs",
        "purchase_requisitions", "purchase_orders", "sales_orders",
        "delivery_orders", "warehouses", "supplier_invoices", "customer_invoices",
    ]:
        op.execute(f"""
            UPDATE {table_name} t
            SET company_id = c.id
            FROM companies c
            WHERE c.org_id = t.org_id
              AND c.code = 'DEFAULT'
              AND t.company_id IS NULL
        """)


def downgrade() -> None:
    # Remove is_inter_company
    op.drop_column("fixed_recharge_entries", "is_inter_company")

    # Remove company_id from customer_invoices
    op.drop_index("ix_ci_company", table_name="customer_invoices")
    op.drop_constraint("fk_customer_invoice_company", "customer_invoices", type_="foreignkey")
    op.drop_column("customer_invoices", "company_id")

    # Remove company_id from supplier_invoices
    op.drop_index("ix_invoice_company", table_name="supplier_invoices")
    op.drop_constraint("fk_supplier_invoice_company", "supplier_invoices", type_="foreignkey")
    op.drop_column("supplier_invoices", "company_id")

    # Remove department_id + company_id from warehouses
    op.drop_index("ix_warehouse_department", table_name="warehouses")
    op.drop_constraint("fk_warehouse_department", "warehouses", type_="foreignkey")
    op.drop_column("warehouses", "department_id")
    op.drop_index("ix_warehouse_company", table_name="warehouses")
    op.drop_constraint("fk_warehouse_company", "warehouses", type_="foreignkey")
    op.drop_column("warehouses", "company_id")

    # Remove company_id from delivery_orders
    op.drop_index("ix_do_company", table_name="delivery_orders")
    op.drop_constraint("fk_do_company", "delivery_orders", type_="foreignkey")
    op.drop_column("delivery_orders", "company_id")

    # Remove company_id from sales_orders
    op.drop_index("ix_so_company", table_name="sales_orders")
    op.drop_constraint("fk_so_company", "sales_orders", type_="foreignkey")
    op.drop_column("sales_orders", "company_id")

    # Remove company_id + delivery_warehouse_id from purchase_orders
    op.drop_index("ix_po_delivery_warehouse", table_name="purchase_orders")
    op.drop_constraint("fk_po_delivery_warehouse", "purchase_orders", type_="foreignkey")
    op.drop_column("purchase_orders", "delivery_warehouse_id")
    op.drop_index("ix_po_company", table_name="purchase_orders")
    op.drop_constraint("fk_po_company", "purchase_orders", type_="foreignkey")
    op.drop_column("purchase_orders", "company_id")

    # Remove company_id from purchase_requisitions
    op.drop_index("ix_pr_company", table_name="purchase_requisitions")
    op.drop_constraint("fk_pr_company", "purchase_requisitions", type_="foreignkey")
    op.drop_column("purchase_requisitions", "company_id")

    # Remove company_id from payroll_runs
    op.drop_index("ix_payroll_company", table_name="payroll_runs")
    op.drop_constraint("fk_payroll_company", "payroll_runs", type_="foreignkey")
    op.drop_column("payroll_runs", "company_id")

    # Remove company_id from employees
    op.drop_index("ix_employees_company", table_name="employees")
    op.drop_constraint("fk_employee_company", "employees", type_="foreignkey")
    op.drop_column("employees", "company_id")

    # Remove company_id from departments
    op.drop_index("ix_department_company", table_name="departments")
    op.drop_constraint("fk_department_company", "departments", type_="foreignkey")
    op.drop_column("departments", "company_id")

    # Remove company_id from cost_centers
    op.drop_index("ix_cost_center_company", table_name="cost_centers")
    op.drop_constraint("fk_cost_center_company", "cost_centers", type_="foreignkey")
    op.drop_column("cost_centers", "company_id")

    # Drop companies table
    op.drop_index("ix_company_org", table_name="companies")
    op.drop_table("companies")
