import { networkInterfaces } from 'node:os';

// GitHub Actions supplies its actual repository name at build time.
// Local development always remains at http://localhost:3000/.
const basePath = process.env.NODE_ENV === 'development' ? '' : (process.env.NEXT_PUBLIC_BASE_PATH ?? '');
if (basePath && !/^\/[A-Za-z0-9_-][A-Za-z0-9._/-]*$/.test(basePath) || basePath.endsWith('/')) {
  throw new Error('NEXT_PUBLIC_BASE_PATH must be empty or a path such as /repository-name, without a trailing slash.');
}

// Next.js 16.4 guards development assets/HMR by Origin. iPhone Safari
// visits this server through its LAN IP, rather than the localhost origin.
// Allow only addresses assigned to this Mac; never use a wildcard origin.
let localIPv4 = [];
try {
  localIPv4 = Object.values(networkInterfaces())
    .flatMap(addresses => addresses ?? [])
    .filter(address => address.family === 'IPv4' && !address.internal)
    .map(address => address.address);
} catch {
  // Sandboxed production builds may not expose network interfaces.
  // These origins are only used by the development server.
}

export default {
  output: 'export',
  trailingSlash: true,
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  allowedDevOrigins: [...new Set(['127.0.0.1', ...localIPv4])],
};
