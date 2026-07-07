/**
 * Free / consumer email domains blocked when a field has `businessOnly` on.
 * Not exhaustive by design — covers the providers people actually type.
 */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.in",
  "ymail.com",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "pm.me",
]);

export function isFreeEmailDomain(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return FREE_EMAIL_DOMAINS.has(domain);
}

/** Returns an error string if the email is not allowed, else null. */
export function validateBusinessEmail(email: string): string | null {
  if (!email.includes("@")) return null; // let the base "required/email" check handle it
  return isFreeEmailDomain(email) ? "Please use your work email, not a personal one." : null;
}
