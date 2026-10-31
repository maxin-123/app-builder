import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Inline input that commits on blur / Enter, with optional inline validation. */
export function EditCell({
  value,
  onSave,
  type = "number",
  disabled,
  className,
  placeholder,
  format,
  validate,
  label,
}: {
  value: string | number | null | undefined;
  onSave: (v: string) => unknown;
  type?: "number" | "text";
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  format?: (v: string | number | null | undefined) => string;
  validate?: (v: string) => string | null;
  label?: string;
}) {
  const initial = value == null ? "" : String(value);
  const [v, setV] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setV(initial);
    setErr(null);
  }, [initial]);
  if (disabled)
    return <span className={cn("tabular block px-2 py-1 text-sm", className)}>{format ? format(value) : initial || "—"}</span>;
  const commit = () => {
    if (v === initial) return setErr(null);
    const e = validate?.(v) ?? (type === "number" && v.trim() !== "" && !Number.isFinite(Number(v)) ? "Enter a number" : null);
    setErr(e);
    if (!e) onSave(v);
  };
  return (
    <div>
      <Input
        value={v}
        type={type}
        step="any"
        aria-label={label}
        aria-invalid={!!err}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setV(initial); setErr(null); }
        }}
        className={cn("tabular h-8 min-w-[72px] px-2 text-sm", err && "border-destructive", className)}
      />
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
    </div>
  );
}

export const nonNegative = (v: string) => (v.trim() !== "" && Number(v) < 0 ? "Can't be negative" : null);
export const required = (v: string) => (v.trim() === "" ? "Required" : null);
export const efficiencyRule = (v: string) => {
  const n = Number(v);
  return v.trim() === "" || !(n > 0 && n <= 1) ? "Must be above 0 and at most 1" : null;
};
