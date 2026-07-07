import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SettingsSection, SettingsRow, FieldRow } from "@/components/cms/SettingsSubNav";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { useSaveSeoSettings, useSeoSettings } from "@/lib/seo/queries";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/general")({
  component: General,
});

function General() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project)!;
  const scope = { workspace, project };
  const { data: seo } = useSeoSettings(scope);
  const saveSeo = useSaveSeoSettings(scope);

  const [identity, setIdentity] = useState({
    name: pr.name,
    slug: pr.slug,
    description: pr.description ?? "",
  });

  const [seoForm, setSeoForm] = useState({
    default_title: "",
    default_description: "",
    default_og_image: "",
    default_twitter_handle: "",
  });

  useEffect(() => {
    if (!seo) return;
    setSeoForm({
      default_title: seo.default_title ?? "",
      default_description: seo.default_description ?? "",
      default_og_image: seo.default_og_image ?? "",
      default_twitter_handle: seo.default_twitter_handle ?? "",
    });
  }, [seo]);

  return (
    <>
      <PageHeader
        title="General"
        description="Site identity, branding, and defaults applied across this project."
        action={
          <Button
            size="sm"
            onClick={async () => {
              await saveSeo.mutateAsync(seoForm);
              toast.success("Project settings saved");
            }}
            disabled={saveSeo.isPending}
            className="gap-1.5"
          >
            {saveSeo.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save changes
          </Button>
        }
      />

      <SettingsSection title="Site identity" description="Name and URL details for this project.">
        <SettingsRow label="Site name">
          <Input
            value={identity.name}
            onChange={(e) => setIdentity((f) => ({ ...f, name: e.target.value }))}
            className="w-[320px]"
          />
        </SettingsRow>
        <SettingsRow label="Site slug" description="Used in URLs and APIs.">
          <Input
            value={identity.slug}
            onChange={(e) => setIdentity((f) => ({ ...f, slug: e.target.value }))}
            className="w-[320px] font-mono"
          />
        </SettingsRow>
        <FieldRow label="Description" description="Short summary shown internally.">
          <Textarea
            rows={3}
            value={identity.description}
            onChange={(e) => setIdentity((f) => ({ ...f, description: e.target.value }))}
          />
        </FieldRow>
        <SettingsRow label="Project ID" description="Read-only. Use in API calls and webhooks.">
          <Input readOnly value={pr.id} className="w-[320px] font-mono" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Branding" description="Visual identity and app icons.">
        <SettingsRow label="Logo" description="Shown in the site header. SVG or PNG.">
          <BrandingThumb label="Upload logo" />
        </SettingsRow>
        <SettingsRow label="Favicon" description="32×32 ICO or PNG.">
          <BrandingThumb label="Upload favicon" />
        </SettingsRow>
        <SettingsRow label="Light app icon" description="Used in light theme installs.">
          <BrandingThumb label="Upload icon" />
        </SettingsRow>
        <SettingsRow label="Dark app icon" description="Used in dark theme installs.">
          <BrandingThumb label="Upload icon" />
        </SettingsRow>
        <SettingsRow label="Social preview" description="Default share image. 1200×630 recommended.">
          <BrandingThumb label="Upload image" wide />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Search & social"
        description="Fallback metadata for pages that don't override it."
      >
        <SettingsRow label="Default SEO title">
          <Input
            value={seoForm.default_title}
            onChange={(e) => setSeoForm((f) => ({ ...f, default_title: e.target.value }))}
            placeholder="Acme — Modern websites"
            className="w-[360px]"
          />
        </SettingsRow>
        <FieldRow label="Default meta description" description="Shown in search results.">
          <Textarea
            rows={2}
            value={seoForm.default_description}
            onChange={(e) => setSeoForm((f) => ({ ...f, default_description: e.target.value }))}
            placeholder="A short description of your site."
          />
        </FieldRow>
        <SettingsRow label="Open Graph image">
          <Input
            value={seoForm.default_og_image}
            onChange={(e) => setSeoForm((f) => ({ ...f, default_og_image: e.target.value }))}
            placeholder="https://…/og.png"
            className="w-[360px]"
          />
        </SettingsRow>
        <SettingsRow label="Twitter / X handle">
          <Input
            value={seoForm.default_twitter_handle}
            onChange={(e) => setSeoForm((f) => ({ ...f, default_twitter_handle: e.target.value }))}
            placeholder="@acme"
            className="w-[260px]"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Localization"
        description="Default language, time zone, and formatting."
        action={<Badge variant="outline" className="text-[10px]">Preview</Badge>}
      >
        <SettingsRow label="Default language">
          <Select defaultValue="en">
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English (en)</SelectItem>
              <SelectItem value="fr">Français (fr)</SelectItem>
              <SelectItem value="de">Deutsch (de)</SelectItem>
              <SelectItem value="es">Español (es)</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow label="Time zone">
          <Select defaultValue="utc">
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="utc">UTC</SelectItem>
              <SelectItem value="ny">America/New_York</SelectItem>
              <SelectItem value="la">America/Los_Angeles</SelectItem>
              <SelectItem value="london">Europe/London</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow label="Date format">
          <Select defaultValue="iso">
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="iso">YYYY-MM-DD</SelectItem>
              <SelectItem value="us">MM/DD/YYYY</SelectItem>
              <SelectItem value="eu">DD/MM/YYYY</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow label="URL style" description="How paths render for collection items.">
          <Select defaultValue="kebab">
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="kebab">kebab-case</SelectItem>
              <SelectItem value="snake">snake_case</SelectItem>
              <SelectItem value="raw">raw slug</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsSection>
    </>
  );
}

function BrandingThumb({ label, wide = false }: { label: string; wide?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`grid ${wide ? "h-12 w-24" : "h-12 w-12"} place-items-center rounded-md border border-dashed border-border bg-surface text-[10px] text-muted-foreground`}
      >
        IMG
      </div>
      <Button variant="outline" size="sm">{label}</Button>
    </div>
  );
}
