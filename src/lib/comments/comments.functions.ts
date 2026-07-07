import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  AnchorKind,
  AnchorRef,
  Attachment,
  AuthorKind,
  CommentMessage,
  CommentSurface,
  CommentThread,
  Mention,
  Priority,
  SuggestedEdit,
  ThreadStatus,
  Viewport,
} from "./types";

// Phase 1 has no real auth (forms/SEO follow the same pattern). We use the
// service-role client and pass a stable demo identity from the client. When
// auth is wired in, swap this for requireSupabaseAuth + auth.uid().
const DEMO_USER_ID = "11111111-1111-1111-1111-111111111111";

function admin() {
  // dynamic import keeps client.server out of the client bundle
  return import("@/integrations/supabase/client.server").then((m) => m.supabaseAdmin);
}

function mapThread(row: Record<string, unknown>, messages: CommentMessage[] = []): CommentThread {
  return {
    id: row.id as string,
    workspace_id: row.workspace_id as string,
    project_id: (row.project_id as string | null) ?? null,
    surface: row.surface as CommentSurface,
    page_id: (row.page_id as string | null) ?? null,
    anchor_kind: row.anchor_kind as AnchorKind,
    anchor_ref: (row.anchor_ref as AnchorRef) ?? {},
    viewport: (row.viewport as Viewport) ?? {},
    version_label: (row.version_label as string | null) ?? null,
    status: row.status as ThreadStatus,
    priority: row.priority as Priority,
    assignee_user_id: (row.assignee_user_id as string | null) ?? null,
    created_by: row.created_by as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    resolved_at: (row.resolved_at as string | null) ?? null,
    last_activity_at: row.last_activity_at as string,
    messages,
  };
}

function mapMessage(row: Record<string, unknown>): CommentMessage {
  return {
    id: row.id as string,
    thread_id: row.thread_id as string,
    author_kind: row.author_kind as AuthorKind,
    author_user_id: (row.author_user_id as string | null) ?? null,
    body: (row.body as string) ?? "",
    mentions: (row.mentions as Mention[]) ?? [],
    attachments: (row.attachments as Attachment[]) ?? [],
    suggested_edit: (row.suggested_edit as SuggestedEdit | null) ?? null,
    parent_message_id: (row.parent_message_id as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

// =========================================================================
// listThreads — by project, optional surface/page filter
// =========================================================================
export const listThreads = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { workspaceId: string; projectId?: string; surface?: string; pageId?: string }) =>
      z
        .object({
          workspaceId: z.string().uuid(),
          projectId: z.string().uuid().optional(),
          surface: z.string().optional(),
          pageId: z.string().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }): Promise<CommentThread[]> => {
    const sb = await admin();
    let q = sb
      .from("comment_thread")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("last_activity_at", { ascending: false });
    if (data.projectId) q = q.eq("project_id", data.projectId);
    if (data.surface) q = q.eq("surface", data.surface as CommentSurface);
    if (data.pageId) q = q.eq("page_id", data.pageId);

    const { data: threads, error } = await q;
    if (error) throw new Error(error.message);
    if (!threads || threads.length === 0) return [];

    const ids = threads.map((t) => (t as { id: string }).id);
    const { data: msgs } = await sb
      .from("comment_message")
      .select("*")
      .in("thread_id", ids)
      .order("created_at", { ascending: true });

    const byThread = new Map<string, CommentMessage[]>();
    (msgs ?? []).forEach((m) => {
      const tid = (m as { thread_id: string }).thread_id;
      if (!byThread.has(tid)) byThread.set(tid, []);
      byThread.get(tid)!.push(mapMessage(m as Record<string, unknown>));
    });
    return threads.map((t) =>
      mapThread(t as Record<string, unknown>, byThread.get((t as { id: string }).id) ?? []),
    );
  });

// =========================================================================
// createThread (+ first message)
// =========================================================================
export const createThread = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      workspaceId: string;
      projectId?: string;
      surface: string;
      pageId?: string;
      anchorKind: AnchorKind;
      anchorRef?: AnchorRef;
      viewport?: Viewport;
      versionLabel?: string;
      body: string;
      mentions?: Mention[];
      attachments?: Attachment[];
      userId?: string;
    }) => d,
  )
  .handler(async ({ data }): Promise<CommentThread> => {
    const sb = await admin();
    const author = data.userId ?? DEMO_USER_ID;

    const { data: thread, error } = await sb
      .from("comment_thread")
      .insert({
        workspace_id: data.workspaceId,
        project_id: data.projectId ?? null,
        surface: data.surface as CommentSurface,
        page_id: data.pageId ?? null,
        anchor_kind: data.anchorKind,
        anchor_ref: (data.anchorRef ?? {}) as never,
        viewport: (data.viewport ?? {}) as never,
        version_label: data.versionLabel ?? null,
        created_by: author,
      })
      .select("*")
      .single();
    if (error || !thread) throw new Error(error?.message ?? "Failed to create thread");

    const { data: msg, error: msgErr } = await sb
      .from("comment_message")
      .insert({
        thread_id: (thread as { id: string }).id,
        author_kind: "user",
        author_user_id: author,
        body: data.body,
        mentions: (data.mentions ?? []) as never,
        attachments: (data.attachments ?? []) as never,
      })
      .select("*")
      .single();
    if (msgErr) throw new Error(msgErr.message);

    return mapThread(thread as Record<string, unknown>, [
      mapMessage(msg as Record<string, unknown>),
    ]);
  });

