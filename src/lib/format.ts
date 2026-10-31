import { supabase } from "@/integrations/supabase/client";

export function money(v: number | null | undefined, currency = "USD", digits = 0) {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(v);
}
export function num(v: number | null | undefined, digits = 0) {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
}
export function pct(v: number | null | undefined, digits = 0) {
  if (v == null) return "—";
  if (!Number.isFinite(v)) return "∞";
  return `${(v * 100).toFixed(digits)}%`;
}
export function signedMoney(v: number, currency = "USD") {
  return `${v > 0 ? "+" : ""}${money(v, currency)}`;
}

/** Download rows as CSV and record the export in the audit log. */
export function exportCsv(filename: string, rows: Array<Record<string, string | number | null | undefined>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  void supabase.rpc("log_event", { _action: "EXPORT", _details: { file: filename } });
}

/** Download rows as an Excel workbook (one sheet per entry) and record the export. */
export async function exportXlsx(filename: string, sheets: Record<string, Array<Record<string, string | number | null | undefined>>>) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 31));
  XLSX.writeFile(wb, filename);
  void supabase.rpc("log_event", { _action: "EXPORT", _details: { file: filename } });
}
