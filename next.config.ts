import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许 API 路由读取本地的 data/*.json
  serverExternalPackages: [],
};

export default nextConfig;
