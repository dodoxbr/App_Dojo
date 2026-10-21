import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @dojo/contracts exports TypeScript sources directly (ADR-010).
  transpilePackages: ["@dojo/contracts"],
  // Dev only: lets the dev server be opened as 127.0.0.1 as well as localhost (no effect in production).
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
