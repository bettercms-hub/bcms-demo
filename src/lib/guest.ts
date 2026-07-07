// Guest mode — lets visitors browse the BetterCMS prototype without a Supabase
// account ("Continue without signing in"). Since every screen runs on mock data
// (src/lib/cms/mock-data.ts) and Supabase is used only for auth, guest mode simply
// bypasses the client-side session redirect gates. The flag lives in localStorage.
const GUEST_KEY = "bettercms.guest";

export function isGuest(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(GUEST_KEY) === "1";
  } catch {
    return false;
  }
}

export function enableGuest(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GUEST_KEY, "1");
  } catch {
    /* localStorage unavailable (private mode / SSR) — ignore */
  }
}

export function disableGuest(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GUEST_KEY);
  } catch {
    /* ignore */
  }
}
