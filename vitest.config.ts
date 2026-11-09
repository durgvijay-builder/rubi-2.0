import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/rubi_dev?schema=public',
      NODE_ENV: 'test',
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
  },
});
