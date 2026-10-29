import { defineConfig } from 'vite';
import { demoServices } from './build/demo.ts';
import { site } from './build/site.ts';

export default defineConfig(({ isPreview }) => ({
  plugins: [site(), demoServices()],
  // every address (/pricing/, /workflows/<key>/) is served index.html in dev; the build
  // prerenders each, so the preview serves the files as a host would, 404 included
  appType: isPreview ? 'mpa' : 'spa',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    // source maps beside the scripts: a browser fetches them only when someone opens its developer
    // tools, so a visitor downloads nothing more, and an error report points at real lines
    sourcemap: true,
    // nothing is inlined but the ring's placeholder, which has to be there with the first paint
    assetsInlineLimit: (file) => /ring-ghost-/.test(file),
    // three.js alone is ~550 kB minified; it and GSAP get chunks of their own so a
    // change to the page does not make returning visitors fetch them again, and
    // three loads after the page is already readable (see app.ts)
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'gsap', test: /node_modules[\\/]gsap[\\/]/ },
          ],
        },
      },
    },
  },
}));
