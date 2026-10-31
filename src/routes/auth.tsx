import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AndaFlows" },
      { name: "description", content: "Sign in to AndaFlows or create your company workspace." },
      { property: "og:title", content: "Sign in — AndaFlows" },
      { property: "og:description", content: "Sign in to AndaFlows or create your company workspace." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")),
      password: String(f.get("password")),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    await supabase.rpc("log_event", { _action: "LOGIN" });
    navigate({ to: "/overview", replace: true });
  }

  async function signup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: String(f.get("email")),
      password: String(f.get("password")),
      options: {
        emailRedirectTo: window.location.origin + "/overview",
        data: { full_name: String(f.get("full_name")), company_name: String(f.get("company_name")) },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data.session) {
      await supabase.rpc("log_event", { _action: "LOGIN" });
      navigate({ to: "/overview", replace: true });
    } else setSent(true);
  }

  if (sent)
    return (
      <AuthCard title="Check your email" subtitle="We sent a confirmation link. Open it to finish creating your workspace.">
        <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
          Back to sign in
        </Button>
      </AuthCard>
    );

  return (
    <AuthCard title="Welcome to AndaFlows" subtitle="Produce what earns the most per bottleneck hour.">
      <Tabs defaultValue="login">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Log in</TabsTrigger>
          <TabsTrigger value="signup">Sign up</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form onSubmit={login} className="mt-4 space-y-4">
            <Field name="email" label="Work email" type="email" />
            <Field name="password" label="Password" type="password" />
            <Button className="w-full" disabled={busy}>
              Log in
            </Button>
            <Link to="/forgot-password" className="block text-center text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </form>
        </TabsContent>
        <TabsContent value="signup">
          <form onSubmit={signup} className="mt-4 space-y-4">
            <Field name="full_name" label="Your name" />
            <Field name="company_name" label="Company name" />
            <Field name="email" label="Work email" type="email" />
            <Field name="password" label="Password" type="password" minLength={8} />
            <Button className="w-full" disabled={busy}>
              Create company
            </Button>
            <p className="text-xs text-muted-foreground">
              You'll be the Admin. Invited by a colleague? Sign up with the email they invited to join their company.
            </p>
          </form>
        </TabsContent>
      </Tabs>
    </AuthCard>
  );
}

function Field({ name, label, type = "text", minLength }: { name: string; label: string; type?: string; minLength?: number }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required minLength={minLength} />
    </div>
  );
}
