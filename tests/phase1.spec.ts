import { test, expect } from "@playwright/test";

test.describe("Robocode Phase 1", () => {
  test("homepage should load", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("https://robocode.rahejaom.workers.dev/");
  });

  test("login page should redirect to WorkOS", async ({ page }) => {
    await page.goto("/auth/login");
    await page.waitForURL(/\/api\.workos\.com/);
    const url = page.url();
    expect(url).toContain("client_id");
    expect(url).toContain("redirect_uri");
  });

  test("game page elements", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });
  });
});
