/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship raw TypeScript (no build step); let Next compile them.
  transpilePackages: ["@fin/shared", "@fin/ingestion"],
  // Native / heavy server-only deps: keep them out of the bundle, require at runtime.
  serverExternalPackages: [
    "sharp",
    "@aws-sdk/client-s3",
    "@supabase/supabase-js",
    "isomorphic-dompurify",
  ],
  webpack: (config) => {
    // The shared/ingestion packages are ESM TypeScript that import with `.js`
    // specifiers (e.g. `./asset.js`). Teach webpack to resolve those to `.ts`.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
