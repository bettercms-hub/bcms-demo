import { createFileRoute, Link, useParams, useRouter } from "@tanstack/react-router";
import { FormBuilder } from "@/components/cms/forms/builder/FormBuilder";
import { Button } from "@/components/ui/button";
import { FileQuestion, AlertTriangle } from "lucide-react";

type Tab = "build" | "submissions" | "integrations" | "code";

export const Route = createFileRoute("/w/$workspace/p/$project/forms/$formId")({
  validateSearch: (s: Record<string, unknown>): { tab: Tab } => {
    const t = s.tab;
    const tab: Tab =
      t === "submissions" || t === "integrations" || t === "code" ? t : "build";
    return { tab };
  },
  component: FormBuilderRoute,
  errorComponent: FormError,
  notFoundComponent: FormNotFound,
});

function FormBuilderRoute() {
  const { formId } = Route.useParams();
  const { tab } = Route.useSearch();
  return <FormBuilder formId={formId} tab={tab} />;
}

function FormNotFound() {
  const { workspace, project } = useParams({ strict: false }) as {
    workspace: string;
    project: string;
  };
  return (
    <Centered
      icon={FileQuestion}
      title="Form not found"
      description="This form may have been deleted, or the link is incorrect."
    >
      <Button asChild size="sm">
        <Link
          to="/w/$workspace/p/$project/forms"
          params={{ workspace, project }}
        >
          Back to forms
        </Link>
      </Button>
    </Centered>
  );
}

function FormError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const { workspace, project } = useParams({ strict: false }) as {
    workspace: string;
    project: string;
  };
  return (
    <Centered
      icon={AlertTriangle}
      title="Couldn't load this form"
      description={error.message || "Something went wrong loading the form."}
    >
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Try again
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link
            to="/w/$workspace/p/$project/forms"
            params={{ workspace, project }}
          >
            Back to forms
          </Link>
        </Button>
      </div>
    </Centered>
  );
}

function Centered({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-1 items-center justify-center bg-[color:var(--canvas)] p-10">
      <div className="max-w-sm rounded-lg border border-dashed border-border bg-[color:var(--panel)] p-8 text-center">
        <Icon className="mx-auto h-8 w-8 text-muted-foreground/70" />
        <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
        <div className="mt-5 flex justify-center">{children}</div>
      </div>
    </div>
  );
}
