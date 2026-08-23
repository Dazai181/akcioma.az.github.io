import type { OrderEvent, OrderStatus } from '@/lib/types';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'PENDING', label: 'Sipariş Alındı' },
  { status: 'CONFIRMED', label: 'Onaylandı' },
  { status: 'SHIPPED', label: 'Kargoya Verildi' },
  { status: 'DELIVERED', label: 'Teslim Edildi' },
];

export function OrderTimeline({ events }: { events: OrderEvent[] }) {
  const cancelled = events.some((e) => e.status === 'CANCELLED');
  const reachedAt = new Map<OrderStatus, OrderEvent>();
  for (const e of events) {
    if (!reachedAt.has(e.status)) reachedAt.set(e.status, e);
  }

  if (cancelled) {
    const cancelEvent = events.find((e) => e.status === 'CANCELLED')!;
    return (
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
      >
        <div className="font-semibold mb-2">Sipariş Durumu</div>
        <div className="text-sm text-red-600">
          Bu sipariş iptal edildi ·{' '}
          {new Date(cancelEvent.createdAt).toLocaleString('tr-TR')}
        </div>
        {cancelEvent.note && (
          <div className="text-xs mt-1" style={{ color: 'var(--aksioma-muted)' }}>
            {cancelEvent.note}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
    >
      <div className="font-semibold mb-3">Sipariş Durumu</div>
      <ol className="flex flex-col gap-3">
        {STEPS.map((step, idx) => {
          const event = reachedAt.get(step.status);
          const reached = !!event;
          return (
            <li key={step.status} className="flex items-start gap-3">
              <div
                className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  reached
                    ? 'bg-accent text-white'
                    : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {reached ? '✓' : idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${reached ? '' : 'opacity-60'}`}>
                  {step.label}
                </div>
                {event && (
                  <div className="text-xs" style={{ color: 'var(--aksioma-muted)' }}>
                    {new Date(event.createdAt).toLocaleString('tr-TR')}
                    {event.note ? ` · ${event.note}` : ''}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
