import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative Pfade: läuft unter https://<user>.github.io/<repo>/ ebenso wie lokal mit `vite preview`
  base: './',
  // JSX der Oberfläche für Preact übersetzen (js/ui/*.jsx)
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  // Eine Preact-Instanz, auch für @method-commons/sync (Komponenten der Ablage)
  resolve: { dedupe: ['preact'] },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: { port: 5173 },
  preview: { port: 4173, strictPort: true },
  // Unit-Tests der DOM-freien Logik (Browser-Tests: Playwright, tests/e2e/)
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
    setupFiles: ['tests/unit/setup.js'],
    coverage: {
      provider: 'v8',
      // DOM-freie Logik; die Sprachdateien enthalten nur Textbausteine
      include: ['js/*.js'],
      reporter: ['text'],
      // Mindestabdeckung; ein Rückgang lässt `npm test` scheitern
      thresholds: { statements: 95, branches: 85, functions: 95, lines: 95 },
    },
  },
});
