import { queryOptions } from "@tanstack/react-query";
import { listThreads } from "./comments.functions";
import { listReactionsForThread } from "./reactions.functions";
import { getUnreadThreadIds } from "./read-state.functions";
import { listMentionables } from "./mentions.functions";

export function threadsQueryOptions(args: {
  workspaceId: string;
  projectId?: string;
  surface?: string;
  pageId?: string;
}) {
  return queryOptions({
    queryKey: ["comment-threads", args.workspaceId, args.projectId, args.surface, args.pageId],
    queryFn: () => listThreads({ data: args }),
    staleTime: 10_000,
  });
}

export function threadReactionsQueryOptions(threadId: string | null) {
  return queryOptions({
    queryKey: ["comment-reactions", threadId],
    queryFn: () => (threadId ? listReactionsForThread({ data: { threadId } }) : Promise.resolve([])),
    enabled: Boolean(threadId),
    staleTime: 5_000,
  });
}

export function unreadThreadsQueryOptions(args: {
  workspaceId: string;
  projectId?: string;
}) {
  return queryOptions({
    queryKey: ["comment-unread", args.workspaceId, args.projectId],
    queryFn: () =>
      args.workspaceId ? getUnreadThreadIds({ data: args }) : Promise.resolve([]),
    enabled: Boolean(args.workspaceId),
    staleTime: 5_000,
  });
}

export function mentionablesQueryOptions(args: { workspaceId: string; query?: string }) {
  return queryOptions({
    queryKey: ["mentionables", args.workspaceId, args.query ?? ""],
    queryFn: () => listMentionables({ data: args }),
    enabled: Boolean(args.workspaceId),
    staleTime: 60_000,
  });
}

export const threadsKey = (workspaceId: string) => ["comment-threads", workspaceId];
