import { defineConfig } from "rolldown";

// Bundle the action into a single CommonJS file loaded by the action runner.
export default defineConfig({
  input: "src/index.ts",
  platform: "node",
  output: {
    file: "action.js",
    format: "cjs",
  },
});
