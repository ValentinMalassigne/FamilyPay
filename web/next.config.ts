import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // output: "standalone" → Next génère un serveur Node autonome dans
  // .next/standalone, utilisable tel quel par le Dockerfile de production
  // (sans dépendre de node_modules complet au runtime).
  output: 'standalone',
};

export default nextConfig;
