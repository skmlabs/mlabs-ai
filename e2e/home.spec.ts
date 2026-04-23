import { test, expect } from "@playwright/test";
test("landing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /marketing intelligence for/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /sign in with google/i })).toBeVisible();
});
