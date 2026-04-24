import { test, expect } from "@playwright/test";

test("landing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /know your google presence/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /sign in with google/i })).toBeVisible();
});
