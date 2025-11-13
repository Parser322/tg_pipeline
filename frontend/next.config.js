/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Явно указываем корень рабочей области для Turbopack
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: '**' },
      { protocol: 'https', hostname: '**' },
    ],
  },
};

module.exports = nextConfig;
