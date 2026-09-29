import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Served from https://<user>.github.io/PriceBias_Football/
export default defineConfig({
  base: '/PriceBias_Football/',
  plugins: [react(), tailwindcss()],
  // Plotly is split into its own lazily loaded chunk
  build: { chunkSizeWarningLimit: 1600 },
})
