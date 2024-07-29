import { defineConfig } from "@rsbuild/core";

export default defineConfig({
  html: {
    template: "example/index.html",
  },
  source: {
    entry: {
      index: "./example/index.ts",
    },
  },
});
