/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Slim production image via Docker (Dockerfile.next)
  output: "standalone",
  // The DDS WASM solver reads its .wasm from disk at runtime; keep the package
  // unbundled so __dirname resolves inside node_modules.
  serverExternalPackages: ["@bridge-tools/dd"],
  outputFileTracingIncludes: {
    "/api/hands/[id]/play": [
      "./node_modules/@bridge-tools/dd/wasm/compiled.wasm",
    ],
  },
};

export default nextConfig;
