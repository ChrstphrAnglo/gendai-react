import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the API runs separately; proxy it so the app can always call /api like it does on Vercel.
const API = process.env.API_PROXY || 'http://localhost:5001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': API,
      '/uploads': API,
    },
  },
})
