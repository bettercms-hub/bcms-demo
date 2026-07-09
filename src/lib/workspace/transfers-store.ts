/**
 * transfers-store — Webflow-style project transfers.
 *
 * Two paths, matching Webflow's model:
 * - To one of your own workspaces: instant, via projectActions.transfer.
 * - To someone else by email: a pending request the recipient accepts from
 *   their dashboard banner (or the sender cancels). On accept the recipient
 *   picks which of their workspaces receives the project.
 *
 * Transferring resets the site plan to the base tier (the destination owns
 * billing) and disconnects custom domains — the confirm copy says so.
 *
 * In-memory for the demo; production would email the recipient a signed
 * accept link and run the move server-side.
 */
import { useSyncExternalStore } from "react";
import { projectActions } from "@/lib/cms/store";

export interface TransferRequest {
  id: string;
  projectId: string;
  projectName: string;
  fromWorkspaceId: string;
  fromWorkspaceName: string;
  toEmail: string;
  note?: string;
  status: "pending" | "accepted" | "declined" | "canceled";
  createdAt: string;
}

let requests: TransferRequest[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

let seq = 0;
const newId = () => `tr_${Date.now().toString(36)}${(seq++).toString(36)}`;

export function useTransfers(): TransferRequest[] {
  return useSyncExternalStore(
    subscribe,
    () => requests,
    () => requests,
  );
}

export function pendingTransferFor(projectId: string): TransferRequest | undefined {
  return requests.find((r) => r.projectId === projectId && r.status === "pending");
}

export const transferActions = {
  /** Instant move into another workspace you belong to. */
  toOwnWorkspace(projectId: string, targetWorkspaceId: string) {
    projectActions.transfer(projectId, targetWorkspaceId);
  },
  /** Offer the project to someone else; stays pending until they act. */
  sendToEmail(input: {
    projectId: string;
    projectName: string;
    fromWorkspaceId: string;
    fromWorkspaceName: string;
    toEmail: string;
    note?: string;
  }): TransferRequest {
    const req: TransferRequest = {
      id: newId(),
      status: "pending",
      createdAt: new Date().toISOString(),
      ...input,
      toEmail: input.toEmail.trim().toLowerCase(),
    };
    requests = [req, ...requests];
    emit();
    return req;
  },
  /** Recipient accepts into the workspace whose dashboard they're on. */
  accept(requestId: string, intoWorkspaceId: string) {
    const req = requests.find((r) => r.id === requestId);
    if (!req || req.status !== "pending") return;
    projectActions.transfer(req.projectId, intoWorkspaceId);
    requests = requests.map((r) => (r.id === requestId ? { ...r, status: "accepted" as const } : r));
    emit();
  },
  decline(requestId: string) {
    requests = requests.map((r) => (r.id === requestId && r.status === "pending" ? { ...r, status: "declined" as const } : r));
    emit();
  },
  cancel(requestId: string) {
    requests = requests.map((r) => (r.id === requestId && r.status === "pending" ? { ...r, status: "canceled" as const } : r));
    emit();
  },
};
