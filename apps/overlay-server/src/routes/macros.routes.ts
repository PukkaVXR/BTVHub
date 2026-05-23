import { deleteMacro, getMacro, getMacros, upsertMacro } from "../db.js";
import { macroFromBody } from "../schemas/macro.schema.js";
import type { RouteModule } from "./types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const registerMacrosRoutes: RouteModule = (app, ctx) => {
  app.get("/api/macros", async () => getMacros());
  app.put("/api/macros/:id", async (req) => {
    const { id } = req.params as { id: string };
    upsertMacro(macroFromBody(id, req.body as ReturnType<typeof getMacros>[number]));
    return { ok: true };
  });
  app.delete("/api/macros/:id", async (req) => {
    deleteMacro((req.params as { id: string }).id);
    return { ok: true };
  });
  app.post("/api/actions/macro/:id", async (req, reply) => {
    const result = await ctx.macroRunner.run((req.params as { id: string }).id);
    return reply.status(result.ok ? 200 : 409).send(result);
  });
  app.get("/api/actions/macro/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const macro = getMacro(id);
    if (!macro) {
      return reply.status(404).type("text/html").send(`<!doctype html>
        <html lang="en">
          <head><title>Macro not found</title></head>
          <body style="font-family: system-ui, sans-serif; background: #0e0e10; color: #efeff1; padding: 24px;">
            <h1>Macro not found</h1>
            <p>No macro exists with id <code>${escapeHtml(id)}</code>.</p>
          </body>
        </html>`);
    }
    return reply.type("text/html").send(`<!doctype html>
      <html lang="en">
        <head>
          <title>${escapeHtml(macro.name)} - BTV Macro</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body style="font-family: system-ui, sans-serif; background: #0e0e10; color: #efeff1; padding: 24px;">
          <main style="max-width: 560px;">
            <h1 style="margin: 0 0 8px;">${escapeHtml(macro.name)}</h1>
            <p style="color: #adadb8;">This macro action uses POST. Click Run to trigger it from this local page.</p>
            <button id="run" type="button" style="background: #9147ff; color: white; border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 700; cursor: pointer;">Run macro</button>
            <pre id="result" style="margin-top: 16px; white-space: pre-wrap; background: #18181b; border: 1px solid #2d2d35; border-radius: 8px; padding: 12px;"></pre>
          </main>
          <script>
            const button = document.getElementById("run");
            const result = document.getElementById("result");
            button.addEventListener("click", async () => {
              button.disabled = true;
              result.textContent = "Running...";
              try {
                const res = await fetch(location.pathname, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
                const json = await res.json();
                result.textContent = JSON.stringify(json, null, 2);
              } catch (err) {
                result.textContent = err instanceof Error ? err.message : "Macro failed";
              } finally {
                button.disabled = false;
              }
            });
          </script>
        </body>
      </html>`);
  });
};
