import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // The Midnight on-chain runtime ships as WebAssembly. Both bundlers need to
  // be told to treat it as an async WASM module rather than a static asset.
  turbopack: {
    rules: {
      "*.wasm": {
        loaders: [],
        as: "*.wasm",
      },
    },
    // See lib/shims/isomorphic-ws.ts: the package's browser entry has no named
    // `WebSocket` export, which Turbopack treats as a hard error.
    resolveAlias: {
      "isomorphic-ws": {
        browser: "./lib/shims/isomorphic-ws.ts",
      },
    },
  },
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    // Same isomorphic-ws fix as the turbopack alias above, for parity when
    // building with webpack instead.
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "isomorphic-ws": path.resolve(
          process.cwd(),
          "lib/shims/isomorphic-ws.ts",
        ),
      };
    }
    return config;
  },
}

export default nextConfig
