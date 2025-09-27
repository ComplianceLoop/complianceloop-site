// src/theme.ts
export const theme = {
  color: {
    bg: "hsl(210 20% 98%)",
    fg: "hsl(222 47% 11%)",
    brand: "hsl(221 83% 53%)",
    brandFg: "white",
    muted: "hsl(210 16% 93%)",
    border: "hsl(214 32% 91%)"
  },
  radius: {
    sm: "0.375rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem"
  },
  space: {
    xs: "0.375rem",
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem"
  },
  font: { body: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif" }
} as const;
