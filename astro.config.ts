import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

/**
 * BACS Labs · Astro Configuration
 *
 * Stack:
 * - Astro 5 SSG (static-first, islands architecture)
 * - Tailwind 4 (CSS-first config, Vite plugin)
 * - React 19 (only for Calculator island — client:load)
 *
 * Deploy hedef: Cloudflare Pages
 * Custom domain: labs.barisanil.com
 */
export default defineConfig({
  site: 'https://labs.barisanil.com',

  output: 'static',

  integrations: [
    react({
      include: ['**/Calculator.tsx', '**/calculator/**'],
    }),
  ],

  vite: {
    // Vite plugin type chains arası nested type duplication — astro's bundled vite types
    // ile external vite types çakışıyor. Type-safe at runtime, sadece compile-time issue.
    plugins: [tailwindcss() as never],
    build: {
      cssCodeSplit: true,
      assetsInlineLimit: 4096,
    },
  },

  build: {
    inlineStylesheets: 'auto',
    assets: '_assets',
  },

  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'viewport',
  },

  experimental: {
    clientPrerender: true,
  },
});
