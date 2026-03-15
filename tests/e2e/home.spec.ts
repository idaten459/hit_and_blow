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
