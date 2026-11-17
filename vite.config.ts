import { defineConfig } from "vite";
import { resolve } from "node:path";

// Two entries: the side panel document (where the models run) and the
// background service worker (which only opens the panel).
export default defineConfig({
  envPrefix: "VITE_FIREBASE_",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome139",
    rollupOptions: {
      input: {
        sidepanel: resolve(import.meta.dirname, "sidepanel.html"),
        background: resolve(import.meta.dirname, "src/background.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
