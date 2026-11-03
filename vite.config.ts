import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  // Relative paths let the build work under GitHub Pages' /wonkey-ear/ folder.
  base: "./",
  clearScreen: false,
  server: {
    port: 5199,
    strictPort: true,
  },
});
