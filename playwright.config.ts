import { defineConfig } from "@playwright/test";

const devCommand = process.platform === "win32" ? "npm.cmd run dev" : "npm run dev";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL
  },
  webServer: {
    command: devCommand,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000
  }
});
