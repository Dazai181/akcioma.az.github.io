'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import type { AuthUser } from '@/lib/types';

type Step = 'register' | 'verify';

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [step, setStep] = useState<Step>('register');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.post('/auth/register', { firstName, lastName, mobile });
      setStep('verify');
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Kayıt başarısız.');
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { data } = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>('/auth/verify-otp', { mobile, otp });
      setSession(data.user, data.accessToken, data.refreshToken);
      router.push('/');
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Doğrulama başarısız.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto py-8">
      <h1 className="text-xl font-bold mb-4">{step === 'register' ? 'Kayıt Ol' : 'Doğrulama Kodu'}</h1>
      {step === 'register' ? (
        <form onSubmit={onRegister} className="flex flex-col gap-3">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Ad"
            required
            className="rounded border px-3 py-2 bg-transparent"
            style={{ borderColor: 'var(--aksioma-border)' }}
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Soyad"
            required
            className="rounded border px-3 py-2 bg-transparent"
            style={{ borderColor: 'var(--aksioma-border)' }}
          />
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="+905551234567"
            type="tel"
            required
            className="rounded border px-3 py-2 bg-transparent"
            style={{ borderColor: 'var(--aksioma-border)' }}
          />
          {err && <div className="text-sm text-accent">{err}</div>}
          <button disabled={busy} className="rounded bg-accent text-white py-2 font-medium disabled:opacity-50">
            {busy ? 'Gönderiliyor…' : 'Doğrulama Kodu Gönder'}
          </button>
        </form>
      ) : (
        <form onSubmit={onVerify} className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: 'var(--aksioma-muted)' }}>
            {mobile} numarasına gönderilen 6 haneli kodu girin.
          </p>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            inputMode="numeric"
            maxLength={6}
            required
            className="rounded border px-3 py-2 bg-transparent text-center tracking-widest font-mono text-lg"
            style={{ borderColor: 'var(--aksioma-border)' }}
          />
          {err && <div className="text-sm text-accent">{err}</div>}
          <button disabled={busy} className="rounded bg-accent text-white py-2 font-medium disabled:opacity-50">
            {busy ? 'Doğrulanıyor…' : 'Doğrula'}
          </button>
        </form>
      )}
    </div>
  );
}
