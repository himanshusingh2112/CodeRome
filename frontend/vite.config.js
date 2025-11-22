import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Use Vite default (5173) to avoid colliding with backend on 5000
    port: 5173,
  },
})
