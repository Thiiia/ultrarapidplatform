import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },

  async headers() {
    return [
      {
        source: "/unity/Build/:file(.*\\.wasm\\.unityweb)",
        headers: [{ key: "Content-Type", value: "application/wasm" }],
      },
      {
        source: "/unity/Build/:file(.*\\.framework\\.js\\.unityweb)",
        headers: [{ key: "Content-Type", value: "application/javascript" }],
      },
      {
        source: "/unity/Build/:file(.*\\.data\\.unityweb)",
        headers: [{ key: "Content-Type", value: "application/octet-stream" }],
      },
    ];
  },
};

export default nextConfig;