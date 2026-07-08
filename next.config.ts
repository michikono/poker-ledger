import type { NextConfig } from "next";
import { authHandlerRewrites } from "./src/lib/firebase/auth-domain";

const nextConfig: NextConfig = {
  async rewrites() {
    return authHandlerRewrites(
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    );
  },
};

export default nextConfig;
