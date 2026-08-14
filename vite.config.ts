/// <reference types="vitest/config" />
import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// Directories that sit in the tree without being WordScript's own source: the
// third-party donor and vendor reference repos, nested worktrees, and build
// output — about 40,000 files the dev server has no reason to look at.
// Measured on the running server: 20,393 inotify watches before this list,
// 576 after, with `src/` hot reload unchanged.
//
// ONE list for both consumers. The test runner had excluded three of them
// since it was written and the dev server had never read that list, which is
// exactly the drift a second copy produces. The reloads that cost this repo
// a measurement are in
// docs/known-issues/dev-server-reloads-the-app-mid-session.md.
const NON_SOURCE_DIRS = ["donors", "vendor", "target", ".kilo"];
const NON_SOURCE_GLOBS = NON_SOURCE_DIRS.map((dir) => `**/${dir}/**`);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  // Tauri expects a fixed origin in dev; don't expose to network
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Don't trigger rebuilds when Rust files change, and don't watch the
      // reference trees at all.
      ignored: ["**/src-tauri/**", ...NON_SOURCE_GLOBS]
    }
  },
  // Required for Tauri to load assets with relative paths
  base: "./",
  build: {
    // Tauri targets ES2021 minimum on all supported platforms
    target: ["es2021", "chrome105", "safari15"],
    // Don't minify for better debuggability (Tauri bundles the whole thing anyway)
    minify: !process.env.TAURI_DEBUG,
    // Produce sourcemaps in dev mode for easier debugging
    sourcemap: !!process.env.TAURI_DEBUG,
    outDir: "dist"
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: true,
    // Only run WordScript's own tests: skip nested worktrees and the
    // third-party donor/vendor reference repos vendored into the tree.
    exclude: [
      ...configDefaults.exclude,
      ...NON_SOURCE_GLOBS,
    ]
  }
});