import os from 'node:os'
import nextra from 'nextra'

function getAllowedDevOrigins() {
  const allowedOrigins = new Set(['localhost', '127.0.0.1'])

  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        allowedOrigins.add(address.address)
      }
    }
  }

  return Array.from(allowedOrigins)
}

const withNextra = nextra({
  contentDirBasePath: '/docs',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  allowedDevOrigins: getAllowedDevOrigins(),
  turbopack: {
    root: process.cwd(),
    resolveAlias: {
      'next-mdx-import-source-file': './mdx-components.tsx',
    },
  },
}

export default withNextra(nextConfig)
