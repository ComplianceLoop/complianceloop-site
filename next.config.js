/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async redirects() {
    return [
      { source: '/contact', destination: '/book', permanent: true },
      { source: '/contact.html', destination: '/book', permanent: true },
      { source: '/returning', destination: '/book', permanent: true },
      { source: '/returning.html', destination: '/book', permanent: true },
      { source: '/multi-property', destination: '/book', permanent: true },
      { source: '/multi-property.html', destination: '/book', permanent: true },
      { source: '/book', destination: '/book.html', permanent: false },
    ];
  },
  async rewrites() {
    return [{ source: '/', destination: '/index.html' }];
  },
  async headers() {
    // NOTE: Add 'self' to frame-src so the hidden iframe can load /api/ingest
    const csp = [
      "default-src 'self'",
      "frame-src 'self' https://cal.com https://*.cal.com",
      "script-src 'self' https://embed.cal.com 'unsafe-inline'",
      "connect-src 'self' https://api.airtable.com https://hook.us2.make.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
    ].join('; ');
    return [
      {
        source: '/:path*',
        headers: [{ key: 'Content-Security-Policy', value: csp }],
      },
    ];
  },
};

module.exports = nextConfig;
