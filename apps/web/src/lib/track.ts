'use client';

export type TrackEventType =
  | 'PRODUCT_VIEW'
  | 'PRODUCT_CLICK'
  | 'ADD_TO_CART'
  | 'REMOVE_FROM_CART'
  | 'CART_ABANDON'
  | 'SEARCH'
  | 'CHECKOUT_START'
  | 'CHECKOUT_COMPLETE';

interface QueuedEvent {
  type: TrackEventType;
  productId?: string;
  payload?: Record<string, unknown>;
  occurredAt: number;
}

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5_000;
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

let buffer: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (timer) return;
  timer = setTimeout(() => {
    flush();
  }, FLUSH_INTERVAL_MS);
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/**
 * Send buffered events to the API. Uses fetch with keepalive=true so events
 * sent during a navigation/unload still make it out. Does not throw on
 * failure — tracking must never break the UX.
 */
export function flush(): void {
  if (typeof window === 'undefined') return;
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  clearTimer();
  const accessToken =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  try {
    void fetch(`${API_BASE}/track`, {
      method: 'POST',
      keepalive: true,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ events: batch }),
    }).catch(() => {
      // ignore — don't disrupt UX
    });
  } catch {
    // swallow
  }
}

export function track(
  type: TrackEventType,
  options?: { productId?: string; payload?: Record<string, unknown> },
): void {
  if (typeof window === 'undefined') return;
  buffer.push({
    type,
    productId: options?.productId,
    payload: options?.payload,
    occurredAt: Date.now(),
  });
  if (buffer.length >= BATCH_SIZE) {
    flush();
  } else {
    scheduleFlush();
  }
}

// Flush on page lifecycle events that signal the user might be leaving.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
