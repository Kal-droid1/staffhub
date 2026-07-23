interface PersonRowProps {
  name: string;
  role?: string;
  department?: string;
  size?: "sm" | "md";
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function PersonRow({ name, role, department, size = "md" }: PersonRowProps) {
  const dim = size === "sm" ? 30 : 36;
  const fontSize = size === "sm" ? "0.7rem" : "0.8rem";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
      <div
        style={{
          width: dim,
          height: dim,
          borderRadius: "50%",
          background: "var(--color-brand)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {getInitials(name)}
      </div>
      <div>
        <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{name}</div>
        {(role || department) && (
          <div className="text-sm text-muted">
            {[role, department].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}
