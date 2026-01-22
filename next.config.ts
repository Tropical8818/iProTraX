import type { NextConfig } from "next";

const withNextIntl = require('next-intl/plugin')();

const nextConfig: NextConfig = {
  output: 'standalone',
  webpack: (config, { isServer, dev }) => {
    // Only obfuscate in production and on server side logic (where verifyLicense runs)
    if (isServer && !dev) {
      const WebpackObfuscator = require('webpack-obfuscator');
      config.plugins.push(
        new WebpackObfuscator({
          rotateStringArray: true,
          stringArray: true,
          stringArrayThreshold: 0.75,
          compact: true,
          controlFlowFlattening: true,
          deadCodeInjection: true,
          debugProtection: false, // careful with this one
          disableConsoleOutput: false,
          identifierNamesGenerator: 'hexadecimal',
          log: false,
          renameGlobals: false,
          selfDefending: true,
          target: 'node',
          // Important: Don't obfuscate next.js internals or node_modules too aggressively
          // or it might break the runtime
          exclude: ['node_modules', '.next'],
        }, ['**/*.js']) // This second arg is 'excludes' for the plugin instance if targeting files
      );
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' api.openai.com;",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

// Force restart
