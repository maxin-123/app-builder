import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only: record an invitation (RLS checks the caller is an Admin) and email the invitee. */
export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; role: "admin" | "analyst" | "viewer"; redirectTo: string }) => {
    const email = String(d.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email");
    if (!["admin", "analyst", "viewer"].includes(d.role)) throw new Error("Invalid role");
    return { email, role: d.role, redirectTo: String(d.redirectTo) };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Only Admins can invite users");
    const { error } = await context.supabase.from("invitations").insert({ email: data.email, role: data.role });
    if (error) throw new Error(error.code === "23505" ? "This email has already been invited" : error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: e2 } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo: data.redirectTo });
    if (e2) {
      // Keep the invitation row: if they already have an account elsewhere they can't join, so roll it back.
      await context.supabase.from("invitations").delete().eq("email", data.email);
      throw new Error(e2.message);
    }
    return { ok: true };
  });
