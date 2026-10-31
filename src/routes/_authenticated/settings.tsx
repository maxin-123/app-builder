import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions, type Role } from "@/lib/data";
import { inviteUser } from "@/lib/invite.functions";
import { exportCsv } from "@/lib/format";
import { EditCell, required } from "@/components/EditCell";
import { ChangedFields } from "@/components/ChangedFields";
import { useConfirm } from "@/components/confirm";
import { Empty, Loading, PageHeader, Panel } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — AndaFlows" }, { name: "description", content: "Company, users and audit log." }, { property: "og:title", content: "Settings — AndaFlows" }, { property: "og:description", content: "Company, users and audit log." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Settings,
});

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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
  const save = async (patch: { name?: string; currency?: string; fiscal_year_start?: number }) => {
    const { error } = await supabase.from("companies").update(patch).eq("id", me!.company.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["me"] });
  };
  const c = me!.company;
  return (
    <Panel title="Company">
      <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Company name">
          <EditCell type="text" label="Company name" value={c.name} validate={required} disabled={!isAdmin} onSave={(v) => save({ name: v })} />
        </Field>
        <Field label="Currency (ISO code)">
          <EditCell type="text" label="Currency" value={c.currency} disabled={!isAdmin} validate={(v) => (/^[A-Za-z]{3}$/.test(v) ? null : "Use a 3-letter code, e.g. USD")} onSave={(v) => save({ currency: v.toUpperCase() })} />
        </Field>
        <Field label="Fiscal year starts">
          <Select value={String(c.fiscal_year_start ?? 1)} disabled={!isAdmin} onValueChange={(v) => save({ fiscal_year_start: Number(v) })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Your role: <span className="capitalize">{me!.role}</span>{!isAdmin && " · only Admins can change company settings."}</p>
    </Panel>
  );
}

