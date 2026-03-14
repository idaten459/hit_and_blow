import { expect, test } from "@playwright/test";

test("home page renders mode launch buttons", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Hit and Blow" })).toBeVisible();
  await expect(page.getByRole("button", { name: "この設定で開始" }).first()).toBeVisible();
  await expect(page.getByText("1人プレイ")).toBeVisible();
  await expect(page.getByText("2端末オンライン")).toBeVisible();
});
