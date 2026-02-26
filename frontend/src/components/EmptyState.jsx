import { Inbox } from 'lucide-react';

export default function EmptyState({
  message = '\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25',
  hint = '\u0E25\u0E2D\u0E07\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E40\u0E07\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E02\u0E01\u0E32\u0E23\u0E04\u0E49\u0E19\u0E2B\u0E32 \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E2B\u0E21\u0E48',
}) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#718096' }}>
      <Inbox size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
      <div style={{ fontSize: 14, fontWeight: 500 }}>{message}</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>{hint}</div>
    </div>
  );
}
