import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AndaFlows — Profit Velocity for manufacturers" },
      { name: "description", content: "Decide what to produce by throughput earned per bottleneck hour." },
      { property: "og:title", content: "AndaFlows — Profit Velocity for manufacturers" },
      { property: "og:description", content: "Decide what to produce by throughput earned per bottleneck hour." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session ? "/overview" : "/auth", replace: true });
    });
  }, [navigate]);
  return <div className="min-h-screen bg-background" />;
}
