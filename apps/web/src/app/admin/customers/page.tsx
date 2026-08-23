'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CustomerTier } from '@/lib/types';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  customerTier: CustomerTier;
  isVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
  _count: { orders: number };
}

const TIERS: CustomerTier[] = ['STANDARD', 'FAVORITE', 'SPECIAL'];

const TIER_BADGE: Record<CustomerTier, string> = {
  STANDARD: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  FAVORITE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  SPECIAL: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export default function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState<CustomerTier | ''>('');
  const [updating, setUpdating] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'customers', search, tier],
    queryFn: async () => {
      const { data } = await api.get<Customer[]>('/admin/customers', {
        params: { search: search || undefined, tier: tier || undefined },
      });
      return data;
    },
  });

  const setTierFor = async (id: string, newTier: CustomerTier) => {
    setUpdating(id);
    try {
      await api.patch(`/admin/customers/${id}/tier`, { tier: newTier });
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Güncellenemedi.');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ad, soyad veya telefon ara"
          className="rounded border bg-transparent px-3 py-1.5 text-sm flex-1 min-w-[200px]"
          style={{ borderColor: 'var(--aksioma-border)' }}
        />
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as CustomerTier | '')}
          className="rounded border bg-transparent px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--aksioma-border)' }}
        >
          <option value="">Tüm seviyeler</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--aksioma-border)' }}>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase" style={{ background: 'var(--aksioma-card)', color: 'var(--aksioma-muted)' }}>
            <tr>
              <th className="text-left p-2">Müşteri</th>
              <th className="text-left p-2">Telefon</th>
              <th className="text-left p-2">Mevcut Tier</th>
              <th className="text-right p-2">Sipariş</th>
              <th className="text-left p-2">Tier Değiştir</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="p-4 text-center">Yükleniyor…</td></tr>
            )}
            {data?.map((c) => (
              <tr key={c.id} className="border-t" style={{ borderColor: 'var(--aksioma-border)' }}>
                <td className="p-2">
                  <div className="font-medium">{c.firstName} {c.lastName}</div>
                  {c.isAdmin && (
                    <span className="text-[10px] uppercase font-bold text-accent">Admin</span>
                  )}
                </td>
                <td className="p-2 font-mono text-xs">{c.mobile}</td>
                <td className="p-2">
                  <span className={`text-xs font-semibold rounded px-2 py-0.5 ${TIER_BADGE[c.customerTier]}`}>
                    {c.customerTier}
                  </span>
                </td>
                <td className="p-2 text-right">{c._count.orders}</td>
                <td className="p-2">
                  <select
                    value={c.customerTier}
                    onChange={(e) => setTierFor(c.id, e.target.value as CustomerTier)}
                    disabled={updating === c.id}
                    className="rounded border bg-transparent px-2 py-1 text-xs"
                    style={{ borderColor: 'var(--aksioma-border)' }}
                  >
                    {TIERS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center" style={{ color: 'var(--aksioma-muted)' }}>
                  Müşteri bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
