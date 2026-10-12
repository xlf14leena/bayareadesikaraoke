import { hintClass, labelClass } from "@/components/ui";

export default function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className={`block ${hintClass}`}>{hint}</span>}
    </label>
  );
}
