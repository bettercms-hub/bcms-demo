/**
 * Security cards — change password, two-factor authentication and active
 * sessions for the account settings area.
 *
 * IMPORTANT: this is a demo with simulated auth. The password fields only
 * check shape and strength on the client; the value is never stored or sent.
 * 2FA "setup" shows a representative QR + secret and accepts any 6-digit code
 * so the full flow can be walked through without a real authenticator.
 */
import { useMemo, useState } from "react";
import { Check, Copy, Loader2, Lock, Monitor, RefreshCw, ShieldCheck, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { ACCOUNT_SESSIONS, accountActions, useSecurity } from "@/lib/workspace/account-store";
import { SettingsSection } from "@/components/cms/SettingsSubNav";
import { DangerButton, DemoNote, Field, GhostButton, Input, Label, PrimaryButton } from "./AccountBits";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- Password */

function strengthOf(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^\w\s]/.test(pw)) score++;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong", "Strong"];
  return { score: Math.min(score, 4), label: labels[Math.min(score, 5)] };
}

function whenLabel(ts: number | null): string {
  if (!ts) return "Not changed yet";
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "Changed today";
  if (days === 1) return "Changed yesterday";
  if (days < 30) return `Changed ${days} days ago`;
  return `Changed on ${new Date(ts).toLocaleDateString()}`;
}

export function ChangePasswordCard() {
  const security = useSecurity();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const strength = strengthOf(next);
  const tooWeak = next.length > 0 && next.length < 8;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSave = cur.length > 0 && next.length >= 8 && confirm === next && !saving;

  function submit() {
    if (!canSave) return;
    setSaving(true);
    // Simulated: we never keep the value, only record that it changed.
    setTimeout(() => {
      accountActions.changePassword(Date.now());
      setCur("");
      setNext("");
      setConfirm("");
      setSaving(false);
      toast.success("Password changed");
    }, 500);
  }

  return (
    <SettingsSection title="Password" description={whenLabel(security.passwordChangedAt)}>
      <div className="max-w-sm space-y-4">
        <Field label="Current password">
          <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
        </Field>
        <Field label="New password" error={tooWeak ? "Use at least 8 characters." : ""}>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
          {next.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex h-1.5 flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "flex-1 rounded-full transition-colors",
                      i < strength.score
                        ? strength.score <= 1
                          ? "bg-rose-500"
                          : strength.score === 2
                          ? "bg-amber-500"
                          : strength.score === 3
                          ? "bg-lime-500"
                          : "bg-emerald-500"
                        : "bg-[color:var(--border-hairline)]",
                    )}
                  />
                ))}
              </div>
              <span className="w-14 shrink-0 text-right text-[11px] font-medium text-muted-foreground">{strength.label}</span>
            </div>
          )}
        </Field>
        <Field label="Confirm new password" error={mismatch ? "Passwords don't match." : ""}>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
        </Field>
        <PrimaryButton onClick={submit} disabled={!canSave}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
          Update password
        </PrimaryButton>
      </div>
      <DemoNote>Demo only. Your entry is checked for strength and then discarded, never stored or transmitted.</DemoNote>
    </SettingsSection>
  );
}

/* --------------------------------------------------------------------- 2FA */

const DEMO_SECRET = "JBSW Y3DP EHPK 3PXP";

/** A representative QR-looking grid (not a scannable code) for the demo. */
function FakeQR() {
  const cells = useMemo(() => {
    const n = 21;
    const out: boolean[] = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const inTL = r < 7 && c < 7;
        const inTR = r < 7 && c >= n - 7;
        const inBL = r >= n - 7 && c < 7;
        if (inTL || inTR || inBL) {
          // Draw the three finder squares (ring + solid centre).
          const x = c >= n - 7 ? c - (n - 7) : c;
          const y = r >= n - 7 ? r - (n - 7) : r;
          const on = x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4);
          out.push(on);
        } else {
          // Deterministic pseudo-random fill for the data region.
          out.push((r * 31 + c * 17 + r * c) % 5 < 2);
        }
      }
    }
    return out;
  }, []);
  const n = 21;
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="h-36 w-36 rounded-lg bg-white p-1.5" shapeRendering="crispEdges" aria-label="Authenticator QR code">
      {cells.map((on, i) =>
        on ? <rect key={i} x={i % n} y={Math.floor(i / n)} width={1} height={1} fill="#0a0a0a" /> : null,
      )}
    </svg>
  );
}

function backupCodes(): string[] {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return Array.from({ length: 10 }, () => `${hex()}-${hex()}`);
}

