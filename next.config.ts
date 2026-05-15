import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['postgres', '@workos-inc/node'],
};

export default nextConfig;
