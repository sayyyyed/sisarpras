import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@sisarpras/domain": path.resolve(import.meta.dirname, "../../packages/domain/src/index.ts"),
    },
  },
  server: { port: 5173, strictPort: true, watch: { ignored: ["**/src-tauri/**"] } },
});
