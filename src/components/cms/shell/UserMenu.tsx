import { Check, ChevronsUpDown, HelpCircle, Keyboard, LogOut, Monitor, Moon, Sun, User, Bell, Sliders } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppearance, type Appearance } from "@/lib/cms/appearance";
import { editorBus } from "@/lib/cms/editor-bus";
import { supabase } from "@/integrations/supabase/client";
import { disableGuest } from "@/lib/guest";
import { useSession } from "@/hooks/use-session";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function UserMenu() {
  const [appearance, setAppearance] = useAppearance();
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const email = user?.email ?? "guest@bettercms.site";
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.email ? user.email.split("@")[0] : "Guest");
  const initials = fullName
    .split(/[\s.]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "U";

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    disableGuest();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="border-t border-border bg-sidebar p-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-[color:var(--color-row-hover)]"
            aria-label="Open user menu"
          >
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[color:var(--color-elevated)] text-[10.5px] font-semibold text-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-medium leading-tight text-foreground">
                {fullName}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {email}
              </div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80 transition-colors group-hover:text-foreground group-data-[state=open]:text-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-[240px] p-1">
          <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Account
          </DropdownMenuLabel>
          <DropdownMenuItem className="text-[13px]">
            <User className="mr-2 h-3.5 w-3.5" /> My profile
          </DropdownMenuItem>
          <DropdownMenuItem className="text-[13px]">
            <Sliders className="mr-2 h-3.5 w-3.5" /> Preferences
          </DropdownMenuItem>
          <DropdownMenuItem className="text-[13px]">
            <Bell className="mr-2 h-3.5 w-3.5" /> Notifications
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-[13px]">
              {appearance === "dark" ? (
                <Moon className="mr-2 h-3.5 w-3.5" />
              ) : appearance === "light" ? (
                <Sun className="mr-2 h-3.5 w-3.5" />
              ) : (
                <Monitor className="mr-2 h-3.5 w-3.5" />
              )}
              Appearance
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-[180px] p-1">
                {(["dark", "light", "system"] as Appearance[]).map((m) => (
                  <DropdownMenuItem
                    key={m}
                    onSelect={() => setAppearance(m)}
                    className="flex items-center text-[13px] capitalize"
                  >
                    {m === "dark" ? (
                      <Moon className="mr-2 h-3.5 w-3.5" />
                    ) : m === "light" ? (
                      <Sun className="mr-2 h-3.5 w-3.5" />
                    ) : (
                      <Monitor className="mr-2 h-3.5 w-3.5" />
                    )}
                    <span className="flex-1">{m}</span>
                    {appearance === m && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuItem
            onSelect={() => editorBus.emit({ type: "editor:open-cheatsheet" })}
            className="text-[13px]"
          >
            <Keyboard className="mr-2 h-3.5 w-3.5" /> Keyboard shortcuts
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">?</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="text-[13px]">
            <HelpCircle className="mr-2 h-3.5 w-3.5" /> Help
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleSignOut} className="text-[13px] text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
