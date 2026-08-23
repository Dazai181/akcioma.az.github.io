import type { OrderStatus } from '@/lib/types';

const LABELS: Record<OrderStatus, string> = {
  PENDING: 'Onay Bekliyor',
  CONFIRMED: 'Onaylandı',
  SHIPPED: 'Kargoda',
  DELIVERED: 'Teslim Edildi',
  CANCELLED: 'İptal Edildi',
};

const COLORS: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  SHIPPED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  DELIVERED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CANCELLED: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`text-xs font-semibold rounded px-2 py-0.5 ${COLORS[status]}`}>
      {LABELS[status]}
    </span>
  );
}
