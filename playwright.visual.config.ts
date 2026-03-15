import { defineConfig, devices } from "@playwright/test";

const devCommand = process.platform === "win32" ? "npm.cmd run dev" : "npm run dev";
const requestedProfile = process.env.VISUAL_CAPTURE_PROFILE ?? "all";
const allProjects = [
  {
    name: "desktop",
    use: {
      viewport: {
        width: 1440,
        height: 960
      }
    }
  },
  {
    name: "mobile",
    use: {
      ...devices["iPhone 13"]
    }
  }
];

const projects =
  requestedProfile === "all"
    ? allProjects
    : allProjects.filter((project) => project.name === requestedProfile);

if (projects.length === 0) {
  throw new Error(`Unsupported VISUAL_CAPTURE_PROFILE: ${requestedProfile}`);
}

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: false,
  reporter: "line",
  projects,
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
