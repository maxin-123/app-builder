import type { Json } from "@/integrations/supabase/types";

/** Before/after diff of the fields that changed in an audit entry. */
export function ChangedFields({ before, after }: { before: Json | null; after: Json | null }) {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return null;
  const b = before as Record<string, Json>;
  const n = after as Record<string, Json>;
  const keys = Object.keys(n).filter((k) => k !== "updated_at" && JSON.stringify(b[k]) !== JSON.stringify(n[k]));
  if (!keys.length) return null;
  return (
    <div className="w-full space-y-1 text-xs">
      {keys.map((k) => (
        <div key={k} className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-muted-foreground">{k}</span>
          <span className="break-all font-mono"><span className="text-negative line-through">{JSON.stringify(b[k])}</span> → <span className="text-positive">{JSON.stringify(n[k])}</span></span>
        </div>
      ))}
    </div>
  );
}