export function TwoFactorCard() {
  const security = useSecurity();
  const [setup, setSetup] = useState(false);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);

  function confirmEnable() {
    if (code.replace(/\D/g, "").length !== 6) return;
    accountActions.enableTwoFactor();
    setCodes(backupCodes());
    setSetup(false);
    setCode("");
    toast.success("Two-factor authentication is on");
  }

  function turnOff() {
    accountActions.disableTwoFactor();
    setCodes(null);
    toast("Two-factor authentication turned off");
  }

  return (
    <SettingsSection
      title="Two-factor authentication"
      description="Add a second step at sign-in using an authenticator app."
      action={
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
            security.twoFactorEnabled
              ? "bg-[color:color-mix(in_oklab,var(--emerald,#10B981)_14%,transparent)] text-emerald-600 dark:text-emerald-400"
              : "bg-[color:var(--s2)] text-muted-foreground",
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {security.twoFactorEnabled ? "Enabled" : "Not set up"}
        </span>
      }
    >
      {/* Off, not setting up */}
      {!security.twoFactorEnabled && !setup && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            When it's on, you'll enter a 6-digit code from your authenticator app after your password.
          </p>
          <PrimaryButton onClick={() => setSetup(true)}>
            <ShieldCheck className="h-3.5 w-3.5" /> Set up two-factor
          </PrimaryButton>
        </div>
      )}

      {/* Setup flow */}
      {!security.twoFactorEnabled && setup && (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <FakeQR />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="text-[12.5px] font-medium text-foreground">1. Scan with an authenticator app</div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Use Google Authenticator, 1Password, Authy or similar. Can't scan? Enter this key manually:
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(DEMO_SECRET.replace(/\s/g, ""));
                  toast.success("Setup key copied");
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] px-3 py-1.5 font-mono text-[12px] tracking-wide text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
              >
                {DEMO_SECRET} <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="max-w-xs">
            <Label>2. Enter the 6-digit code</Label>
            <Input
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="font-mono tracking-[0.3em]"
            />
          </div>
          <div className="flex items-center gap-2">
            <PrimaryButton onClick={confirmEnable} disabled={code.replace(/\D/g, "").length !== 6}>
              Verify and turn on
            </PrimaryButton>
            <GhostButton onClick={() => { setSetup(false); setCode(""); }}>Cancel</GhostButton>
          </div>
          <DemoNote>Demo only. Any 6-digit code is accepted; no real authenticator is required.</DemoNote>
        </div>
      )}

      {/* On */}
      {security.twoFactorEnabled && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3.5 py-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--card)] text-emerald-500">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-foreground">Authenticator app</div>
              <div className="text-[11.5px] text-muted-foreground">
                {security.backupCodesRemaining} of 10 recovery codes remaining
              </div>
            </div>
          </div>

          {codes && (
            <div className="rounded-lg border border-[color:var(--border-hairline)] p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[12px] font-medium text-foreground">Recovery codes</div>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(codes.join("\n")); toast.success("Recovery codes copied"); }}
                  className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy all
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[12px] text-foreground">
                {codes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Save these somewhere safe. Each code works once if you lose your device.</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <GhostButton onClick={() => { accountActions.regenerateBackupCodes(); setCodes(backupCodes()); toast.success("New recovery codes generated"); }}>
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate recovery codes
            </GhostButton>
            <DangerButton onClick={turnOff}>Turn off</DangerButton>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}

/* ---------------------------------------------------------------- Sessions */

export function SessionsCard() {
  const [revoked, setRevoked] = useState<Set<string>>(new Set());
  const active = ACCOUNT_SESSIONS.filter((s) => !revoked.has(s.id));
  const others = active.filter((s) => !s.current);

  return (
    <SettingsSection
      title="Active sessions"
      description="Devices signed in to your account."
      action={
        others.length > 0 ? (
          <button
            type="button"
            onClick={() => { setRevoked(new Set(ACCOUNT_SESSIONS.filter((s) => !s.current).map((s) => s.id))); toast.success("Signed out of other sessions"); }}
            className="text-[12px] font-medium text-destructive transition-colors hover:underline"
          >
            Sign out of all others
          </button>
        ) : undefined
      }
      flush
    >
      <div className="divide-y divide-[color:var(--border-hairline)]">
        {active.map((s) => {
          const Phone = /iphone|android|mobile/i.test(s.device);
          const Icon = Phone ? Smartphone : Monitor;
          return (
            <div key={s.id} className="flex items-center gap-3 px-5 py-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--s2)] text-muted-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-foreground">{s.device}</span>
                  {s.current && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_oklab,var(--emerald,#10B981)_14%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3 w-3" /> This device
                    </span>
                  )}
                </div>
                <div className="truncate text-[11.5px] text-muted-foreground">
                  {s.location} · {s.lastActive}
                </div>
              </div>
              {!s.current && (
                <button
                  type="button"
                  onClick={() => { setRevoked((prev) => new Set(prev).add(s.id)); toast("Session signed out"); }}
                  aria-label={`Sign out ${s.device}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </SettingsSection>
  );
}
