import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/lib/data";
import { inviteUser } from "@/lib/invite.functions";
import { EditCell } from "@/components/EditCell";
import { Loading, PageHeader, Panel } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Role } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — AndaFlows" }, { name: "description", content: "Company, users and audit log." }] }),
  component: Settings,
});

function Settings() {
  const { me, isAdmin } = usePermissions();
  if (!me) return <Loading />;
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs defaultValue="company">
        <TabsList className="mb-4">
          <TabsTrigger value="company">Company</TabsTrigger>
          {isAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
          {isAdmin && <TabsTrigger value="audit">Audit log</TabsTrigger>}
        </TabsList>
        <TabsContent value="company"><CompanyTab /></TabsContent>
        {isAdmin && <TabsContent value="users"><UsersTab /></TabsContent>}
        {isAdmin && <TabsContent value="audit"><AuditTab /></TabsContent>}
      </Tabs>
    </>
  );
}

function CompanyTab() {
  const { me, isAdmin } = usePermissions();
  const qc = useQueryClient();
  const save = async (patch: { name?: string; currency?: string }) => {
    const { error } = await supabase.from("companies").update(patch).eq("id", me!.company.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["me"] });
  };
  return (
    <Panel title="Company">
      <div className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Company name</Label>
          <EditCell type="text" value={me!.company.name} disabled={!isAdmin} onSave={(v) => save({ name: v })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Reporting currency (ISO code)</Label>
          <EditCell type="text" value={me!.company.currency} disabled={!isAdmin} onSave={(v) => save({ currency: v.toUpperCase().slice(0, 3) })} />
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Your role: <span className="capitalize">{me!.role}</span></p>
    </Panel>
  );
}

function UsersTab() {
  const { me } = usePermissions();
  const invite = useServerFn(inviteUser);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("analyst");
  const users = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: invites }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("*"),
        supabase.from("invitations").select("*").is("accepted_at", null).order("created_at"),
      ]);
      return {
        users: (profiles ?? []).map((p) => ({ ...p, role: (roles ?? []).find((r) => r.user_id === p.user_id) })),
        invites: invites ?? [],
      };
    },
  });

  async function changeRole(roleId: string, next: Role) {
    const { error } = await supabase.from("user_roles").update({ role: next }).eq("id", roleId);
    if (error) toast.error(error.message);
    else toast.success("Role updated");
    users.refetch();
  }
  async function removeUser(profileId: string, roleId?: string) {
    if (!confirm("Remove this user from the company?")) return;
    if (roleId) {
      const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
      if (error) return toast.error(error.message);
    }
    const { error } = await supabase.from("profiles").delete().eq("id", profileId);
    if (error) toast.error(error.message);
    else toast.success("User removed");
    users.refetch();
  }
  async function sendInvite() {
    try {
      await invite({ data: { email, role, redirectTo: `${window.location.origin}/reset-password` } });
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
      users.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    }
  }

  return (
    <div className="space-y-6">
      <Panel title="Invite a user">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input type="email" placeholder="colleague@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="sm:max-w-xs" />
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="analyst">Analyst</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={sendInvite} disabled={!email}>Send invite</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">They'll get an email to set a password and join this company.</p>
      </Panel>
      <Panel title="Users">
        {users.isLoading ? <Loading /> : (
          <div className="-mx-4 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {users.data?.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}{u.user_id === me?.userId && <Badge variant="secondary" className="ml-2">You</Badge>}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {u.role ? (
                        <Select value={u.role.role} onValueChange={(v) => changeRole(u.role!.id, v as Role)}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="analyst">Analyst</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {u.user_id !== me?.userId && (
                        <Button size="icon" variant="ghost" aria-label="Remove user" onClick={() => removeUser(u.id, u.role?.id)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {users.data?.invites.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-muted-foreground">Invited</TableCell>
                    <TableCell>{i.email}</TableCell>
                    <TableCell className="capitalize">{i.role}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" aria-label="Cancel invite" onClick={async () => { await supabase.from("invitations").delete().eq("id", i.id); users.refetch(); }}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">The last Admin can't be removed or demoted.</p>
      </Panel>
    </div>
  );
}

function AuditTab() {
  const logs = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const [{ data: rows, error }, { data: profiles }] = await Promise.all([
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("profiles").select("user_id, full_name, email"),
      ]);
      if (error) throw new Error(error.message);
      const who = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name || p.email]));
      return (rows ?? []).map((r) => ({ ...r, who: r.user_id ? who.get(r.user_id) ?? "Former user" : "System" }));
    },
  });
  const [open, setOpen] = useState<string | null>(null);
  if (logs.isLoading) return <Loading />;
  return (
    <Panel title="Latest 200 events">
      <div className="-mx-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Table</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {logs.data?.map((l) => (
              <>
                <TableRow key={l.id}>
                  <TableCell className="tabular whitespace-nowrap text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                  <TableCell>{l.who}</TableCell>
                  <TableCell><Badge variant="secondary">{l.action}</Badge></TableCell>
                  <TableCell className="text-sm">{l.table_name}</TableCell>
                  <TableCell>
                    {(l.before || l.after) && <Button size="sm" variant="ghost" onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? "Hide" : "Details"}</Button>}
                  </TableCell>
                </TableRow>
                {open === l.id && (
                  <TableRow key={`${l.id}-d`}>
                    <TableCell colSpan={5}>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(l.before, null, 2) ?? "—"}</pre>
                        <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(l.after, null, 2) ?? "—"}</pre>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}
