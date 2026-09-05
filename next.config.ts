import type { NextConfig } from 'next';

/**
 * Static export. There is no server in this product — designs live in the
 * browser's IndexedDB and the simulator runs client-side — so the build is a
 * folder of files that can be served from anywhere, or opened offline once the
 * browser has cached it.
 */
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // Serving from a plain file host is easier when every route is a directory
  // with its own index.html.
  trailingSlash: true,
};

export default nextConfig;
