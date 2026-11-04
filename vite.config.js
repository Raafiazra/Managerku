import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, "index.html"),
        login: resolve(rootDir, "login.html"),
        register: resolve(rootDir, "register.html"),
        dashboard: resolve(rootDir, "dashboard.html")
      }
    }
  }
});
