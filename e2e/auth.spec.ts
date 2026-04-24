import { test, expect } from "@playwright/test";

test("unauthenticated user is redirected from /dashboard to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
});

test("landing page still renders publicly", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /know your google presence/i })
  ).toBeVisible();
});
