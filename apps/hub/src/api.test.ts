import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/serverUrls", () => ({ resolveApiBase: () => "/api" }));
vi.mock("./lib/testAlertMilestone", () => ({ emitTestAlertSuccess: vi.fn() }));

type FetchCall = { url: string; init: RequestInit };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function loadApi() {
  vi.resetModules();
  return import("./api");
}

describe("Hub API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares one token bootstrap across concurrent authenticated requests", async () => {
    const calls: FetchCall[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      calls.push({ url, init });
      if (url === "/api/auth/token") return jsonResponse({ token: "token-1" });
      if (url === "/api/health") return jsonResponse({ ok: true });
      if (url === "/api/alert-projects") return jsonResponse([]);
      return jsonResponse({ message: "Unexpected request" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await loadApi();

    await Promise.all([api.health(), api.alertProjects()]);

    expect(calls.filter((call) => call.url === "/api/auth/token")).toHaveLength(1);
    for (const call of calls.filter((item) => item.url !== "/api/auth/token")) {
      expect(new Headers(call.init.headers).get("X-BTV-Token")).toBe("token-1");
    }
  });

  it("clears a failed token bootstrap so the next request can recover", async () => {
    let tokenAttempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/token") {
        tokenAttempts += 1;
        return tokenAttempts === 1
          ? jsonResponse({ message: "API token bootstrap is only available to the local Hub" }, 403)
          : jsonResponse({ token: "recovered-token" });
      }
      return jsonResponse({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await loadApi();

    await expect(api.health()).rejects.toThrow("Could not bootstrap local API token");
    await expect(api.health()).resolves.toMatchObject({ ok: true });
    expect(tokenAttempts).toBe(2);
  });

  it("sends authenticated JSON writes with encoded resource ids", async () => {
    const calls: FetchCall[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      calls.push({ url, init });
      if (url === "/api/auth/token") return jsonResponse({ token: "write-token" });
      return jsonResponse({ ok: true, project: { id: "alert/one" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await loadApi();
    const project = { id: "alert/one", name: "Test alert" } as never;

    await api.saveAlertProject(project);

    const write = calls.find((call) => call.url !== "/api/auth/token");
    expect(write?.url).toBe("/api/alert-projects/alert%2Fone");
    expect(write?.init.method).toBe("PUT");
    const headers = new Headers(write?.init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-BTV-Token")).toBe("write-token");
    expect(JSON.parse(String(write?.init.body))).toEqual(project);
  });

  it("surfaces structured API error messages", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/auth/token") return jsonResponse({ token: "token-2" });
      return jsonResponse({ message: "FOREIGN KEY constraint failed" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { ApiRequestError, api } = await loadApi();

    const error = await api.deleteAlertProject("in-use").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      message: "FOREIGN KEY constraint failed",
      status: 500,
      data: { message: "FOREIGN KEY constraint failed" },
    });
  });

  it("does not send an API token while bootstrapping the token itself", async () => {
    let bootstrapHeaders = new Headers();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init: RequestInit = {}) => {
      bootstrapHeaders = new Headers(init.headers);
      return jsonResponse({ token: "token-3" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getLocalApiToken } = await loadApi();

    await expect(getLocalApiToken()).resolves.toBe("token-3");
    expect(bootstrapHeaders.has("X-BTV-Token")).toBe(false);
  });

  it("sends config profile imports as authenticated JSON writes", async () => {
    const calls: FetchCall[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      calls.push({ url, init });
      if (url === "/api/auth/token") return jsonResponse({ token: "config-token" });
      return jsonResponse({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await loadApi();
    const profile = {
      format: "btv.config-profile",
      version: 1,
      exportedAt: "2026-06-23T00:00:00.000Z",
      profile: { settings: [] },
    } as never;

    await api.importConfigProfile(profile);

    const write = calls.find((call) => call.url === "/api/config/import");
    expect(write?.init.method).toBe("POST");
    expect(new Headers(write?.init.headers).get("X-BTV-Token")).toBe("config-token");
    expect(JSON.parse(String(write?.init.body))).toEqual({ profile });
  });
});
