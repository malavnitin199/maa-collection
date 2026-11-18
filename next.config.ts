import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev assets/HMR are blocked for origins other than localhost; without this,
  // opening http://127.0.0.1:3000 renders HTML but never hydrates.
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  // Browser tests (E2E=1): hide the dev-only Next.js badge; on phone size it covered real buttons.
  devIndicators: process.env.E2E === '1' ? false : undefined,
  // PGlite (local/test database) ships WASM files; load it from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // Product photos are resized on the phone (~100–250 KB each); an old-stock save
    // sends a few at once. Vercel's own request limit is 4.5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
  partialPrefetching: true,
  // Plan v17: "Quick add" became the New item screen; old links and bookmarks
  // (query such as ?supplier= is kept) land there.
  async redirects() {
    return [{ source: "/admin/stock/quick", destination: "/admin/stock/new", permanent: false }];
  },
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
