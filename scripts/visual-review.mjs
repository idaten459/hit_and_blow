import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const captureRoot = path.resolve(process.cwd(), "visual-feedback", "captures");
const currentRoot = path.resolve(process.cwd(), "visual-feedback", "current");
const validProfiles = new Set(["all", "desktop", "mobile"]);

const parsed = parseArgs(process.argv.slice(2));
await runCapture(parsed);

async function runCapture(options) {
  const env = {
    ...process.env
  };

  if (options.targets.length > 0) {
    env.VISUAL_CAPTURE_TARGETS = options.targets.join(",");
  }

  if (options.profile !== "all") {
    env.VISUAL_CAPTURE_PROFILE = options.profile;
  }

  if (options.label) {
    env.VISUAL_CAPTURE_LABEL = options.label;
  }

  const invocation =
    process.platform === "win32"
      ? {
          command: "cmd.exe",
          args: ["/c", "npx playwright test --config=playwright.visual.config.ts"]
        }
      : {
          command: "npx",
          args: ["playwright", "test", "--config=playwright.visual.config.ts"]
        };

  await spawnProcess(invocation.command, invocation.args, env);

  const latestLabel = (await fs.readFile(path.join(captureRoot, "latest.txt"), "utf8")).trim();
  const latestRoot = path.join(captureRoot, latestLabel);

  await fs.rm(currentRoot, { recursive: true, force: true });
  await fs.mkdir(currentRoot, { recursive: true });
  await copyDirectory(latestRoot, currentRoot);
  await fs.writeFile(path.join(currentRoot, "source-run.txt"), `${latestLabel}\n`, "utf8");

  const manifestPath = path.join(currentRoot, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const reviewState = {
    selectedTargets: options.targets.length > 0 ? options.targets : manifest.targets.map((target) => target.slug),
    selectedProfile: options.profile,
    sourceRun: latestLabel,
    updatedAt: new Date().toISOString(),
    files: manifest.targets.flatMap((target) => target.files)
  };

  await fs.writeFile(
    path.join(currentRoot, "review-state.json"),
    `${JSON.stringify(reviewState, null, 2)}\n`,
    "utf8"
  );

  process.stdout.write(`\nCurrent review bundle updated: ${currentRoot}\n`);
}

function parseArgs(args) {
  const options = {
    label: "",
    profile: "all",
    targets: []
  };

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value === "--desktop") {
      options.profile = "desktop";
      continue;
    }

    if (value === "--mobile") {
      options.profile = "mobile";
      continue;
    }

    if (value === "--all") {
      options.profile = "all";
      continue;
    }

    if (value === "--label") {
      options.label = sanitizeLabel(args[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (value.startsWith("--label=")) {
      options.label = sanitizeLabel(value.slice("--label=".length));
      continue;
    }

    if (value.startsWith("--")) {
      throw new Error(`Unknown option: ${value}`);
    }

    options.targets.push(value);
  }

  if (validProfiles.has(options.profile) === false) {
    throw new Error(`Unsupported profile: ${options.profile}`);
  }

  return options;
}

function sanitizeLabel(value) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-");
}

function spawnProcess(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Capture command failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

async function copyDirectory(source, destination) {
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await fs.mkdir(destinationPath, { recursive: true });
      await copyDirectory(sourcePath, destinationPath);
      continue;
    }

    await fs.copyFile(sourcePath, destinationPath);
  }
}
