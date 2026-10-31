import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — AndaFlows" },
      { name: "description", content: "Choose a new password for your AndaFlows account." },
      { property: "og:title", content: "Set a new password — AndaFlows" },
      { property: "og:description", content: "Choose a new password for your AndaFlows account." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/overview", replace: true });
  }
  return (
    <AuthCard title="Set a new password">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
        <Button className="w-full">Update password</Button>
      </form>
    </AuthCard>
  );
}
