import { defineConfig } from "vite";

// Relative base so the build works on a GitHub Pages project path
// (https://<user>.github.io/follow-through-audit/) and on a custom
// domain without reconfiguration.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
