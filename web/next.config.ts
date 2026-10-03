import type { NextConfig } from 'next'

// docker-compose still sets the Vite-era names; honour them so `bash run.sh up` keeps working.
const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE ?? process.env.VITE_DATA_SOURCE ?? 'mock'
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.VITE_API_URL ?? 'http://localhost:3001'

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_DATA_SOURCE: dataSource,
    NEXT_PUBLIC_API_URL: apiUrl,
  },
}

export default config
