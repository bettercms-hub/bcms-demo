/**
 * Onboarding — first run after signup.
 *
 * Four quick questions (role, what you build, team size, where you heard
 * about us), then workspace creation and invites. Every answer either
 * personalizes the next screen or feeds the growth funnel; nothing is
 * asked for decoration. Choice screens advance on click, the whole flow
 * is keyboard-first, and only invites are skippable.
 */
import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Blocks,
  Briefcase,
  Building2,
  Code2,
  Megaphone,
  MessageCircle,
  Newspaper,
  PenLine,
  Rocket,
  Search,
  Sparkles,
  SquarePen,
  User,
  Users,
  Youtube,
} from "lucide-react";
import { toast } from "sonner";
import { workspaceActions } from "@/lib/cms/store";
import { enableGuest } from "@/lib/guest";
import {
  getOnboarding,
  onboardingFirstName,
  patchOnboarding,
  type OnboardingRole,
  type OnboardingSource,
  type OnboardingTeam,
  type OnboardingUsage,
} from "@/lib/onboarding/onboarding-store";
import { ChoiceStep, InviteStep, OnboardingShell, WorkspaceStep } from "@/components/onboarding/steps";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

const STEPS = ["role", "usage", "team", "source", "workspace", "invite"] as const;

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [wsName, setWsName] = useState("");
  const [wsSlug, setWsSlug] = useState("");
  const profile = getOnboarding();
  const first = onboardingFirstName();

  const usage = profile.usage;
  const wsTitle =
    usage === "clients"
      ? "Name your agency workspace"
      : usage === "product"
        ? "Name your team workspace"
        : "Name your workspace";
  const wsSubtitle =
    usage === "clients"
      ? "One workspace for your team. Each client becomes a project inside it."
      : "Projects, people and billing live here. Usually your company name.";

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <OnboardingShell step={step} stepCount={STEPS.length} onBack={step > 0 ? back : undefined}>
      {STEPS[step] === "role" && (
        <ChoiceStep<OnboardingRole>
          title={first ? `Nice to meet you, ${first}. What do you do?` : "What do you do?"}
          subtitle="We tune the workspace to how you work. You can change everything later."
          columns={3}
          selected={profile.role}
          choices={[
            { id: "developer", label: "Developer", blurb: "Schemas, sections, APIs", icon: Code2 },
            { id: "marketer", label: "Marketer", blurb: "Pages, campaigns, SEO", icon: Megaphone },
            { id: "editor", label: "Content editor", blurb: "Writing and publishing", icon: SquarePen },
            { id: "designer", label: "Designer", blurb: "Brand and layout", icon: PenLine },
            { id: "founder", label: "Founder or exec", blurb: "A bit of everything", icon: Rocket },
            { id: "other", label: "Something else", icon: User },
          ]}
          onPick={(role) => {
            patchOnboarding({ role });
            next();
          }}
        />
      )}

      {STEPS[step] === "usage" && (
        <ChoiceStep<OnboardingUsage>
          title="What are you building?"
          subtitle="This shapes your workspace defaults."
          selected={profile.usage}
          choices={[
            { id: "company", label: "Our company website", blurb: "Marketing site, landing pages, blog", icon: Building2 },
            { id: "clients", label: "Client websites", blurb: "Agency or freelance, several sites", icon: Briefcase },
            { id: "product", label: "Product or docs site", blurb: "Content behind an app or API", icon: Blocks },
            { id: "personal", label: "A personal project", blurb: "Blog, portfolio, side project", icon: Newspaper },
          ]}
          onPick={(usage) => {
            patchOnboarding({ usage });
            next();
          }}
        />
      )}

      {STEPS[step] === "team" && (
        <ChoiceStep<OnboardingTeam>
          title="How many people will work in here?"
          subtitle="Seats are free to start, so this is just for sizing."
          selected={profile.team}
          choices={[
            { id: "solo", label: "Just me", icon: User },
            { id: "small", label: "2 to 10", icon: Users },
            { id: "mid", label: "11 to 50", icon: Users },
            { id: "large", label: "More than 50", icon: Building2 },
          ]}
          onPick={(team) => {
            patchOnboarding({ team });
            next();
          }}
        />
      )}

      {STEPS[step] === "source" && (
        <ChoiceStep<OnboardingSource>
          title="Where did you hear about BetterCMS?"
          subtitle="One last question, it genuinely helps a small team."
          columns={3}
          selected={profile.source}
          choices={[
            { id: "search", label: "Search", icon: Search },
            { id: "x", label: "X", icon: MessageCircle },
            { id: "linkedin", label: "LinkedIn", icon: Briefcase },
            { id: "youtube", label: "YouTube", icon: Youtube },
            { id: "friend", label: "Friend or colleague", icon: Users },
            { id: "ai", label: "An AI assistant", icon: Sparkles },
            { id: "newsletter", label: "Podcast or newsletter", icon: Newspaper },
            { id: "other", label: "Somewhere else", icon: User },
          ]}
          onPick={(source) => {
            patchOnboarding({ source });
            next();
          }}
        />
      )}

      {STEPS[step] === "workspace" && (
        <WorkspaceStep
          title={wsTitle}
          subtitle={wsSubtitle}
          initialName={wsName}
          ctaLabel="Create workspace"
          onSubmit={(name) => {
            const ws = workspaceActions.create({ name });
            setWsName(ws.name);
            setWsSlug(ws.slug);
            next();
          }}
        />
      )}

      {STEPS[step] === "invite" && (
        <InviteStep
          workspaceName={wsName}
          onFinish={(emails) => {
            patchOnboarding({ completedAt: Date.now() });
            // The demo session gate: onboarding accounts browse as the owner.
            enableGuest();
            if (emails.length > 0) toast.success(`${emails.length} ${emails.length === 1 ? "invite" : "invites"} sent`);
            navigate({ to: "/w/$workspace", params: { workspace: wsSlug }, replace: true });
          }}
        />
      )}
    </OnboardingShell>
  );
}
