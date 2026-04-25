import { useEffect } from 'react';

const STAGE = (import.meta.env.VITE_APP_STAGE || '').toLowerCase();
const isUat = STAGE === 'uat';

function applyNoIndexHead(): void {
  if (typeof document === 'undefined') return;
  const existing = document.querySelector('meta[name="robots"]');
  if (existing) {
    existing.setAttribute('content', 'noindex, nofollow');
    return;
  }
  const meta = document.createElement('meta');
  meta.name = 'robots';
  meta.content = 'noindex, nofollow';
  document.head.appendChild(meta);
}

export function UATBadge() {
  useEffect(() => {
    if (!isUat) return;
    applyNoIndexHead();
  }, []);

  if (!isUat) return null;

  return (
    <div
      role="note"
      aria-label="This is the UAT staging environment"
      data-testid="uat-badge"
      style={{
        position: 'fixed',
        top: '8px',
        right: '8px',
        zIndex: 2147483646,
        pointerEvents: 'none',
        padding: '4px 10px',
        borderRadius: '9999px',
        background: 'rgba(245, 158, 11, 0.92)',
        color: '#0a0a0a',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        boxShadow: '0 2px 8px rgba(120, 53, 15, 0.35)',
      }}
    >
      UAT
    </div>
  );
}
