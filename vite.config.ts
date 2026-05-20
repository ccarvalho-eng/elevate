import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
