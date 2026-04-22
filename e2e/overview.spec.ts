import { test, expect } from "@playwright/test";

test("unauth bounced from /dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
