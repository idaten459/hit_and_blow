import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

interface CaptureTarget {
  slug: string;
  path: string;
  readySelector?: string;
  settleMs?: number;
}

interface CaptureManifest {
  label: string;
  baseURL: string;
  profiles: string[];
  targets: Array<{
    slug: string;
    path: string;
    files: string[];
  }>;
}

const captureRoot = path.resolve(process.cwd(), "visual-feedback", "captures");
const targetsPath = path.resolve(process.cwd(), "visual-feedback", "targets.json");
const captureTargets = loadCaptureTargets();
const captureLabel = sanitizeLabel(process.env.VISUAL_CAPTURE_LABEL ?? timestampLabel());
const selectedTargetNames = new Set(
  (process.env.VISUAL_CAPTURE_TARGETS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

const activeTargets =
  selectedTargetNames.size === 0
    ? captureTargets
    : captureTargets.filter((target) => selectedTargetNames.has(target.slug));

if (activeTargets.length === 0) {
  throw new Error("No capture targets matched VISUAL_CAPTURE_TARGETS.");
}

const activeProfiles = getProfileNames(process.env.VISUAL_CAPTURE_PROFILE ?? "all");
const runDirectory = path.join(captureRoot, captureLabel);
const manifest: CaptureManifest = {
  label: captureLabel,
  baseURL: "http://127.0.0.1:3000",
  profiles: activeProfiles,
  targets: activeTargets.map((target) => ({
    slug: target.slug,
    path: target.path,
    files: activeProfiles.map((profile) => path.join(runDirectory, profile, `${target.slug}.png`))
  }))
};

test.describe.configure({ mode: "serial" });
test.beforeAll(() => {
  fs.mkdirSync(runDirectory, { recursive: true });
  fs.writeFileSync(path.join(captureRoot, "latest.txt"), `${captureLabel}\n`, "utf8");
  writeManifest(manifest);
});

for (const target of activeTargets) {
  test(`${target.slug} screenshot`, async ({ page }, testInfo) => {
    await page.goto(target.path, { waitUntil: "domcontentloaded" });
    await expect(page.locator(target.readySelector ?? "main").first()).toBeVisible();
    await page.waitForTimeout(target.settleMs ?? 600);

    const profileDirectory = path.join(runDirectory, testInfo.project.name);
    fs.mkdirSync(profileDirectory, { recursive: true });

    await page.screenshot({
      path: path.join(profileDirectory, `${target.slug}.png`),
      fullPage: true
    });
  });
}

function loadCaptureTargets(): CaptureTarget[] {
  const raw = fs.readFileSync(targetsPath, "utf8");
  const parsed = JSON.parse(raw) as CaptureTarget[];

  if (Array.isArray(parsed) === false || parsed.length === 0) {
    throw new Error("visual-feedback/targets.json must contain at least one target.");
  }

  return parsed;
}

function getProfileNames(profileSelection: string) {
  const profileNames = ["desktop", "mobile"];

  if (profileSelection === "all") {
    return profileNames;
  }

  if (profileNames.includes(profileSelection) === false) {
    throw new Error(`Unsupported VISUAL_CAPTURE_PROFILE: ${profileSelection}`);
  }

  return [profileSelection];
}

function writeManifest(manifest: CaptureManifest) {
  fs.writeFileSync(path.join(runDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function sanitizeLabel(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-");
}

function timestampLabel() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    `${now.getMonth() + 1}`.padStart(2, "0"),
    `${now.getDate()}`.padStart(2, "0"),
    `${now.getHours()}`.padStart(2, "0"),
    `${now.getMinutes()}`.padStart(2, "0"),
    `${now.getSeconds()}`.padStart(2, "0")
  ];

  return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}${parts[5]}`;
}
