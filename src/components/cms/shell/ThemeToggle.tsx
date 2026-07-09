/**
 * ThemeToggle — one-tap light/dark switch for the top bar. Toggling from
 * "system" pins an explicit mode (the opposite of what's currently showing),
 * which is what people expect from a single button. The full three-way
 * (light/dark/system) choice still lives in the account menu's Appearance.
 */
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useAppearance } from "@/lib/cms/appearance";
import { UtilityIconButton } from "./UtilityIconButton";

export function ThemeToggle() {
  const [appearance, setAppearance] = useAppearance();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Effective theme drives the icon. Read the class the boot script already
  // applied so we never flash the wrong icon or mismatch on hydration.
  const isDark =
    appearance === "dark" ||
    (appearance === "system" && mounted && document.documentElement.classList.contains("dark"));

  // Render a stable placeholder until mounted to avoid a hydration mismatch.
  if (!mounted) {
    return (
      <UtilityIconButton label="Toggle theme">
        <Sun className="h-4 w-4" strokeWidth={1.75} />
      </UtilityIconButton>
    );
  }

  return (
    <UtilityIconButton
      label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setAppearance(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-4 w-4" strokeWidth={1.75} /> : <Moon className="h-4 w-4" strokeWidth={1.75} />}
    </UtilityIconButton>
  );
}
