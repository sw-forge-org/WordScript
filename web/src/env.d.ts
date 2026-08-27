/// <reference types="astro/client" />

/* The Rust source ../../src-tauri/src/core/language_detect.rs is read as text
   at build time by src/lib/languages.ts. Vite serves `?raw` for any extension;
   TypeScript only knows the ones `astro/client` declares, and `.rs` is not one
   of them. */
declare module '*.rs?raw' {
  const src: string;
  export default src;
}
