// next.config.mjs
import path from "node:path";

/**
 * Hard, explicit aliases so quirky imports like "@/app/../lib/db" resolve
 * to the actual code in apps/portal/*. This avoids changing route logic.
 */
const root = process.cwd();

const nextConfig = {
  reactStrictMode: true,

  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),

      // General quality-of-life alias to repo root (keeps "@/..." working)
      "@": path.resolve(root),

      // --- Explicit aliases for the broken imports in build logs ---
      "@/app/../lib/db": path.resolve(root, "apps/portal/lib/db"),
      "@/app/../db/schema": path.resolve(root, "apps/portal/db/schema"),
      "@/app/../lib/auth": path.resolve(root, "apps/portal/lib/auth"),

      // Optional: normalize any other "@/app/../<anything>" to root
      "@/app/../": path.resolve(root) + "/"
    };

    return config;
  }
};

export default nextConfig;
