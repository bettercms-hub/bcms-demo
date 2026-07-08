/**
 * onboarding-store — the answers a new account gives during first-run.
 *
 * Role, what they build, team size, and where they heard about us. The
 * answers personalize later copy (and in production feed the growth
 * funnel). Persisted in localStorage so a refresh mid-flow keeps state.
 */

export type OnboardingRole = "developer" | "marketer" | "editor" | "designer" | "founder" | "other";
export type OnboardingUsage = "company" | "clients" | "product" | "personal";
export type OnboardingTeam = "solo" | "small" | "mid" | "large";
export type OnboardingSource = "search" | "x" | "linkedin" | "youtube" | "friend" | "ai" | "newsletter" | "other";

export interface OnboardingProfile {
  name?: string;
  role?: OnboardingRole;
  usage?: OnboardingUsage;
  team?: OnboardingTeam;
  source?: OnboardingSource;
  completedAt?: number;
}

const KEY = "bettercms.onboarding.v1";

export function getOnboarding(): OnboardingProfile {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as OnboardingProfile;
  } catch {
    return {};
  }
}

export function patchOnboarding(patch: Partial<OnboardingProfile>): OnboardingProfile {
  const next = { ...getOnboarding(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — flow still works in memory for this render */
  }
  return next;
}

/** First name for personalized copy, when we have one. */
export function onboardingFirstName(): string {
  const n = getOnboarding().name?.trim() ?? "";
  return n.split(/\s+/)[0] ?? "";
}
