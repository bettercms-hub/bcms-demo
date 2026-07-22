import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SettingsSection } from "@/components/cms/SettingsSubNav";
import { useCMS } from "@/lib/cms/store";
import { computeWorkspaceBill, fmtUSD } from "@/lib/billing/pricing";
import type { Workspace } from "@/lib/cms/types";
import { Check, CreditCard, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/w/$workspace/settings/billing/payment")({
  component: PaymentPage,
});

function fmtDateLong(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function PaymentPage() {
  const { workspace: slug } = Route.useParams();
  const ws = useCMS((s) => s.workspaces.find((w) => w.slug === slug));
  const wsProjects = useCMS((s) => (ws ? s.projects.filter((p) => ws.projectIds.includes(p.id)) : []));
  const wsMembers = useCMS((s) => (ws ? s.members.filter((m) => ws.memberIds.includes(m.id)) : []));

  if (!ws) {
    return (
      <div className="rounded-md border border-border bg-card p-6 text-[13px] text-muted-foreground">
        Workspace not found.
      </div>
    );
  }

  if (ws.billing?.managed) {
    return <ManagedPaymentPanel ws={ws} />;
  }

  const bill = computeWorkspaceBill(ws, wsProjects, wsMembers);
  const ownerEmail = wsMembers.find((m) => m.role === "owner")?.email ?? "";

  return (
    <div className="max-w-[880px]">
      <CardOnFile ws={ws} yearlyTotal={bill.cycle === "yearly" && bill.monthlyTotal ? bill.monthlyTotal * 12 : null} />
      <BillingContact wsName={ws.name} ownerEmail={ownerEmail} />
      <ChangeOrCancel slug={ws.slug} />
    </div>
  );
}

/* ================= Card on file ================= */

function CardOnFile({ ws, yearlyTotal }: { ws: Workspace; yearlyTotal: number | null }) {
  const card = ws.billing?.card;
  const [dialogOpen, setDialogOpen] = useState(false);
  const renews = fmtDateLong(ws.billing?.renewalDate);

  return (
    <SettingsSection
      title="Card on file"
      description="Charged automatically at renewal. Every charge shows on the Overview tab first."
      action={
        card && (
          <Button variant="outline" size="sm" className="h-8 text-[12.5px]" onClick={() => setDialogOpen(true)}>
            Update card
          </Button>
        )
      }
    >
      {card ? (
        <div className="flex flex-wrap items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="grid h-10 w-14 shrink-0 place-items-center rounded-md border border-[color:var(--border-hairline)] bg-[color:var(--surface)]">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-foreground">
                {card.brand} ending {card.last4}
              </div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                Expires {String(card.expMonth).padStart(2, "0")}/{card.expYear}
              </div>
            </div>
          </div>
          {renews && (
            <div className="text-[12.5px] text-muted-foreground">
              Next charge {renews}
              {yearlyTotal != null && <span> · {fmtUSD(yearlyTotal)} billed yearly</span>}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--status-live-bg)]">
            <Check className="h-4 w-4 text-[color:var(--status-success)]" />
          </div>
          <p className="text-[13px] text-foreground">
            No card on file. Nothing to pay. A card is only needed when you move to a paid plan.
          </p>
        </div>
      )}

      <UpdateCardDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </SettingsSection>
  );
}

function UpdateCardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-[16px]">Update card</DialogTitle>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border border-[color-mix(in_srgb,var(--status-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-warning)_10%,transparent)] px-2 py-0.5 text-[10.5px] font-semibold text-[color:var(--status-warning)]">
              Dodo Payments · Test mode
            </span>
          </div>
          <DialogDescription className="text-[13px]">
            This is a demo. No real card details are stored or charged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-[12px] font-medium text-muted-foreground">Card number</Label>
          <Input disabled value="4242 4242 4242 4242" className="h-9 font-mono text-[13px]" />
          <p className="text-[11.5px] text-muted-foreground">Test card, prefilled and locked.</p>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              toast.success("Card updated (test mode)");
              onOpenChange(false);
            }}
          >
            Save card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Billing contact ================= */

function BillingContact({ wsName, ownerEmail }: { wsName: string; ownerEmail: string }) {
  const [name, setName] = useState(wsName);
  const [email, setEmail] = useState(ownerEmail);

  return (
    <SettingsSection title="Billing contact" description="Where receipts and renewal notices are sent.">
      <div className="grid gap-4 py-3 md:grid-cols-2">
        <div>
          <Label className="text-[12px] font-medium text-muted-foreground">Workspace name</Label>
          <Input className="mt-1 h-9 text-[13px]" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label className="text-[12px] font-medium text-muted-foreground">Billing email</Label>
          <Input className="mt-1 h-9 text-[13px]" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end pb-3">
        <Button size="sm" className="h-8 text-[12.5px]" onClick={() => toast.success("Billing contact updated")}>
          Save changes
        </Button>
      </div>
    </SettingsSection>
  );
}

/* ================= Change or cancel ================= */

function ChangeOrCancel({ slug }: { slug: string }) {
  return (
    <SettingsSection title="Change or cancel" description="Move between plans whenever it makes sense for you.">
      <div className="flex flex-wrap items-center justify-between gap-4 py-3">
        <p className="text-[13px] text-foreground">Downgrades are as easy as upgrades. No hostage tactics.</p>
        <Button variant="outline" size="sm" className="h-9 text-[13px]" asChild>
          <Link to={`/w/${slug}/settings/plans` as string}>See plans</Link>
        </Button>
      </div>
    </SettingsSection>
  );
}

/* ================= Managed workspaces ================= */

function ManagedPaymentPanel({ ws }: { ws: Workspace }) {
  const managed = ws.billing?.managed;
  if (!managed) return null;
  const initials = managed.contactName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  const renews = fmtDateLong(ws.billing?.renewalDate);

  return (
    <div className="max-w-[880px]">
      <SettingsSection
        title="Billing is managed for you"
        description={ws.billing?.contractLabel ?? "Annual contract"}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-[13px] font-semibold text-primary">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-foreground">{managed.contactName}</div>
              <div className="text-[12px] text-muted-foreground">
                {managed.contactTitle}
                {managed.contactEmail && <span> · {managed.contactEmail}</span>}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-9 text-[13px]" asChild>
            <a href={`mailto:${managed.contactEmail ?? ""}`}>
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Contact your account manager
            </a>
          </Button>
        </div>
        <div className="border-t border-[color:var(--border-hairline)] py-3 text-[12.5px] leading-relaxed text-muted-foreground">
          {managed.note ?? "Your plan and payments run on the contract."}
          {renews && <span> Renews {renews}.</span>}
        </div>
      </SettingsSection>
    </div>
  );
}
