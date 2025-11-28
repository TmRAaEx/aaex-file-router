import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'AaexFileRouter',
      fileName: (format) => `aaex-file-router.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react-router-dom', 'vite'],
      output: {
        globals: {
          react: 'React',
          'react-router-dom': 'ReactRouterDOM',
        },
      },
    },
  },
  plugins: [dts()], // Generate TypeScript declarations
});