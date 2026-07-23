export const theme = {
  colors: {
    brand: "#1F6B4D",
    brandHover: "#18573D",
    accent: "#D9A441",
    accentHover: "#C08C2E",
    background: "#FAF7F0",
    surface: "#FFFFFF",
    surfaceHover: "#F8F5ED",
    foreground: "#2B2B2B",
    muted: "#6B7280",
    border: "#E8E3D9",
    borderLight: "#F0ECE4",
    success: "#2F9E5C",
    successBg: "#EAF7EF",
    successHover: "#25804A",
    warning: "#D9A441",
    warningBg: "#FDF5E6",
    warningHover: "#C08C2E",
    danger: "#D64545",
    dangerBg: "#FDF0F0",
    dangerHover: "#B83838",
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
    sm: "6px",
    md: "10px",
    card: "14px",
    full: "9999px",
  },
} as const;

export type Theme = typeof theme;
