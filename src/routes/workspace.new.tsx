/**
 * New workspace — the standalone creation flow, reached from the workspace
 * switcher. Same two screens as the end of onboarding: name it, invite
 * people, land inside. Closable, since there is an app to go back to.
 */
import { useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { workspaceActions } from "@/lib/cms/store";
import { ChoiceStep, InviteStep, OnboardingShell, WorkspaceStep } from "@/components/onboarding/steps";
import { Briefcase, Building2, Newspaper } from "lucide-react";

export const Route = createFileRoute("/workspace/new")({
  component: NewWorkspacePage,
});

const STEPS = ["kind", "workspace", "invite"] as const;

function NewWorkspacePage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<"company" | "clients" | "personal">("company");
  const [wsName, setWsName] = useState("");
  const [wsSlug, setWsSlug] = useState("");

  const close = () => router.history.back();

  return (
    <OnboardingShell
      step={step}
      stepCount={STEPS.length}
      onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
      onClose={close}
    >
      {STEPS[step] === "kind" && (
        <ChoiceStep<"company" | "clients" | "personal">
          title="What is this workspace for?"
          subtitle="Workspaces separate teams, projects and billing."
          choices={[
            { id: "company", label: "A company or team", blurb: "One brand, one team, shared projects", icon: Building2 },
            { id: "clients", label: "Client work", blurb: "Agency setup, each client a project", icon: Briefcase },
            { id: "personal", label: "Personal projects", blurb: "Your own sites and experiments", icon: Newspaper },
          ]}
          onPick={(k) => {
            setKind(k);
            setStep(1);
          }}
        />
      )}

      {STEPS[step] === "workspace" && (
        <WorkspaceStep
          title={kind === "clients" ? "Name your agency workspace" : "Name your workspace"}
          subtitle={
            kind === "clients"
              ? "One workspace for your team. Each client becomes a project inside it."
              : "Projects, people and billing live here. You can rename it anytime."
          }
          initialName={wsName}
          ctaLabel="Create workspace"
          onSubmit={(name) => {
            const ws = workspaceActions.create({ name });
            setWsName(ws.name);
            setWsSlug(ws.slug);
            setStep(2);
          }}
        />
      )}

      {STEPS[step] === "invite" && (
        <InviteStep
          workspaceName={wsName}
          onFinish={(emails) => {
            if (emails.length > 0) toast.success(`${emails.length} ${emails.length === 1 ? "invite" : "invites"} sent`);
            navigate({ to: "/w/$workspace", params: { workspace: wsSlug }, replace: true });
          }}
        />
      )}
    </OnboardingShell>
  );
}
