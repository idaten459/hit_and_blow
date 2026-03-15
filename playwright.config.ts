import { defineConfig } from "@playwright/test";

const devCommand = process.platform === "win32" ? "npm.cmd run dev" : "npm run dev";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000"
  },
  webServer: {
    command: devCommand,
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000
  }
});
