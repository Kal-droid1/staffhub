interface RadialGaugeProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export default function RadialGauge({
  value,
  max,
  size = 100,
  strokeWidth = 8,
  label,
}: RadialGaugeProps) {
  const ratio = Math.min(Math.max(max > 0 ? value / max : 0, 0), 1);
  const colorVar =
    ratio > 0.5
      ? "var(--color-success)"
      : ratio > 0.1
        ? "var(--color-warning)"
        : "var(--color-danger)";

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);

  return (
    <div className="radial-gauge">
      <svg width={size} height={size} style={{ display: "block" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border-light)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colorVar}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.3s ease" }}
        />
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          className="radial-gauge__value"
          fill="var(--color-text)"
        >
          {Math.round(value)} / {Math.round(max)}
        </text>
      </svg>
      {label && <span className="radial-gauge__label">{label}</span>}
    </div>
  );
}
