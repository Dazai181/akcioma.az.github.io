'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import type { AuthUser } from '@/lib/types';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const setSession = useAuth((s) => s.setSession);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { data } = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>('/auth/login', { mobile, password });
      setSession(data.user, data.accessToken, data.refreshToken);
      router.push(next && next.startsWith('/') ? next : '/');
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Giriş başarısız.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="text-sm">
        Telefon Numarası
        <input
          type="tel"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          required
          placeholder="+905551234567"
          className="mt-1 w-full rounded border px-3 py-2 bg-transparent"
          style={{ borderColor: 'var(--aksioma-border)' }}
        />
      </label>
      <label className="text-sm">
        Şifre
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="mt-1 w-full rounded border px-3 py-2 bg-transparent"
          style={{ borderColor: 'var(--aksioma-border)' }}
        />
      </label>
      {err && <div className="text-sm text-accent">{err}</div>}
      <button
        disabled={busy}
        className="rounded bg-accent text-white py-2 font-medium disabled:opacity-50"
      >
        {busy ? 'Giriş…' : 'Giriş'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="max-w-sm mx-auto py-8">
      <h1 className="text-xl font-bold mb-4">Giriş Yap</h1>
      <Suspense fallback={<div className="text-sm">Yükleniyor…</div>}>
        <LoginForm />
      </Suspense>
      <div className="mt-4 text-sm" style={{ color: 'var(--aksioma-muted)' }}>
        Hesabın yok mu?{' '}
        <Link href="/register" className="underline">
          Kayıt ol
        </Link>
      </div>
    </div>
  );
}
