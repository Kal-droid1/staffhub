import { formatDays } from "@/lib/format";

interface RadialGaugeProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  gradient?: boolean;
}

export default function RadialGauge({
  value,
  max,
  size = 100,
  strokeWidth = 8,
  label,
  gradient = false,
}: RadialGaugeProps) {
  const ratio = Math.min(Math.max(max > 0 ? value / max : 0, 0), 1);
  const gradientId = `rg-grad-${Math.random().toString(36).slice(2, 8)}`;

  const colorVar =
    ratio > 0.5
      ? "var(--color-success)"
      : ratio > 0.1
        ? "var(--color-warning)"
        : "var(--color-danger)";

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);

  const fontSize = Math.round(size * 0.22);

  return (
    <div className="radial-gauge">
      <svg width={size} height={size} style={{ display: "block" }}>
        {gradient && (
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1F6B4D" />
              <stop offset="100%" stopColor="#D9A441" />
            </linearGradient>
          </defs>
        )}
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
          stroke={gradient ? `url(#${gradientId})` : colorVar}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.3s ease" }}
        />
        <text
          x={size / 2}
          y={size / 2 + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={gradient ? "#1F6B4D" : colorVar}
          fontWeight={800}
          fontSize={fontSize}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {formatDays(value)}
        </text>
      </svg>
      {label && <span className="radial-gauge__label">{label}</span>}
    </div>
  );
}
