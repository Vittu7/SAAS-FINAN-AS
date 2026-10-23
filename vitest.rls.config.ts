import { defineConfig } from "vitest/config";

// Testes de isolamento/RLS rodam contra um Supabase REAL (de teste). Ficam fora do `npm test`.
export default defineConfig({
  test: {
    include: ["tests/rls/**/*.rls.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
