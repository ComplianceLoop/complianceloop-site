// apps/portal/tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../app/**/*.{ts,tsx}",
    "../../components/**/*.{ts,tsx}"
  ],
  theme: { extend: {} },
  plugins: []
} satisfies Config;
