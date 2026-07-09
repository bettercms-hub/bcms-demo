/**
 * account-store — the signed-in person's own profile and preferences.
 *
 * The demo runs as a guest with no real account, so this is where an
 * editable display name, avatar colour, title, and personal preferences
 * live. Persisted to localStorage; the sidebar identity and menus read
 * from here so edits show up everywhere immediately.
 */
import { useSyncExternalStore } from "react";

export interface AccountProfile {
  name: string;
  title: string;
  avatarColor: string;
}

export interface AccountPrefs {
  reducedMotion: boolean;
  emailDigest: boolean;
  productUpdates: boolean;
  mentionEmails: boolean;
}

export const AVATAR_COLORS = ["#EF037F", "#6366F1", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6"];

const PROFILE_KEY = "bettercms.account.profile.v1";
const PREFS_KEY = "bettercms.account.prefs.v1";

const DEFAULT_PROFILE: AccountProfile = { name: "", title: "", avatarColor: AVATAR_COLORS[0] };
const DEFAULT_PREFS: AccountPrefs = { reducedMotion: false, emailDigest: true, productUpdates: true, mentionEmails: true };

let profile: AccountProfile = DEFAULT_PROFILE;
let prefs: AccountPrefs = DEFAULT_PREFS;
const listeners = new Set<() => void>();

function hydrate() {
  if (typeof window === "undefined") return;
  try {
    const p = window.localStorage.getItem(PROFILE_KEY);
    if (p) profile = { ...DEFAULT_PROFILE, ...JSON.parse(p) };
    const pr = window.localStorage.getItem(PREFS_KEY);
    if (pr) prefs = { ...DEFAULT_PREFS, ...JSON.parse(pr) };
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

export function useProfile(): AccountProfile {
  return useSyncExternalStore(subscribe, () => profile, () => profile);
}
export function usePrefs(): AccountPrefs {
  return useSyncExternalStore(subscribe, () => prefs, () => prefs);
}

export const accountActions = {
  updateProfile(patch: Partial<AccountProfile>) {
    profile = { ...profile, ...patch };
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      /* ignore */
    }
    emit();
  },
  updatePrefs(patch: Partial<AccountPrefs>) {
    prefs = { ...prefs, ...patch };
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
    applyPrefs();
    emit();
  },
};
