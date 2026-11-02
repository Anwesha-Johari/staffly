"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldCheck, Users, Wallet, CalendarCheck, ArrowRight } from "lucide-react";
import { api, post } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Avatar, Badge, Button, Field, Input, cx } from "@/components/ui";
import { Logo } from "@/components/AppShell";

interface DemoAccount { accountId: number; username: string; accessRole: "Admin" | "HR" | "Employee"; employeeName: string; roleTitle?: string }

export function LoginView() {
  const { user, ready, signIn } = useSession();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);

  useEffect(() => { if (ready && user) router.replace("/dashboard"); }, [ready, user, router]);
  useEffect(() => {
    api<{ accounts: DemoAccount[] }>("/api/auth/login").then((d) => setAccounts(d.accounts.slice(0, 6))).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) return setError("Enter your username and password.");
    setBusy(true);
    try {
      const { user } = await post<{ user: any }>("/api/auth/login", { username, password });
      signIn(user);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-fuchsia-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <Logo className="relative text-xl [&>span:first-child]:bg-white/20 [&>span:first-child]:from-transparent" />
        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">Everything your people team needs, in one calm place.</h1>
          <p className="mt-4 text-white/80">Manage employees, track attendance, approve leave and run payroll — with access that fits each person&apos;s role.</p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              [Users, "Searchable employee directory"],
              [CalendarCheck, "Attendance and leave workflows"],
              [Wallet, "Monthly payroll with pay status"],
              [ShieldCheck, "Role-based access: Admin, HR, Employee"],
            ].map(([Icon, t]: any) => (
              <li key={t} className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-white/15"><Icon className="size-4" /></span>{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">Staffly · Employee management</p>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm anim-fade-up">
          <Logo className="mb-8 text-xl lg:hidden" />
          <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-1 text-sm text-muted">Sign in to your Staffly account.</p>

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            <Field label="Username">{(id) => (
              <Input id={id} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus placeholder="e.g. admin" />
            )}</Field>
            <Field label="Password">{(id) => (
              <div className="relative">
                <Input id={id} ref={pwRef} type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" className="pr-10" />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-ink cursor-pointer">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            )}</Field>
            {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
            <Button type="submit" loading={busy} className="w-full" icon={!busy && <ArrowRight className="size-4" />}>Sign in</Button>
          </form>

          {accounts.length > 0 && (
            <div className="mt-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Quick fill a username</p>
              <div className="space-y-1.5">
                {accounts.map((a) => (
                  <button
                    key={a.accountId}
                    type="button"
                    onClick={() => { setUsername(a.username); setError(""); pwRef.current?.focus(); }}
                    className={cx("flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-brand/50 hover:bg-surface-2 cursor-pointer", username === a.username && "border-brand bg-brand-soft")}
                  >
                    <Avatar name={a.employeeName} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.employeeName}</span>
                      <span className="block truncate text-xs text-muted">@{a.username}</span>
                    </span>
                    <Badge tone={a.accessRole === "Admin" ? "brand" : a.accessRole === "HR" ? "info" : "neutral"} dot={false}>{a.accessRole}</Badge>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
