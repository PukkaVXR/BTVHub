import { expect, test } from "@playwright/test";

const routes = [
  { name: "dashboard", path: "/" },
  { name: "mobile-control", path: "/mobile-control" },
  { name: "activity", path: "/activity" },
  { name: "recaps", path: "/recaps" },
  { name: "overlays", path: "/overlays" },
  { name: "widgets", path: "/widgets" },
  { name: "alert-projects", path: "/alerts" },
  { name: "alert-routing", path: "/alerts/routing" },
  { name: "alert-editor", path: "/alerts/visual-baseline" },
  { name: "interactive", path: "/interactive" },
  { name: "commands", path: "/commands" },
  { name: "automations", path: "/automations" },
  { name: "macros", path: "/macros" },
  { name: "webhooks", path: "/webhooks" },
  { name: "stream-deck", path: "/stream-deck" },
  { name: "channel-points", path: "/channel-points" },
  { name: "soundboard", path: "/soundboard" },
  { name: "tournament", path: "/tournament" },
  { name: "predictions", path: "/predictions" },
  { name: "boss-fight", path: "/boss-fight" },
  { name: "chat-chaos", path: "/chat-chaos" },
  { name: "plugins", path: "/plugins" },
  { name: "integrations", path: "/integrations" },
  { name: "setup", path: "/setup" },
] as const;

const viewports = [
  { name: "phone", width: 390, height: 900 },
  { name: "tablet", width: 768, height: 1000 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("btv.nav.collapsedSections", "{}");
  });
});

for (const viewport of viewports) {
  test.describe(`${viewport.name} responsive layout`, () => {
    test.use({ viewport });

    for (const route of routes) {
      test(`${route.name} does not create viewport overflow`, async ({ page }) => {
        await page.goto(route.path, { waitUntil: "domcontentloaded" });
        await expect(page.locator("#root")).not.toBeEmpty();
        await page.locator(".main").waitFor({ state: "visible" });
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

        const overflow = await page.evaluate(() => {
          const tolerance = 2;
          return (
            Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth <= tolerance
          );
        });

        expect(overflow).toBe(true);
      });
    }
  });
}
