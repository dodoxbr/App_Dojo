import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @dojo/contracts exports TypeScript sources directly (ADR-010).
  transpilePackages: ["@dojo/contracts"],
};

export default nextConfig;
