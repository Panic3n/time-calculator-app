import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  crons: [
    {
      path: "/api/halopsa/sync-auto",
      schedule: "0 * * * *", // Every hour at minute 0
    },
  ],
};

export default nextConfig;
