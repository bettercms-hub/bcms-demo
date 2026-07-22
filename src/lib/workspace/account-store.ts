/**
 * account-store — the signed-in person's own account: profile, sign-in
 * details, security, connected apps and personal preferences.
 *
 * The demo runs as a guest with no real backend, so every "change password /
 * email / enable 2FA / link account" flow here is a faithful UI simulation
 * persisted to localStorage. No real credential is ever captured or sent —
 * the password fields validate shape and strength only, then discard the
 * value and record that a change happened.
 *
 * The sidebar identity and account menus read from here, so edits show up
 * everywhere immediately.
 */
import { useSyncExternalStore } from "react";

export interface AccountProfile {
  name: string;
  title: string;
  avatarColor: string;
  /** Uploaded photo as a data URL. Falls back to the color initials when unset. */
  avatarUrl?: string;
  bio: string;
  email: string;
}

export interface AccountPrefs {
  reducedMotion: boolean;
  emailDigest: boolean;
  productUpdates: boolean;
  mentionEmails: boolean;
}

export interface AccountSecurity {
  /** Whether a password has ever been set on this account. */
  passwordSet: boolean;
  /** When the password was last changed (epoch ms), null if never. */
  passwordChangedAt: number | null;
  twoFactorEnabled: boolean;
  /** Recovery codes left, only meaningful when 2FA is on. */
  backupCodesRemaining: number;
}

export type ConnectionProvider = "google" | "github" | "slack" | "figma" | "notion" | "linear";

export interface AccountConnection {
  handle: string;
  connectedAt: number;
}

export interface AccountSession {
  id: string;
  device: string;
  location: string;
  current: boolean;
  lastActive: string;
}

export const AVATAR_COLORS = ["#D54646", "#6366F1", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6"];

export const CONNECTION_META: Record<ConnectionProvider, { label: string; blurb: string }> = {
  google: { label: "Google", blurb: "Sign in with Google and sync your calendar." },
  github: { label: "GitHub", blurb: "Link commits and deploys to your account." },
  slack: { label: "Slack", blurb: "Get notifications and share links in Slack." },
  figma: { label: "Figma", blurb: "Bring design frames into the content editor." },
  notion: { label: "Notion", blurb: "Import docs and sync content two ways." },
  linear: { label: "Linear", blurb: "Turn review comments into Linear issues." },
};

export const CONNECTION_ORDER: ConnectionProvider[] = ["google", "github", "slack", "figma", "notion", "linear"];

const PROFILE_KEY = "bettercms.account.profile.v1";
const PREFS_KEY = "bettercms.account.prefs.v1";
const SECURITY_KEY = "bettercms.account.security.v1";
const CONNECTIONS_KEY = "bettercms.account.connections.v1";

const DEFAULT_PROFILE: AccountProfile = { name: "", title: "", avatarColor: AVATAR_COLORS[0], bio: "", email: "" };
const DEFAULT_PREFS: AccountPrefs = { reducedMotion: false, emailDigest: true, productUpdates: true, mentionEmails: true };
const DEFAULT_SECURITY: AccountSecurity = { passwordSet: true, passwordChangedAt: null, twoFactorEnabled: false, backupCodesRemaining: 0 };
const DEFAULT_CONNECTIONS: Partial<Record<ConnectionProvider, AccountConnection>> = {
  google: { handle: "you@gmail.com", connectedAt: 0 },
};

/** Simulated sessions — read-only demo data (no real device tracking). */
export const ACCOUNT_SESSIONS: AccountSession[] = [
  { id: "s_current", device: "Chrome on macOS", location: "San Francisco, US", current: true, lastActive: "Active now" },
  { id: "s_iphone", device: "Safari on iPhone", location: "San Francisco, US", current: false, lastActive: "2 hours ago" },
  { id: "s_win", device: "Edge on Windows", location: "Austin, US", current: false, lastActive: "Yesterday" },
];

let profile: AccountProfile = DEFAULT_PROFILE;
let prefs: AccountPrefs = DEFAULT_PREFS;
let security: AccountSecurity = DEFAULT_SECURITY;
let connections: Partial<Record<ConnectionProvider, AccountConnection>> = DEFAULT_CONNECTIONS;
const listeners = new Set<() => void>();

function hydrate() {
  if (typeof window === "undefined") return;
  try {
    const p = window.localStorage.getItem(PROFILE_KEY);
    if (p) profile = { ...DEFAULT_PROFILE, ...JSON.parse(p) };
    const pr = window.localStorage.getItem(PREFS_KEY);
    if (pr) prefs = { ...DEFAULT_PREFS, ...JSON.parse(pr) };
    const s = window.localStorage.getItem(SECURITY_KEY);
    if (s) security = { ...DEFAULT_SECURITY, ...JSON.parse(s) };
    const c = window.localStorage.getItem(CONNECTIONS_KEY);
    if (c) connections = JSON.parse(c);
  } catch {
    /* ignore */
  }
  applyPrefs();
}

function applyPrefs() {
  if (typeof document === "undefined") return;
  document.documentElement.toggleAttribute("data-reduce-motion", prefs.reducedMotion);
}

hydrate();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function persist(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function useProfile(): AccountProfile {
  return useSyncExternalStore(subscribe, () => profile, () => profile);
}
export function usePrefs(): AccountPrefs {
  return useSyncExternalStore(subscribe, () => prefs, () => prefs);
}
export function useSecurity(): AccountSecurity {
  return useSyncExternalStore(subscribe, () => security, () => security);
}
export function useConnections(): Partial<Record<ConnectionProvider, AccountConnection>> {
  return useSyncExternalStore(subscribe, () => connections, () => connections);
}

export const accountActions = {
  updateProfile(patch: Partial<AccountProfile>) {
    profile = { ...profile, ...patch };
    persist(PROFILE_KEY, profile);
    emit();
  },
  /** Seed the email from the signed-in session, only if none is set yet. */
  seedEmail(email: string) {
    if (profile.email || !email) return;
    profile = { ...profile, email };
    persist(PROFILE_KEY, profile);
    emit();
  },
  updatePrefs(patch: Partial<AccountPrefs>) {
    prefs = { ...prefs, ...patch };
    persist(PREFS_KEY, prefs);
    applyPrefs();
    emit();
  },
  /** Record that the password changed. The value itself is never stored. */
  changePassword(at: number) {
    security = { ...security, passwordSet: true, passwordChangedAt: at };
    persist(SECURITY_KEY, security);
    emit();
  },
  enableTwoFactor() {
    security = { ...security, twoFactorEnabled: true, backupCodesRemaining: 10 };
    persist(SECURITY_KEY, security);
    emit();
  },
  disableTwoFactor() {
    security = { ...security, twoFactorEnabled: false, backupCodesRemaining: 0 };
    persist(SECURITY_KEY, security);
    emit();
  },
  regenerateBackupCodes() {
    security = { ...security, backupCodesRemaining: 10 };
    persist(SECURITY_KEY, security);
    emit();
  },
  connect(provider: ConnectionProvider, handle: string, at: number) {
    connections = { ...connections, [provider]: { handle, connectedAt: at } };
    persist(CONNECTIONS_KEY, connections);
    emit();
  },
  disconnect(provider: ConnectionProvider) {
    const next = { ...connections };
    delete next[provider];
    connections = next;
    persist(CONNECTIONS_KEY, connections);
    emit();
  },
};
