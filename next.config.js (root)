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
      { source: '/multi-property.html', destination: '/book', permanent: true }
    ];
  },
  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
      { source: '/book', destination: '/book.html' },
      { source: '/providers', destination: '/providers.html' },
      { source: '/returning', destination: '/returning.html' },
      { source: '/multi-property', destination: '/multi-property.html' }
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; frame-src https://cal.com https://*.cal.com; script-src 'self' https://embed.cal.com 'unsafe-inline'; connect-src 'self' https://api.airtable.com; style-src 'self' 'unsafe-inline';"
          }
        ]
      }
    ];
  }
};
module.exports = nextConfig;