// =========================================================================
// addMessage
// =========================================================================
export const addMessage = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      threadId: string;
      body: string;
      mentions?: Mention[];
      attachments?: Attachment[];
      authorKind?: AuthorKind;
      userId?: string;
      suggestedEdit?: SuggestedEdit;
    }) => d,
  )
  .handler(async ({ data }): Promise<CommentMessage> => {
    const sb = await admin();
    const { data: msg, error } = await sb
      .from("comment_message")
      .insert({
        thread_id: data.threadId,
        author_kind: data.authorKind ?? "user",
        author_user_id: data.userId ?? DEMO_USER_ID,
        body: data.body,
        mentions: (data.mentions ?? []) as never,
        attachments: (data.attachments ?? []) as never,
        suggested_edit: (data.suggestedEdit ?? null) as never,
      })
      .select("*")
      .single();
    if (error || !msg) throw new Error(error?.message ?? "Failed to add message");
    return mapMessage(msg as Record<string, unknown>);
  });

// =========================================================================
// resolve / reopen / assign / setPriority / delete
// =========================================================================
export const setThreadStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { threadId: string; status: ThreadStatus }) => d)
  .handler(async ({ data }) => {
    const sb = await admin();
    await sb
      .from("comment_thread")
      .update({
        status: data.status,
        resolved_at: data.status === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", data.threadId);
    return { ok: true };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .inputValidator((d: { threadId: string }) => d)
  .handler(async ({ data }) => {
    const sb = await admin();
    await sb.from("comment_thread").delete().eq("id", data.threadId);
    return { ok: true };
  });

// =========================================================================
// AI action — non-streaming, appends an assistant message to the thread
// =========================================================================
export const runCommentAi = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      threadId: string;
      systemPrompt: string;
      userPrompt: string;
      selection?: string;
      produceSuggestion?: boolean;
    }) => d,
  )
  .handler(async ({ data }): Promise<CommentMessage> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const sb = await admin();
    const { data: history } = await sb
      .from("comment_message")
      .select("author_kind,body")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: data.systemPrompt },
    ];
    (history ?? []).slice(-12).forEach((row) => {
      const r = row as { author_kind: string; body: string };
      messages.push({
        role: r.author_kind === "ai" ? "assistant" : "user",
        content: r.body,
      });
    });
    if (data.selection) {
      messages.push({
        role: "user",
        content: `Selected content:\n"""\n${data.selection}\n"""\n\nTask: ${data.userPrompt}`,
      });
    } else {
      messages.push({ role: "user", content: data.userPrompt });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
      throw new Error(`AI request failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = json.choices?.[0]?.message?.content?.trim() ?? "(no response)";

    const suggestedEdit: SuggestedEdit | null =
      data.produceSuggestion && data.selection
        ? { before: data.selection, after: reply, applied: false }
        : null;

    const { data: msg, error } = await sb
      .from("comment_message")
      .insert({
        thread_id: data.threadId,
        author_kind: "ai",
        author_user_id: null,
        body: reply,
        suggested_edit: suggestedEdit as never,
      })
      .select("*")
      .single();
    if (error || !msg) throw new Error(error?.message ?? "Failed to persist AI reply");
    return mapMessage(msg as Record<string, unknown>);
  });

// =========================================================================
// applySuggestion — mark a suggested_edit as applied (caller applies to CMS)
// =========================================================================
export const markSuggestionApplied = createServerFn({ method: "POST" })
  .inputValidator((d: { messageId: string }) => d)
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: row } = await sb
      .from("comment_message")
      .select("suggested_edit")
      .eq("id", data.messageId)
      .single();
    const current = (row as { suggested_edit: SuggestedEdit | null } | null)?.suggested_edit;
    if (!current) return { ok: false };
    await sb
      .from("comment_message")
      .update({
        suggested_edit: { ...current, applied: true, appliedAt: new Date().toISOString() } as never,
      })
      .eq("id", data.messageId);
    return { ok: true };
  });
