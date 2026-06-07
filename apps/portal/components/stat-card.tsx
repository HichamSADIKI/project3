export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="sgi-card">
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--ink)", marginTop: "0.5rem", lineHeight: 1 }}>
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: "0.8rem", color: "var(--ink-3)", marginTop: "0.5rem" }}>{hint}</div>
      )}
    </div>
  );
}
