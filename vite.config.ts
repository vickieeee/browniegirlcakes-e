import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        { find: '@/src', replacement: path.resolve(__dirname, './src') },
        { find: '@', replacement: path.resolve(__dirname, './src') },
      ],
    },
    server: {
      // HMR is disabled in AI Studio preview environment to prevent WebSocket errors and flickering.
      hmr: false,
      watch: null,
    },
  };
});
