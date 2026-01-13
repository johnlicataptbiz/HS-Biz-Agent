import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    server: {
      port: 3002,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [react()],
    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("/recharts/") || id.includes("\\recharts\\"))
              return "recharts";
            if (id.includes("/react-dom/") || id.includes("\\react-dom\\"))
              return "react-dom";
            if (id.includes("/react/") || id.includes("\\react\\"))
              return "react";
            if (
              id.includes("/lucide-react/") ||
              id.includes("\\lucide-react\\")
            )
              return "icons";
            if (
              id.includes("/@google/generative-ai/") ||
              id.includes("\\@google\\generative-ai\\")
            )
              return "genai";
            return "vendor";
          },
        },
      },
    },
  };
});
