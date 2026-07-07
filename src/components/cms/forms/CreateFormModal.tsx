import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, Mail, Send, Users2 } from "lucide-react";

type Template = "blank" | "contact" | "newsletter" | "lead";

const TEMPLATES: Array<{
  key: Template;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "blank", label: "Blank", desc: "Start with an empty canvas", icon: FileText },
  { key: "contact", label: "Contact", desc: "Name, email, message", icon: Send },
  { key: "newsletter", label: "Newsletter", desc: "Email + consent", icon: Mail },
  { key: "lead", label: "Lead capture", desc: "Name, email, company, details", icon: Users2 },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (input: { name: string; description?: string; template: Template }) => void;
  pending?: boolean;
}

export function CreateFormModal({ open, onOpenChange, onCreate, pending }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<Template>("blank");

  function submit() {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), description: description.trim() || undefined, template });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setName("");
          setDescription("");
          setTemplate("blank");
        }
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>New form</DialogTitle>
          <DialogDescription>Give your form a name and pick a starter.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="form-name">Name</Label>
            <Input
              id="form-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contact form"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="form-desc">Description (optional)</Label>
            <Textarea
              id="form-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Used on the contact page"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Starter</Label>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => {
                const active = template === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTemplate(t.key)}
                    className={`flex items-start gap-2 rounded-md border p-3 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border bg-[color:var(--panel)] hover:border-border/80"
                    }`}
                  >
                    <t.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">{t.label}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || pending}>
            {pending ? "Creating…" : "Create form"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
