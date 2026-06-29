import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "express-group-route": "src/index.ts" },
  format: ["cjs", "esm"],
  dts: {
    compilerOptions: {
      // tsup injects baseUrl during DTS; silence TS 6 deprecations until tsup fixes it
      ignoreDeprecations: "6.0",
    },
  },
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
