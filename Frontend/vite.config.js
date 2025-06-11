import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis' // <-- This maps 'global' to 'globalThis'
  },
  resolve: {
    alias: {
      // Needed for packages like randombytes that expect these
      buffer: 'buffer',
      process: 'process/browser'
    }
  },
  optimizeDeps: {
    include: ['buffer', 'process']
  }
})
