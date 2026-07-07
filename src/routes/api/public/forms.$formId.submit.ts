import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function sb() {
  return supabaseAdmin;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/forms/$formId/submit")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request, params }) => {
        const formId = params.formId;
        let payload: Record<string, unknown> = {};
        const ct = request.headers.get("content-type") ?? "";
        try {
          if (ct.includes("application/json")) {
            payload = (await request.json()) as Record<string, unknown>;
          } else if (
            ct.includes("application/x-www-form-urlencoded") ||
            ct.includes("multipart/form-data")
          ) {
            const fd = await request.formData();
            payload = Object.fromEntries(fd.entries());
          } else {
            const text = await request.text();
            if (text) {
              try {
                payload = JSON.parse(text);
              } catch {
                payload = { raw: text };
              }
            }
          }
        } catch {
          return Response.json(
            { ok: false, error: "Invalid body" },
            { status: 400, headers: CORS },
          );
        }

        const client = sb();
        const { data: form, error: ferr } = await client
          .from("form")
          .select("id,status,submit_action")
          .eq("id", formId)
          .maybeSingle();
        if (ferr || !form) {
          return Response.json(
            { ok: false, error: "Form not found" },
            { status: 404, headers: CORS },
          );
        }
        if (form.status !== "published") {
          return Response.json(
            { ok: false, error: "Form is not accepting submissions" },
            { status: 403, headers: CORS },
          );
        }

        const sourceUrl =
          (typeof payload._source === "string" && payload._source) ||
          request.headers.get("referer") ||
          null;
        const userAgent = request.headers.get("user-agent");
        const utm: Record<string, string> = {};
        for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
          const v = payload[k];
          if (typeof v === "string") utm[k] = v;
        }

        const { data: row, error } = await client
          .from("form_submission")
          .insert({
            form_id: formId,
            data: payload as any,
            source_url: sourceUrl,
            user_agent: userAgent,
            utm: utm as any,
          })
          .select("id")
          .single();
        if (error || !row) {
          return Response.json(
            { ok: false, error: error?.message ?? "Failed" },
            { status: 500, headers: CORS },
          );
        }

        // Fire enabled webhooks (best-effort, non-blocking failure)
        const { data: integrations = [] } = await client
          .from("form_integration")
          .select("kind,enabled,config")
          .eq("form_id", formId)
          .eq("enabled", true);
        await Promise.all(
          (integrations ?? []).map(async (i) => {
            try {
              const cfg = (i.config ?? {}) as Record<string, unknown>;
              if (i.kind === "webhook" && typeof cfg.url === "string" && cfg.url) {
                await fetch(cfg.url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ formId, submissionId: row.id, data: payload }),
                });
              } else if (
                i.kind === "slack" &&
                typeof cfg.webhook_url === "string" &&
                cfg.webhook_url
              ) {
                const text =
                  "*New form submission*\n" +
                  Object.entries(payload)
                    .filter(([k]) => !k.startsWith("_") && !k.startsWith("utm_"))
                    .map(([k, v]) => `• *${k}:* ${String(v)}`)
                    .join("\n");
                await fetch(cfg.webhook_url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text }),
                });
              }
              // email integration is config-only for now
            } catch {
              // swallow
            }
          }),
        );

        const submit = (form.submit_action ?? {}) as {
          kind?: string;
          message?: string;
          url?: string;
        };
        return Response.json(
          {
            ok: true,
            submissionId: row.id,
            action: submit.kind ?? "message",
            message: submit.message ?? "Thanks!",
            url: submit.url,
          },
          { status: 200, headers: CORS },
        );
      },
    },
  },
});
