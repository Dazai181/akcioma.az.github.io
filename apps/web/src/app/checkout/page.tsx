'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useCart } from '@/lib/cart-store';
import { track } from '@/lib/track';
import type { OrderDetail } from '@/lib/types';

const TRY = (n: number) => `₺${n.toFixed(2)}`;

export default function CheckoutPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const { cart, fetch: fetchCart } = useCart();

  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (user === null) {
      router.replace('/login?next=/checkout');
      return;
    }
    if (user) {
      if (!fullName) setFullName(`${user.firstName} ${user.lastName}`);
      if (!phone) setPhone(user.mobile);
    }
  }, [user, router]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  useEffect(() => {
    if (cart && cart.items.length > 0) {
      track('CHECKOUT_START');
    }
  }, [cart?.items.length]);

  if (!user) {
    return <div className="py-12 text-center text-sm">Yönlendiriliyor…</div>;
  }

  if (cart && cart.items.length === 0) {
    return (
      <div className="py-12 text-center flex flex-col items-center gap-3">
        <div className="text-lg">Sepetiniz boş.</div>
        <Link href="/" className="text-accent underline">
          Alışverişe Başla
        </Link>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { data } = await api.post<OrderDetail>('/orders/checkout', {
        contactPhone: phone,
        notes: notes || undefined,
        shippingAddress: {
          fullName,
          city,
          district: district || undefined,
          addressLine,
          postalCode: postalCode || undefined,
        },
      });
      track('CHECKOUT_COMPLETE', { payload: { orderId: data.id, total: data.total } });
      await fetchCart();
      router.replace(`/orders/${data.code}?success=1`);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Sipariş oluşturulamadı.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <form onSubmit={onSubmit} className="md:col-span-2 flex flex-col gap-3">
        <h1 className="text-xl font-bold">Ödeme</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm flex flex-col gap-1">
            <span style={{ color: 'var(--aksioma-muted)' }}>Ad Soyad</span>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded border bg-transparent px-3 py-2"
              style={{ borderColor: 'var(--aksioma-border)' }}
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span style={{ color: 'var(--aksioma-muted)' }}>Telefon</span>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded border bg-transparent px-3 py-2"
              style={{ borderColor: 'var(--aksioma-border)' }}
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span style={{ color: 'var(--aksioma-muted)' }}>İl</span>
            <input
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="rounded border bg-transparent px-3 py-2"
              style={{ borderColor: 'var(--aksioma-border)' }}
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span style={{ color: 'var(--aksioma-muted)' }}>İlçe</span>
            <input
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="rounded border bg-transparent px-3 py-2"
              style={{ borderColor: 'var(--aksioma-border)' }}
            />
          </label>
          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span style={{ color: 'var(--aksioma-muted)' }}>Adres</span>
            <textarea
              required
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              rows={3}
              className="rounded border bg-transparent px-3 py-2"
              style={{ borderColor: 'var(--aksioma-border)' }}
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span style={{ color: 'var(--aksioma-muted)' }}>Posta Kodu</span>
            <input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="rounded border bg-transparent px-3 py-2"
              style={{ borderColor: 'var(--aksioma-border)' }}
            />
          </label>
          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span style={{ color: 'var(--aksioma-muted)' }}>Sipariş notu (isteğe bağlı)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded border bg-transparent px-3 py-2"
              style={{ borderColor: 'var(--aksioma-border)' }}
            />
          </label>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        <button
          disabled={busy || !cart || cart.items.length === 0}
          className="self-start rounded bg-accent text-white px-6 py-3 font-medium disabled:opacity-50"
        >
          {busy ? 'Sipariş veriliyor…' : 'Siparişi Tamamla'}
        </button>
      </form>

      <aside
        className="rounded-lg border p-4 h-fit flex flex-col gap-3"
        style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
      >
        <h2 className="font-semibold">Sipariş Özeti</h2>
        {cart?.items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 text-sm">
            {item.image && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={item.image} alt="" className="w-12 h-12 rounded object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <div className="line-clamp-2">{item.name}</div>
              <div className="text-xs" style={{ color: 'var(--aksioma-muted)' }}>
                {item.quantity} × {TRY(item.priceSnapshot)}
              </div>
            </div>
            <div className="font-semibold whitespace-nowrap">{TRY(item.lineTotal)}</div>
          </div>
        ))}
        <div className="border-t pt-3 flex justify-between text-base font-bold" style={{ borderColor: 'var(--aksioma-border)' }}>
          <span>Toplam</span>
          <span>{TRY(cart?.subtotal ?? 0)}</span>
        </div>
      </aside>
    </div>
  );
}
