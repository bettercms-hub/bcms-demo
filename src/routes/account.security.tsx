import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cms/SettingsSubNav";
import { ChangePasswordCard, SessionsCard, TwoFactorCard } from "@/components/cms/account/SecurityCards";

export const Route = createFileRoute("/account/security")({
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <>
      <PageHeader title="Login & security" description="Keep your account safe with a strong password, two-factor authentication and session control." />
      <ChangePasswordCard />
      <TwoFactorCard />
      <SessionsCard />
    </>
  );
}
