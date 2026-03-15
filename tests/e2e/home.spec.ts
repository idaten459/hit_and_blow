import { expect, test } from "@playwright/test";

test("home page renders mode launch buttons", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Hit and Blow" })).toBeVisible();
  await expect(page.getByRole("button", { name: "この設定で開始" }).first()).toBeVisible();
  await expect(page.getByText("1人プレイ")).toBeVisible();
  await expect(page.getByText("2端末オンライン")).toBeVisible();
});

test("clicking toggle descriptions updates the related checkboxes", async ({ page }) => {
  await page.goto("/");

  const allowDuplicates = page.locator("#allowDuplicates");
  const assistEnabled = page.locator("#assistEnabled");

  await expect(allowDuplicates).not.toBeChecked();
  await expect(assistEnabled).toBeChecked();

  await page.locator('label[for="allowDuplicates"] .subtle-copy').click();
  await expect(allowDuplicates).toBeChecked();

  await page.locator('label[for="assistEnabled"] .subtle-copy').click();
  await expect(assistEnabled).not.toBeChecked();
});

test("online room code can be copied from the lobby", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(
    "/play/online?mode=online&codeLength=4&colorCount=6&allowDuplicates=false&turnLimit=null&assistEnabled=true"
  );

  await page.getByRole("button", { name: "部屋を作る" }).click();

  const roomBadge = page.getByText(/^部屋 [A-Z0-9]{6}$/);
  await expect(roomBadge).toBeVisible();

  await page.getByRole("button", { name: "コードをコピー" }).click();
  await expect(page.getByRole("button", { name: "コピー済み" })).toBeVisible();

  const copiedText = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedText).toMatch(/^[A-Z0-9]{6}$/);
});
