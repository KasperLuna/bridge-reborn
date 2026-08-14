/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Slim production image via Docker (Dockerfile.next)
  output: "standalone",
};

export default nextConfig;
