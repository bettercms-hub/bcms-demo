import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { SettingsHeader, SettingsRow, SettingsSection } from "@/components/cms/SettingsSubNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCMS, workspaceActions } from "@/lib/cms/store";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/w/$workspace/settings/general")({
  component: General,
});

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function General() {
  const { workspace } = Route.useParams();
  const navigate = useNavigate();
  // Read reactively so edits made here reflect immediately everywhere.
  const ws = useCMS((s) => s.workspaces.find((w) => w.slug === workspace));

  const [name, setName] = useState(ws?.name ?? "");
  const [slug, setSlug] = useState(ws?.slug ?? "");
  const [logoUrl, setLogoUrl] = useState<string | undefined>(ws?.logoUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ws) return null;

  const slugNorm = normalizeSlug(slug);
  const dirty =
    name.trim() !== ws.name || slugNorm !== ws.slug || (logoUrl ?? "") !== (ws.logoUrl ?? "");
  const initials = (name.trim() || ws.name).slice(0, 2);

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > 1_500_000) {
      toast.error("Image is too large", { description: "Use a file under 1.5 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result as string);
    reader.onerror = () => toast.error("Couldn't read that image");
    reader.readAsDataURL(file);
  }

  function handleSave() {
    if (!ws) return;
    const nextName = name.trim();
    if (!nextName) {
      toast.error("Workspace name can't be empty");
      return;
    }
    if (!slugNorm) {
      toast.error("Slug can't be empty");
      return;
    }
    if (workspaceActions.slugTaken(slugNorm, ws.id)) {
      toast.error(`The slug "${slugNorm}" is already in use`);
      return;
    }
    workspaceActions.update(ws.id, { name: nextName, slug: slugNorm, logoUrl });
    setName(nextName);
    setSlug(slugNorm);
    toast.success("Workspace updated");
    if (slugNorm !== ws.slug) {
      // The slug is the URL — move to the new address so links keep working.
      navigate({ to: "/w/$workspace/settings/general", params: { workspace: slugNorm }, replace: true });
    }
  }

  function handleDiscard() {
    setName(ws!.name);
    setSlug(ws!.slug);
    setLogoUrl(ws!.logoUrl);
  }

  return (
    <div className="pb-24">
      <SettingsHeader title="General" description="Workspace identity, region, and defaults." />

      <SettingsSection title="Identity" description="How your workspace appears in BetterCMS.">
        <SettingsRow label="Workspace logo" description="Square image, at least 256×256 pixels.">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-[color:var(--color-elevated)] text-[15px] font-semibold uppercase text-foreground">
              {logoUrl ? (
                <img src={logoUrl} alt="Workspace logo" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={onLogoFile}
            />
            <Button
              variant="secondary"
              size="sm"
              className="h-8 text-[13px]"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="mr-1.5 h-3.5 w-3.5" /> {logoUrl ? "Replace" : "Upload logo"}
            </Button>
            {logoUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[13px] text-muted-foreground hover:text-foreground"
                onClick={() => setLogoUrl(undefined)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
              </Button>
            )}
          </div>
        </SettingsRow>
        <SettingsRow label="Workspace name" description="Displayed throughout BetterCMS.">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </SettingsRow>
        <SettingsRow label="Slug" description="Used in URLs and API requests.">
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono" />
        </SettingsRow>
        <SettingsRow label="Workspace ID" description="Read-only identifier.">
          <Input readOnly value={ws.id} className="font-mono" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Localization" description="Region and language defaults for new projects.">
        <SettingsRow label="Timezone" description="Used for scheduling and reports.">
          <Select defaultValue="utc">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="utc">UTC (Coordinated Universal Time)</SelectItem>
              <SelectItem value="est">America/New_York</SelectItem>
              <SelectItem value="pst">America/Los_Angeles</SelectItem>
              <SelectItem value="cet">Europe/Berlin</SelectItem>
              <SelectItem value="jst">Asia/Tokyo</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow label="Region" description="Data residency for storage and processing.">
          <Select defaultValue="us-east">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="us-east">United States (us-east)</SelectItem>
              <SelectItem value="eu-west">Europe (eu-west)</SelectItem>
              <SelectItem value="ap-south">Asia Pacific (ap-south)</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow label="Language" description="Default workspace interface language.">
          <Select defaultValue="en">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="de">German</SelectItem>
              <SelectItem value="ja">Japanese</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="AI preferences" description="Defaults applied across all projects in this workspace.">
        <SettingsRow label="Default AI model" description="Used for content generation and assistance.">
          <Select defaultValue="auto">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (recommended)</SelectItem>
              <SelectItem value="gpt-4">GPT-4</SelectItem>
              <SelectItem value="claude">Claude 3.5 Sonnet</SelectItem>
              <SelectItem value="gemini">Gemini Pro</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow label="Tone" description="Default writing tone for AI-generated content.">
          <Select defaultValue="neutral">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="friendly">Friendly</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="playful">Playful</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsSection>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[color:var(--color-elevated)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-3">
            <p className="text-[13px] text-muted-foreground">You have unsaved changes.</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-[13px]" onClick={handleDiscard}>
                Discard
              </Button>
              <Button size="sm" className="h-8 text-[13px]" onClick={handleSave}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
