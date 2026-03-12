import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import sentry from '@sentry/astro';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  site: 'https://plainchildcare.com',
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    sentry({
      dsn: 'https://92acf314941eded7d7d9228edbadc776@o4510827630231552.ingest.de.sentry.io/4511031098474576',
      sourceMapsUploadOptions: {
        enabled: false,
      },
    }),
  ],
});
