/**
 * Phase 1 has no real authentication. We pin the viewer to a stable identity
 * so backend rows have a sensible `user_ref` / `created_by`. When auth is
 * added later, replace `getCurrentUserRef()` with `auth.uid()` and `getCurrentUserProfile`
 * with the signed-in profile.
 */

const STORAGE_KEY = "bcms.currentUserRef";

export interface CurrentUserProfile {
  ref: string;
  name: string;
  email: string;
  initials: string;
}

const DEFAULT_PROFILE: Omit<CurrentUserProfile, "ref"> = {
  name: "Jane Park",
  email: "jane@acme.co",
  initials: "JP",
};

export function getCurrentUserRef(): string {
  if (typeof window === "undefined") return "viewer-ssr";
  let ref = window.localStorage.getItem(STORAGE_KEY);
  if (!ref || (ref.startsWith("viewer-") && ref !== "viewer-demo")) {
    ref = "viewer-demo";
    window.localStorage.setItem(STORAGE_KEY, ref);
  }
  return ref;
}

export function getCurrentUserProfile(): CurrentUserProfile {
  return { ref: getCurrentUserRef(), ...DEFAULT_PROFILE };
}
