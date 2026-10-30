import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useCompanyData, useMe } from "@/lib/data";
import { useScenario } from "@/lib/scenario-context";

export function TopBar() {
  const { data: me } = useMe();
  const { data } = useCompanyData();
  const { scenarioId, setScenarioId } = useScenario();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.rpc("log_event", { _action: "LOGOUT" });
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (me?.fullName || me?.email || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-card px-2 md:gap-4 md:px-4">
      <SidebarTrigger />
      <span className="hidden truncate text-sm font-semibold sm:block">{me?.company.name ?? ""}</span>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <Select value={scenarioId ?? undefined} onValueChange={setScenarioId}>
          <SelectTrigger className="h-9 w-[170px] sm:w-[260px]">
            <SelectValue placeholder="Select scenario" />
          </SelectTrigger>
          <SelectContent>
            {data?.scenarios.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="flex items-center gap-2">
                  {s.is_locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                  <span className="truncate">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.version_label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="space-y-1">
              <div className="truncate">{me?.fullName || me?.email}</div>
              <div className="truncate text-xs font-normal text-muted-foreground">{me?.email}</div>
              {me && <Badge variant="secondary" className="capitalize">{me.role}</Badge>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
