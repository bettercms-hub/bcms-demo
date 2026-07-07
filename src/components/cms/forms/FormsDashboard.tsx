import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Inbox,
  CheckCircle2,
  Activity,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageShell, Section } from "@/components/cms/layout";
import { HeadlessApiCallout } from "@/components/cms/headless/HeadlessApiCallout";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import {
  getFormsDashboard,
  createForm,
  duplicateForm,
  deleteForm,
} from "@/lib/forms/forms.store";
import { formActionLink, formBuilderLink, type FormAction } from "@/lib/forms/nav";
import { FormCard } from "./FormCard";
import { CreateFormModal } from "./CreateFormModal";

export function FormsDashboard() {
  const { workspace, project } = useParams({ strict: false }) as {
    workspace: string;
    project: string;
  };
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pr = getProjectBySlug(workspace, project);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery<import("@/lib/forms/types").FormsDashboardData>({
    queryKey: ["forms-dashboard", project],
    queryFn: () => getFormsDashboard({ data: { projectSlug: project } }),
  });

  const create = createForm;
  const dup = duplicateForm;
  const del = deleteForm;

  const createMut = useMutation({
    mutationFn: (input: { name: string; description?: string; template?: "blank" | "contact" | "newsletter" | "lead" }) =>
      create({ data: { projectSlug: project, ...input } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["forms-dashboard", project] });
      toast.success("Form created");
      setCreateOpen(false);
      navigate(formBuilderLink({ workspace, project, formId: res.id, tab: "build" }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dupMut = useMutation({
    mutationFn: (formId: string) => dup({ data: { formId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forms-dashboard", project] });
      toast.success("Form duplicated");
    },
  });

  const delMut = useMutation({
    mutationFn: (formId: string) => del({ data: { formId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forms-dashboard", project] });
      toast.success("Form deleted");
    },
  });

  const stats = data?.stats ?? {
    totalForms: 0,
    activeForms: 0,
    totalSubmissions: 0,
    submissionsToday: 0,
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-auto bg-[color:var(--canvas)]">
      <PageShell
        breadcrumbs={[
          { label: workspace, to: "/w/$workspace", params: { workspace } },
          {
            label: project,
            to: "/w/$workspace/p/$project/editor",
            params: { workspace, project },
          },
          { label: "Forms" },
        ]}
        title="Forms"
        description="Design forms visually, drop them into pages, and route submissions to Slack, Sheets, webhooks, and more."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New form
          </Button>
        }
      >
        {pr?.kind === "headless" && (
          <div className="mb-6">
            <HeadlessApiCallout
              path={`/api/public/projects/${pr.id}/forms/:formSlug`}
              keyType="Public"
              description="Your frontend fetches a form's config to render it, then posts submissions to POST /api/forms/:formId/submit — BetterCMS validates, stores, emails, and fires webhooks."
            />
          </div>
        )}
        <Section title="Overview">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={FileText} label="Total forms" value={stats.totalForms} />
            <Stat icon={CheckCircle2} label="Active" value={stats.activeForms} />
            <Stat icon={Inbox} label="Submissions" value={stats.totalSubmissions} />
            <Stat icon={Activity} label="Today" value={stats.submissionsToday} />
          </div>
        </Section>

        <Section title="All forms" meta={`${data?.allForms.length ?? 0}`}>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[140px] animate-pulse rounded-xl bg-[color:var(--surface-3)]"
                />
              ))}
            </div>
          ) : data?.allForms.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.allForms.map((f) => {
                const go = (action: FormAction) =>
                  navigate(formActionLink({ workspace, project, formId: f.id, action }));
                return (
                  <FormCard
                    key={f.id}
                    form={f}
                    onEdit={() => go("edit")}
                    onDuplicate={() => dupMut.mutate(f.id)}
                    onSubmissions={() => go("submissions")}
                    onCode={() => go("code")}
                    onDelete={() => {
                      if (confirm(`Delete "${f.name}"? This cannot be undone.`)) {
                        delMut.mutate(f.id);
                      }
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[color:var(--border-hairline)] bg-[color:var(--surface-3)] p-10 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground/70" />
              <h3 className="mt-3 text-[14px] font-semibold text-foreground">No forms yet</h3>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Create your first form to start collecting submissions.
              </p>
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> New form
              </Button>
            </div>
          )}
        </Section>
      </PageShell>

      <CreateFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={(input) => createMut.mutate(input)}
        pending={createMut.isPending}
      />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border-hairline)] bg-card p-4">
      <div className="flex items-center gap-2 text-[11.5px] font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-[22px] font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}

