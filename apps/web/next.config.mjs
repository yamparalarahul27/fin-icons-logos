/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship raw TypeScript (no build step); let Next compile them.
  transpilePackages: ["@fin/shared", "@fin/ingestion"],
  // sharp is a native module — keep it out of the bundle and require it at runtime.
  serverExternalPackages: ["sharp"],
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
