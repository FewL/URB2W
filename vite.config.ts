import { defineConfig } from "vite";

export default defineConfig({
  base: "/URB2W/",
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
});
