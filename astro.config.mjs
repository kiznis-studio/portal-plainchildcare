import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import sentry from '@sentry/astro';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  site: 'https://plainchildcare.com',
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    plugins: [tailwindcss()],
    build: { target: 'es2022' },
  },
  integrations: [
    sentry({
      dsn: 'https://92acf314941eded7d7d9228edbadc776@o4510827630231552.ingest.de.sentry.io/4511031098474576',
      enabled: { client: false, server: true },
      sourceMapsUploadOptions: {
        enabled: false,
      },
    }),
  ],
});
