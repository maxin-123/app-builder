import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useRefresh } from "./data";

type T = keyof Database["public"]["Tables"];

/** Thin write helpers; the database enforces company, role and lock rules. */
export function useDb() {
  const refresh = useRefresh();
  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => {
    const { error } = await p;
    if (error) {
      toast.error(error.message);
      return false;
    }
    if (ok) toast.success(ok);
    await refresh();
    return true;
  };
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (table: T, id: string, patch: Record<string, unknown>, ok?: string) => run(supabase.from(table).update(patch as any).eq("id", id), ok),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insert: (table: T, row: Record<string, unknown>, ok?: string) => run(supabase.from(table).insert(row as any), ok),
    remove: (table: T, id: string, ok?: string) => run(supabase.from(table).delete().eq("id", id), ok),
    run,
  };
}

export const toNum = (s: string) => (s.trim() === "" ? null : Number(s));
