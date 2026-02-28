const STATUS_CONFIG = {
  DRAFT: { color: '#f59e0b' },
  OPEN: { color: '#10b981' },
  CLOSED: { color: '#718096' },
  APPROVED: { color: '#10b981' },
  PENDING: { color: '#f59e0b' },
  SUBMITTED: { color: '#06b6d4' },
  FINAL: { color: '#8b5cf6' },
  LOCKED: { color: '#718096' },
  REJECTED: { color: '#ef4444' },
  CANCELLED: { color: '#ef4444' },
  'CHECKED-OUT': { color: '#f59e0b' },
  CHECKED_OUT: { color: '#f59e0b' },
  AVAILABLE: { color: '#10b981' },
  PO_CREATED: { color: '#8b5cf6' },
  RECEIVED: { color: '#10b981' },
  SERVICE: { color: '#10b981' },
  EXECUTED: { color: '#8b5cf6' },
  EXPORTED: { color: '#06b6d4' },
  INVOICED: { color: '#10b981' },
  MAINTENANCE: { color: '#f59e0b' },
  RETIRED: { color: '#718096' },
  ACTIVE: { color: '#10b981' },
  INACTIVE: { color: '#718096' },
  MATERIAL: { color: '#06b6d4' },
  CONSUMABLE: { color: '#8b5cf6' },
  ANNUAL: { color: '#06b6d4' },
  SICK: { color: '#ef4444' },
  PERSONAL: { color: '#8b5cf6' },
  RESERVED: { color: '#06b6d4' },
  FULFILLED: { color: '#10b981' },
};

export default function StatusBadge({ status }) {
  if (!status) return null;
  const config = STATUS_CONFIG[status] || { color: '#718096' };
  return (
    <span
      style={{
        background: config.color + '18',
        color: config.color,
        padding: '3px 10px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  );
}
