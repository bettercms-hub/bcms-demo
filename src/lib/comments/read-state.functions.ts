import { createServerFn } from "@tanstack/react-start";

const DEMO_USER_ID = "11111111-1111-1111-1111-111111111111";

function admin() {
  return import("@/integrations/supabase/client.server").then((m) => m.supabaseAdmin);
}

export const markThreadRead = createServerFn({ method: "POST" })
  .inputValidator((d: { threadId: string; userId?: string }) => d)
  .handler(async ({ data }) => {
    const sb = await admin();
    const userId = data.userId ?? DEMO_USER_ID;
    await sb
      .from("comment_read_state")
      .upsert(
        { thread_id: data.threadId, user_id: userId, last_read_at: new Date().toISOString() },
        { onConflict: "thread_id,user_id" },
      );
    return { ok: true };
  });

export const getUnreadThreadIds = createServerFn({ method: "POST" })
  .inputValidator((d: { workspaceId: string; projectId?: string; userId?: string }) => d)
  .handler(async ({ data }): Promise<string[]> => {
    const sb = await admin();
    const userId = data.userId ?? DEMO_USER_ID;

    let tq = sb
      .from("comment_thread")
      .select("id,last_activity_at")
      .eq("workspace_id", data.workspaceId);
    if (data.projectId) tq = tq.eq("project_id", data.projectId);
    const { data: threads } = await tq;
    if (!threads || threads.length === 0) return [];

    const ids = threads.map((t) => (t as { id: string }).id);
    const { data: reads } = await sb
      .from("comment_read_state")
      .select("thread_id,last_read_at")
      .eq("user_id", userId)
      .in("thread_id", ids);
    const readMap = new Map<string, string>();
    (reads ?? []).forEach((r) => {
      const row = r as { thread_id: string; last_read_at: string };
      readMap.set(row.thread_id, row.last_read_at);
    });

    return threads
      .filter((t) => {
        const row = t as { id: string; last_activity_at: string };
        const lastRead = readMap.get(row.id);
        return !lastRead || new Date(row.last_activity_at) > new Date(lastRead);
      })
      .map((t) => (t as { id: string }).id);
  });
