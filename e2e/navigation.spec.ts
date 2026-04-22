import { test, expect } from "@playwright/test";

test("unauth user bounced from /dashboard/locations", async ({ page }) => {
  await page.goto("/dashboard/locations");
  await expect(page).toHaveURL(/\/login/);
});

test("unauth user bounced from /dashboard/reviews", async ({ page }) => {
  await page.goto("/dashboard/reviews");
  await expect(page).toHaveURL(/\/login/);
});
