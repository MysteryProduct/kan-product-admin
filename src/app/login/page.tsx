'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
      router.push('/');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldClass = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <main className="min-h-screen bg-[var(--color-bg-secondary)] p-4 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-md items-center sm:min-h-[calc(100vh-3rem)]">
        <section className="surface w-full rounded-2xl p-6 sm:p-8" aria-labelledby="login-title">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white" aria-hidden="true">
              <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764 2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-primary)]">Kan Product Admin</p>
              <h1 id="login-title" className="text-2xl font-semibold text-[var(--color-text-primary)]">เข้าสู่ระบบ</h1>
            </div>
          </div>

          <p className="mb-6 text-sm text-[var(--color-text-secondary)]">กรอกบัญชีผู้ใช้ขององค์กรเพื่อจัดการข้อมูลสินค้า</p>

          {error && (
            <div id="login-error" role="alert" aria-live="polite" className="mb-6 rounded-lg border border-[var(--color-error)] bg-[var(--color-bg-secondary)] p-4">
              <p className="whitespace-pre-line text-sm font-medium text-[var(--color-error)]">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">ชื่อผู้ใช้</label>
              <input id="username" name="username" autoComplete="username" aria-describedby={error ? 'login-error' : undefined} type="text" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="กรอกชื่อผู้ใช้" className={fieldClass} disabled={isLoading} required autoFocus />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">รหัสผ่าน</label>
              <input id="password" name="password" autoComplete="current-password" aria-describedby={error ? 'login-error' : undefined} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="กรอกรหัสผ่าน" className={fieldClass} disabled={isLoading} required />
            </div>
            <button type="submit" disabled={isLoading} className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-3 font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60">
              {isLoading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
