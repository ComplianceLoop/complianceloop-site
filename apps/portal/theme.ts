// Central theme tokens for ComplianceLoop
export const theme = {
  colors: {
    primary: "#2563eb",
    primaryHover: "#1e40af",
    accent: "#06b6d4",
    bg: "#0b0f1a",
    surface: "#111827",
    text: "#e5e7eb",
    muted: "#9ca3af",
    success: "#16a34a",
    warning: "#f59e0b",
    danger: "#ef4444"
  },
  radii: { sm: "6px", md: "10px", lg: "14px", xl: "20px" },
  spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px" },
  fonts: {
    body: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, 'Helvetica Neue', Arial, 'Apple Color Emoji', 'Segoe UI Emoji'",
    heading: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, 'Helvetica Neue', Arial"
  }
} as const;