function UsersTab() {
  const { me } = usePermissions();
  const confirm = useConfirm();
  const invite = useServerFn(inviteUser);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("analyst");
  const [sending, setSending] = useState(false);
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
  async function setActive(profileId: string, name: string, active: boolean) {
    if (!active && !(await confirm({ title: `Deactivate ${name}?`, description: "They lose access immediately. Their history stays in the audit log.", action: "Deactivate" }))) return;
    const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", profileId);
    if (error) toast.error(error.message);
    else toast.success(active ? "User reactivated" : "User deactivated");
    users.refetch();
  }
  async function sendInvite() {
    setSending(true);
    try {
      await invite({ data: { email, role, redirectTo: `${window.location.origin}/reset-password` } });
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
      users.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    }
    setSending(false);
  }

  return (
    <div className="space-y-6">
      <Panel title="Invite a user">
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void sendInvite(); }}>
          <Input type="email" required aria-label="Email to invite" value={email} onChange={(e) => setEmail(e.target.value)} className="sm:max-w-xs" />
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="sm:w-36" aria-label="Role"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="analyst">Analyst</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={!email || sending}>Send invite</Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">They get an email to set a password and join this company with the chosen role.</p>
      </Panel>
      <Panel title="Users">
        {users.isLoading ? <Loading /> : (
          <div className="-mx-4 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
              <TableBody>
                {users.data?.users.map((u) => (
                  <TableRow key={u.id} className={cn(!u.is_active && "text-muted-foreground")}>
                    <TableCell className="font-medium">{u.full_name || "—"}{u.user_id === me?.userId && <Badge variant="secondary" className="ml-2">You</Badge>}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {u.role ? (
                        <Select value={u.role.role} onValueChange={(v) => changeRole(u.role!.id, v as Role)}>
                          <SelectTrigger className="h-8 w-32" aria-label={`Role for ${u.email}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="analyst">Analyst</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Switch checked={u.is_active} disabled={u.user_id === me?.userId} aria-label={`${u.email} active`} onCheckedChange={(v) => setActive(u.id, u.full_name || u.email || "user", v)} />
                    </TableCell>
                  </TableRow>
                ))}
                {users.data?.invites.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-muted-foreground">Invitation pending</TableCell>
                    <TableCell>{i.email}</TableCell>
                    <TableCell className="capitalize">{i.role}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" aria-label={`Cancel invite for ${i.email}`} onClick={async () => { if (await confirm({ title: `Cancel invite for ${i.email}?`, action: "Cancel invite" })) { await supabase.from("invitations").delete().eq("id", i.id); users.refetch(); } }}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">The last Admin can't be demoted or deactivated.</p>
      </Panel>
    </div>
  );
}

function AuditTab() {
  const [f, setF] = useState({ user: "all", table: "all", action: "all", from: "", to: "" });
  const [open, setOpen] = useState<string | null>(null);
  const logs = useQuery({
    queryKey: ["audit", f.from, f.to],
    queryFn: async () => {
      let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1000);
      if (f.from) q = q.gte("created_at", new Date(f.from).toISOString());
      if (f.to) q = q.lt("created_at", new Date(new Date(f.to).getTime() + 86400000).toISOString());
      const [{ data: rows, error }, { data: profiles }] = await Promise.all([q, supabase.from("profiles").select("user_id, full_name, email")]);
      if (error) throw new Error(error.message);
      const who = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name || p.email || ""]));
      return { rows: (rows ?? []).map((r) => ({ ...r, who: r.user_id ? who.get(r.user_id) ?? "Former user" : "System" })), who };
    },
  });
  const rows = useMemo(
    () => (logs.data?.rows ?? []).filter((r) => (f.user === "all" || r.user_id === f.user) && (f.table === "all" || r.table_name === f.table) && (f.action === "all" || r.action === f.action)),
    [logs.data, f],
  );
  const uniq = (k: "table_name" | "action") => [...new Set((logs.data?.rows ?? []).map((r) => r[k]))].sort();

  return (
    <Panel
      title="Audit log"
      action={<Button size="sm" variant="outline" disabled={!rows.length} onClick={() => exportCsv("audit-log.csv", rows.map((r) => ({ when: r.created_at, who: r.who, action: r.action, table: r.table_name, row_id: r.row_id, before: JSON.stringify(r.before), after: JSON.stringify(r.after) })))}><Download className="mr-1 h-4 w-4" /> Export CSV</Button>}
    >
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <FilterSelect label="User" value={f.user} onChange={(user) => setF({ ...f, user })} options={[...(logs.data?.who ?? new Map()).entries()].map(([id, n]) => [id, n])} />
        <FilterSelect label="Table" value={f.table} onChange={(table) => setF({ ...f, table })} options={uniq("table_name").map((t) => [t, t])} />
        <FilterSelect label="Action" value={f.action} onChange={(action) => setF({ ...f, action })} options={uniq("action").map((t) => [t, t])} />
        <Field label="From"><Input type="date" className="h-8" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" className="h-8" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
      </div>
      {logs.isLoading ? <Loading /> : rows.length === 0 ? <Empty title="No events match these filters" /> : (
        <div className="-mx-4 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Table</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((l) => (
                <Fragment key={l.id}>
                  <TableRow>
                    <TableCell className="tabular whitespace-nowrap text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                    <TableCell>{l.who}</TableCell>
                    <TableCell><Badge variant="secondary">{l.action}</Badge></TableCell>
                    <TableCell className="text-sm">{l.table_name}</TableCell>
                    <TableCell>{(l.before || l.after) && <Button size="sm" variant="ghost" aria-expanded={open === l.id} onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? "Hide" : "Diff"}</Button>}</TableCell>
                  </TableRow>
                  {open === l.id && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-muted/40">
                        {l.before && l.after ? (
                          <ChangedFields before={l.before} after={l.after} />
                        ) : (
                          <pre className="overflow-x-auto text-xs">{JSON.stringify(l.after ?? l.before, null, 2)}</pre>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">The audit log is append-only: entries can't be edited or deleted. Showing up to 1,000 events.</p>
    </Panel>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
