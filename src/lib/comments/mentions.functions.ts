import { createServerFn } from "@tanstack/react-start";

function admin() {
  return import("@/integrations/supabase/client.server").then((m) => m.supabaseAdmin);
}

export interface Mentionable {
  kind: "user" | "agent";
  id: string;
  label: string;
  sublabel?: string;
}

const AI_AGENTS: Mentionable[] = [
  { kind: "agent", id: "ai", label: "AI", sublabel: "General assistant" },
  { kind: "agent", id: "ai-seo", label: "AI SEO", sublabel: "SEO specialist" },
  { kind: "agent", id: "ai-copy", label: "AI Copy", sublabel: "Copywriter" },
];

export const listMentionables = createServerFn({ method: "POST" })
  .inputValidator((d: { workspaceId: string; query?: string }) => d)
  .handler(async ({ data }): Promise<Mentionable[]> => {
    const sb = await admin();
    const { data: members } = await sb
      .from("workspace_member")
      .select("user_ref")
      .eq("workspace_id", data.workspaceId)
      .limit(50);

    const refs = (members ?? [])
      .map((m) => (m as { user_ref: string }).user_ref)
      .filter(Boolean);

    let users: Mentionable[] = [];
    if (refs.length > 0) {
      const uuidRefs = refs.filter((r) => /^[0-9a-f-]{36}$/i.test(r));
      if (uuidRefs.length > 0) {
        const { data: profs } = await sb
          .from("profiles")
          .select("id,email,full_name")
          .in("id", uuidRefs);
        users = (profs ?? []).map((p) => {
          const row = p as { id: string; email: string | null; full_name: string | null };
          return {
            kind: "user" as const,
            id: row.id,
            label: row.full_name || row.email?.split("@")[0] || "Member",
            sublabel: row.email ?? undefined,
          };
        });
      }
    }

    const q = (data.query ?? "").trim().toLowerCase();
    const all = [...AI_AGENTS, ...users];
    if (!q) return all;
    return all.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        (m.sublabel ?? "").toLowerCase().includes(q),
    );
  });
