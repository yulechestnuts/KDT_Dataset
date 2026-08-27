/** @type {import('next').NextConfig} */
const nextConfig = {
  // JSON 응답이 수 MB 라 압축이 크게 먹힌다. Vercel 은 엣지에서 따로 압축하지만
  // 자체 호스팅(next start)에서는 이 옵션이 있어야 gzip 이 걸린다.
  compress: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig 