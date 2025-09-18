/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  async redirects() {
    return [
      { source: '/contact',           destination: '/book',       permanent: true },
      { source: '/contact.html',      destination: '/book',       permanent: true },
      { source: '/returning',         destination: '/book',       permanent: true },
      { source: '/returning.html',    destination: '/book',       permanent: true },
      { source: '/multi-property',    destination: '/book',       permanent: true },
      { source: '/multi-property.html', destination: '/book',     permanent: true },
      // Clean URL -> static file
      { source: '/book',              destination: '/book.html',  permanent: false },
    ];
  },

  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "frame-src 'self' https://cal.com https://*.cal.com",
              "form-action 'self'",
              "script-src 'self' https://embed.cal.com 'unsafe-inline'",
              "connect-src 'self' https://api.airtable.com https://hook.us2.make.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
            ].join('; ')
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
