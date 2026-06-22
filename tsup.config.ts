import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "express-route-grouping": "src/index.ts" },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  target: "es2017",
  outDir: "dist",
  outExtension({ format }) {
    return {
      js: format === "cjs" ? ".cjs.production.min.js" : ".esm.js",
    };
  },
});
