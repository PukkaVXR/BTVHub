import { expect, test, type Page } from "@playwright/test";

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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("btv.nav.collapsedSections", "{}");
    const nativeSetInterval = window.setInterval;
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if ((timeout ?? 0) >= 1_000) return 0;
      return nativeSetInterval(handler, timeout, ...args);
    }) as typeof window.setInterval;
  });
});

async function waitForRouteContent(page: Page, routeName: (typeof routes)[number]["name"]) {
  if (routeName === "dashboard") {
    await page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor({ state: "visible" });
  }

  if (routeName === "activity") {
    await page.locator(".card table tbody").first().locator("tr").first().waitFor({ state: "visible" });
  }

  if (routeName === "alert-editor") {
    await page.locator(".alert-preview-canvas img").first().waitFor({ state: "visible" });
  }
}

async function waitForStableLayout(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

  let previousHeight = -1;
  let stableSamples = 0;
  for (let sample = 0; sample < 12; sample += 1) {
    await page.waitForTimeout(250);
    const currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    stableSamples = currentHeight === previousHeight ? stableSamples + 1 : 0;
    if (stableSamples >= 2) return;
    previousHeight = currentHeight;
  }
}

async function normalizeDynamicContent(page: Page, routeName: (typeof routes)[number]["name"]) {
  await page.locator(".live-status-bar .ui-status-pill").evaluateAll((pills) => {
    const labels = ["Twitch", "Chat", "OBS", "Browser sources", "Alert queue"];
    const details = ["Connected", "Live", "Offline", "0/6", "0 queued"];
    const tones = ["success", "success", "danger", "warning", "info"];

    pills.forEach((pill, index) => {
      if (index >= labels.length) {
        pill.remove();
        return;
      }
      pill.className = `ui-status-pill ui-status-pill--${tones[index]} ui-status-pill--link`;
      const label = pill.querySelector(":scope > span:not(.ui-status-pill__dot)");
      const detail = pill.querySelector(":scope > small");
      if (label) label.textContent = labels[index];
      if (detail) detail.textContent = details[index];
    });
  });

  await page.locator(".global-save-indicator").evaluateAll((indicators) => {
    for (const indicator of indicators) {
      const dot = document.createElement("span");
      dot.className = "global-save-indicator__dot";
      indicator.className = "global-save-indicator global-save-indicator--saved";
      indicator.replaceChildren(dot, "Saved: Visual baseline");
    }
  });

  if (routeName === "activity") {
    const tables = page.locator(".card table tbody");
    const stableRows = [
      ["01/01/2026, 12:00:00", "info", "system", "Stable log message"],
      ["01/01/2026, 12:00:00", "twitch", "chat", "Test operator"],
    ];

    for (let tableIndex = 0; tableIndex < stableRows.length; tableIndex += 1) {
      await tables
        .nth(tableIndex)
        .locator("tr")
        .evaluateAll((rows, values) => {
          for (const row of rows as HTMLTableRowElement[]) {
            Array.from(row.cells).forEach((cell, cellIndex) => {
              cell.textContent = values[cellIndex] ?? "-";
            });
          }
        }, stableRows[tableIndex]);
    }
  }

  if (routeName === "alert-editor") {
    await page.locator(".alert-preview-canvas video").evaluateAll((videos) => {
      for (const video of videos as HTMLVideoElement[]) {
        video.pause();
        video.currentTime = 0;
      }
    });
    await page.locator(".alert-preview-canvas img").evaluateAll(async (images) => {
      await Promise.all(
        (images as HTMLImageElement[]).map(async (image) => {
          const response = await fetch(image.currentSrc || image.src);
          const bitmap = await createImageBitmap(await response.blob());
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
          bitmap.close();
          image.src = canvas.toDataURL("image/png");
          await image.decode();
        }),
      );
    });
  }
}

for (const route of routes) {
  test(`${route.name} visual baseline`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#root")).not.toBeEmpty();
    await page.locator(".main").waitFor({ state: "visible" });
    await waitForRouteContent(page, route.name);
    await waitForStableLayout(page);
    await normalizeDynamicContent(page, route.name);
    await expect(page).toHaveScreenshot(`${route.name}.png`, { fullPage: true });
  });
}
