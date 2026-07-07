import { createServerFn } from "@tanstack/react-start";

const DEMO_USER_ID = "11111111-1111-1111-1111-111111111111";

function admin() {
  return import("@/integrations/supabase/client.server").then((m) => m.supabaseAdmin);
}

export const toggleReaction = createServerFn({ method: "POST" })
  .inputValidator((d: { messageId: string; emoji: string; userId?: string }) => d)
  .handler(async ({ data }) => {
    const sb = await admin();
    const userId = data.userId ?? DEMO_USER_ID;
    const { data: existing } = await sb
      .from("comment_reaction")
      .select("id")
      .eq("message_id", data.messageId)
      .eq("user_id", userId)
      .eq("emoji", data.emoji)
      .maybeSingle();
    if (existing) {
      await sb.from("comment_reaction").delete().eq("id", (existing as { id: string }).id);
      return { ok: true, removed: true };
    }
    await sb.from("comment_reaction").insert({
      message_id: data.messageId,
      user_id: userId,
      emoji: data.emoji,
    });
    return { ok: true, removed: false };
  });

export const listReactionsForThread = createServerFn({ method: "POST" })
  .inputValidator((d: { threadId: string }) => d)
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: msgs } = await sb
      .from("comment_message")
      .select("id")
      .eq("thread_id", data.threadId);
    const ids = (msgs ?? []).map((m) => (m as { id: string }).id);
    if (ids.length === 0) return [];
    const { data: rxns } = await sb
      .from("comment_reaction")
      .select("id,message_id,user_id,emoji,created_at")
      .in("message_id", ids);
    return (rxns ?? []) as Array<{
      id: string;
      message_id: string;
      user_id: string;
      emoji: string;
      created_at: string;
    }>;
  });
