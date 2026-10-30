import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Inline input that commits on blur / Enter. Renders plain text when read-only. */
export function EditCell({
  value,
  onSave,
  type = "number",
  disabled,
  className,
  placeholder,
  format,
}: {
  value: string | number | null | undefined;
  onSave: (v: string) => void | Promise<void>;
  type?: "number" | "text";
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  format?: (v: string | number | null | undefined) => string;
}) {
  const initial = value == null ? "" : String(value);
  const [v, setV] = useState(initial);
  useEffect(() => setV(initial), [initial]);
  if (disabled)
    return <span className={cn("tabular block px-2 py-1 text-sm", className)}>{format ? format(value) : initial || "—"}</span>;
  return (
    <Input
      value={v}
      type={type}
      step="any"
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== initial && onSave(v)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={cn("tabular h-8 min-w-[72px] px-2 text-sm", className)}
    />
  );
}
