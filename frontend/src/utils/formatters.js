export function formatCurrency(value) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num == null || isNaN(num)) return '\u0E3F0.00';
  return `\u0E3F${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return (
    d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  );
}

export function formatNumber(value) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num == null || isNaN(num)) return '0';
  return num.toLocaleString('en-US');
}

/**
 * Safely extract error message from Axios error response.
 * FastAPI 422 errors have detail as array of {type,loc,msg,input} objects;
 * passing these to message.error() crashes React. This helper always returns a string.
 */
export function getApiErrorMsg(err, fallback = 'เกิดข้อผิดพลาด') {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (typeof d === 'object' ? d.msg || JSON.stringify(d) : String(d))).join('; ');
  }
  if (typeof detail === 'object') return detail.msg || JSON.stringify(detail);
  return String(detail);
}
