import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — AndaFlows" },
      { name: "description", content: "Get a link to reset your AndaFlows password." },
      { property: "og:title", content: "Reset your password — AndaFlows" },
      { property: "og:description", content: "Get a link to reset your AndaFlows password." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }],
  }),
  component: Forgot,
});

function Forgot() {
  const [sent, setSent] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    setSent(true);
  }
  return (
    <AuthCard title="Forgot password" subtitle={sent ? "If that email has an account, a reset link is on its way." : "We'll email you a reset link."}>
      {!sent && (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <Button className="w-full">Send reset link</Button>
        </form>
      )}
      <Link to="/auth" className="mt-4 block text-center text-sm text-primary hover:underline">
        Back to sign in
      </Link>
    </AuthCard>
  );
}
