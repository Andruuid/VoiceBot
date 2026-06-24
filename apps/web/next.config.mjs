/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace-Pakete werden als TS-Quelle konsumiert und hier transpiliert.
  transpilePackages: ["@voicebot/core", "@voicebot/db"],
};

export default nextConfig;
