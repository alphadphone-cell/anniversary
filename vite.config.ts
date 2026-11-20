import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (!normalized.includes('/node_modules/')) return undefined;
          if (normalized.includes('/node_modules/three/')) return 'three-core';
          if (
            normalized.includes('/node_modules/@react-three/drei/') ||
            normalized.includes('/node_modules/troika-')
          ) {
            return 'r3f-drei';
          }
          if (
            normalized.includes('/node_modules/@react-three/') ||
            normalized.includes('/node_modules/postprocessing/')
          ) {
            return 'r3f-core';
          }
          if (normalized.includes('/node_modules/framer-motion/')) return 'motion';
          if (
            normalized.includes('/node_modules/react/') ||
            normalized.includes('/node_modules/react-dom/')
          ) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
});
