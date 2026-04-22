import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { compression } from 'vite-plugin-compression2'

const vendorChunks = {
  'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
  'vendor-gsap': ['gsap'],
  'vendor-lenis': ['lenis'],
}

function manualChunks(id) {
  for (const [chunkName, packages] of Object.entries(vendorChunks)) {
    if (packages.some((pkg) => id.includes(`/node_modules/${pkg}/`) || id.includes(`/node_modules/${pkg}`))) {
      return chunkName
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    compression({ algorithm: 'brotliCompress', filename: '[path][base].br' }),
    compression({ algorithm: 'gzip', filename: '[path][base].gz' }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
})
