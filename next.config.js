// next.config.js
const path = require("node:path");

/**
 * CommonJS config so Vercel/Next always pick it up.
 * Maps the odd imports shown in build logs directly to real files,
 * and keeps the general "@/*" alias to the repo root.
 */
const root = process.cwd();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),

      // General: "@/something" -> repo root
      "@": path.resolve(root),

      // Exact aliases for the imports failing in your logs:
      "@/app/../lib/db": path.resolve(root, "apps/portal/lib/db"),
      "@/app/../db/schema": path.resolve(root, "apps/portal/db/schema"),
      "@/app/../lib/auth": path.resolve(root, "apps/portal/lib/auth"),

      // Fallback normalizer: any other "@/app/../<...>" -> repo root
      "@/app/../": path.resolve(root) + "/"
    };
    return config;
  },
};

module.exports = nextConfig;
