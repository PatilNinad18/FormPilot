import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Vite configuration for FormPilot AI.
 *
 * The extension ships three independent entry points that Chrome loads at
 * different lifecycle moments, so each must be bundled separately:
 *   - popup      -> HTML page rendered when the toolbar icon is clicked
 *   - background -> MV3 service worker (no DOM, module type)
 *   - content    -> injected into every page to detect & fill forms
 *
 * `background.js` and `content.js` are emitted at the dist root because the
 * manifest references them there. Popup assets live under `assets/` with
 * absolute (`/assets/...`) references, which resolve correctly from the
 * extension root regardless of where the HTML file sits.
 */

const projectRoot = __dirname;

/**
 * MV3 packaging plugin (no external dependency).
 *
 * Vite emits an HTML entry at a path mirroring its source location
 * (`dist/src/popup/index.html`). Chrome's manifest, however, points at
 * `popup/index.html`. This plugin relocates the emitted HTML and copies the
 * static extension assets (manifest, locales, icons) that Vite does not process
 * into the bundle graph.
 */
function crxAssets(): Plugin {
  return {
    name: 'formpilot-crx-assets',
    apply: 'build',
    writeBundle() {
      const dist = resolve(projectRoot, 'dist');

      // 1. Relocate popup HTML: dist/src/popup/index.html -> dist/popup/index.html.
      const emittedHtml = resolve(dist, 'src/popup/index.html');
      const desiredHtml = resolve(dist, 'popup/index.html');
      if (existsSync(emittedHtml) && !existsSync(desiredHtml)) {
        mkdirSync(dirname(desiredHtml), { recursive: true });
        renameSync(emittedHtml, desiredHtml);
      }

      // 2. Drop the now-empty src/ scaffold Vite left behind.
      const srcTree = resolve(dist, 'src');
      if (existsSync(srcTree)) {
        rmSync(srcTree, { recursive: true, force: true });
      }

      // 3. Copy static assets that must ship verbatim at the extension root.
      copyFileSync(resolve(projectRoot, 'manifest.json'), resolve(dist, 'manifest.json'));
      cpSync(resolve(projectRoot, '_locales'), resolve(dist, '_locales'), { recursive: true });
      cpSync(resolve(projectRoot, 'src/public/icons'), resolve(dist, 'icons'), {
        recursive: true,
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), crxAssets()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2021',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        popup: resolve(projectRoot, 'src/popup/index.html'),
        background: resolve(projectRoot, 'src/background/index.ts'),
        content: resolve(projectRoot, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Manifest references these two at the dist root; keep names stable.
          if (chunkInfo.name === 'background') return 'background.js';
          if (chunkInfo.name === 'content') return 'content.js';
          return 'assets/[name].js';
        },
        chunkFileNames: 'assets/chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src'),
      '@shared': resolve(projectRoot, 'src/lib'),
      '@components': resolve(projectRoot, 'src/components'),
      '@hooks': resolve(projectRoot, 'src/hooks'),
      '@constants': resolve(projectRoot, 'src/constants'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
  optimizeDeps: { include: ['react', 'react-dom'] },
});
