import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.tsx"],
  // ESM only
  format: ["esm"],
  platform: "neutral",
  dts: true,
  external: ["react", "react-dom"],
  outDir: "dist",
});
