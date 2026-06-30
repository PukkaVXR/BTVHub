import { expect, test } from "@playwright/test";

test("shared content surfaces use the premium entrance motion", async ({ page }) => {
  await page.goto("/integrations", { waitUntil: "domcontentloaded" });
  await page.locator(".app-page").waitFor({ state: "visible" });
  const firstCard = page.locator(".ui-card").first();
  await firstCard.waitFor({ state: "visible" });

  await expect(firstCard).toHaveCSS("animation-name", "ui-content-enter");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("disables route and shared surface entrance animations", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/integrations", { waitUntil: "domcontentloaded" });
    await page.locator(".app-page").waitFor({ state: "visible" });
    const firstCard = page.locator(".ui-card").first();
    await firstCard.waitFor({ state: "visible" });

    await expect(page.locator(".app-page")).toHaveCSS("animation-name", "none");
    await expect(firstCard).toHaveCSS("animation-name", "none");
  });
});
