import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @dojo/contracts exports TypeScript sources directly (ADR-010).
  transpilePackages: ["@dojo/contracts"],
  // Dev only (no effect in production): lets the dev server be opened as 127.0.0.1 and from a phone on the same Wi-Fi (home networks).
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.0.*.*"],
};

export default nextConfig;
