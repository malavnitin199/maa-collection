import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev assets/HMR are blocked for origins other than localhost; without this,
  // opening http://127.0.0.1:3000 renders HTML but never hydrates.
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  // PGlite (local/test database) ships WASM files; load it from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
