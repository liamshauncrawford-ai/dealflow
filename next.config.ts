import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["playwright"],
  outputFileTracingIncludes: {
    "/api/email/auth/callback": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
    ],
    "/api/email/auth/callback/gmail": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
    ],
    "/api/email/auth/callback/debug": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
    ],
    "/api/auth/[...nextauth]": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
    ],
  },
};

export default nextConfig;
