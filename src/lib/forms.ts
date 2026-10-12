// Helpers for reading admin form fields. Each throws FormError with a message
// the form shows next to its submit button.

export class FormError extends Error {}

export type FormState = { error?: string; ok?: string } | undefined;

export function text(form: FormData, name: string, label: string, opts: { max?: number } = {}): string {
  const v = String(form.get(name) ?? "").trim();
  if (!v) throw new FormError(`${label} is required.`);
  if (opts.max && v.length > opts.max) throw new FormError(`${label} is too long (max ${opts.max} characters).`);
  return v;
}

export function optionalText(form: FormData, name: string, opts: { max?: number } = {}): string | null {
  const v = String(form.get(name) ?? "").trim();
  if (!v) return null;
  if (opts.max && v.length > opts.max) throw new FormError(`Keep it under ${opts.max} characters.`);
  return v;
}

/** Dollars like "20" or "12.50" to cents. Blank is $0. */
export function price(form: FormData, name: string, label: string): number {
  const raw = String(form.get(name) ?? "").trim().replace(/^\$/, "");
  if (!raw) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new FormError(`${label} should be a dollar amount like 20 or 12.50.`);
  return Math.round(Number(raw) * 100);
}

/** A positive whole number, or null when blank (no cap). */
export function optionalCap(form: FormData, name: string, label: string): number | null {
  const raw = String(form.get(name) ?? "").trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw) || Number(raw) < 1) throw new FormError(`${label} should be a whole number, or blank for no cap.`);
  return Number(raw);
}

export function optionalUrl(form: FormData, name: string, label: string): string | null {
  const raw = String(form.get(name) ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
  } catch {
    throw new FormError(`${label} should be a web address starting with https://`);
  }
  return raw;
}

export function ymd(form: FormData, name: string, label: string, required = true): string | null {
  const raw = String(form.get(name) ?? "").trim();
  if (!raw) {
    if (required) throw new FormError(`${label} is required.`);
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new FormError(`${label} should be a date.`);
  return raw;
}

export function hm(form: FormData, name: string, label: string): string {
  const raw = String(form.get(name) ?? "").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) throw new FormError(`${label} should be a time.`);
  return raw;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Dollar string for a form default, e.g. 2000 -> "20", 1250 -> "12.50". */
export function dollars(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
