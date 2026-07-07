/**
 * Publishing state machine for Pages and Entries.
 *
 * draft → review → approved → scheduled → published → archived
 *                     ↘──────────────────↗ (publish directly)
 *
 * - From any state you may move to `archived`.
 * - From `archived` you may move back to `draft`.
 * - From any state you may move back to `draft` (re-edit).
 * - `published` can be moved to `draft` (unpublish) or `archived`.
 */
import type { PublishState } from "./types";

const ORDER: PublishState[] = ["draft", "review", "approved", "scheduled", "published"];

export function canTransition(from: PublishState | undefined, to: PublishState): boolean {
  const f = (from ?? "draft") as PublishState;
  if (f === to) return false;
  if (to === "archived") return true;
  if (f === "archived") return to === "draft";
  if (to === "draft") return true;
  // Forward-only along ORDER, plus allow `approved → published` (skip schedule).
  const fi = ORDER.indexOf(f);
  const ti = ORDER.indexOf(to);
  if (fi < 0 || ti < 0) return false;
  // Forward step of 1, or approved→published (skip 'scheduled').
  if (ti === fi + 1) return true;
  if (f === "approved" && to === "published") return true;
  return false;
}

export function disabledReason(from: PublishState | undefined, to: PublishState): string | undefined {
  if (canTransition(from, to)) return undefined;
  const f = (from ?? "draft") as PublishState;
  if (f === to) return `Already ${to}`;
  if (to === "scheduled" && f === "draft") return "Move through Review and Approved first.";
  if (to === "published" && f !== "approved" && f !== "scheduled") return "Approve before publishing.";
  if (to === "review" && f === "approved") return "Already approved.";
  return `Cannot move from ${f} to ${to}.`;
}

export const NEXT_STATES: PublishState[] = [
  "draft",
  "review",
  "approved",
  "scheduled",
  "published",
  "archived",
];
