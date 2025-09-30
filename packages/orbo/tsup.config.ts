import { defineConfig } from "tsup";

export default defineConfig([
  // Production build - minified with property mangling
  {
    entry: ["./src/index.tsx"],
    format: ["esm"],
    platform: "neutral",
    dts: true,
    external: ["react", "react-dom"],
    outDir: "dist",
    minify: true,
    sourcemap: true,
    esbuildOptions(options) {
      options.mangleProps = /^_/;
    },
  },
  // Development build - unminified, no mangling
  {
    entry: ["./src/index.tsx"],
    format: ["esm"],
    platform: "neutral",
    dts: false, // only need declarations once
    external: ["react", "react-dom"],
    outDir: "dist",
    outExtension() {
      return {
        js: ".development.js",
      };
    },
    minify: false,
    sourcemap: true,
  },
]);