import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Needed for file watching through Docker bind mounts on some hosts.
    watch: process.env.CHOKIDAR_USEPOLLING ? { usePolling: true } : undefined,
  },
})
