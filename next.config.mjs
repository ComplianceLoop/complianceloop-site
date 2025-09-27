// next.config.mjs
import path from "node:path";

/**
 * Hardens module resolution so legacy imports like "@/app/../lib/db" work
 * without editing route logic. We alias both "@" and the quirky "@/app/../"
 * to the repository root.
 */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(process.cwd()),
      "@/app/../": path.resolve(process.cwd()) + "/", // normalize to repo root
    };
    return config;
  },
};

export default nextConfig;
