export const theme = {
  colors: {
    background: "#ffffff",
    foreground: "#111827",
    primary: "#2563eb",
    primaryForeground: "#ffffff",
    secondary: "#f3f4f6",
    secondaryForeground: "#111827",
    muted: "#6b7280",
    border: "#e5e7eb",
    danger: "#dc2626",
    success: "#16a34a",
    warning: "#f59e0b",
  },
  fonts: {
    sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
    mono: ['"JetBrains Mono"', "monospace"],
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem",
  },
  borderRadius: {
    sm: "0.25rem",
    md: "0.375rem",
    lg: "0.5rem",
    full: "9999px",
  },
} as const;

export type Theme = typeof theme;
