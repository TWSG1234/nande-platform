/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Cloudinary 官方 SDK 只在伺服器端使用，不打包進前端。
  experimental: { serverComponentsExternalPackages: ["cloudinary"] },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // 上傳圖片放在固定資料夾（不在程式資料夾裡）。對外網址維持 /uploads/...，
  // beforeFiles：即使舊版殘留的 public/uploads 也不會搶先被提供，一律走安全讀取 API。
  async rewrites() {
    return {
      beforeFiles: [{ source: "/uploads/:path*", destination: "/api/files/:path*" }],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // SAMEORIGIN（不是 DENY）：只允許「自己網站的其他頁面」把這個網站包在 iframe
          // 裡面——這是 /admin/mobile 的「手機介面預覽」需要的（用 iframe 嵌入真正的
          // 公開網站來預覽），外部網站仍然完全不能把我們的頁面嵌進去，clickjacking
          // 防護沒有被拿掉，只是從「完全禁止」放寬成「只允許自己」。
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
