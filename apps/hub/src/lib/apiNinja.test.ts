import { describe, expect, it } from "vitest";
import { createApiNinjaButton, formatApiNinjaHeaders, withStreamDeckAuthHeaders } from "./apiNinja";

describe("formatApiNinjaHeaders", () => {
  it("formats API Ninja header lines without spaces after the colon", () => {
    expect(formatApiNinjaHeaders({
      "Content-Type": "application/json",
      "X-BTV-Token": "abc123",
    })).toBe("Content-Type:application/json\nX-BTV-Token:abc123");
  });

  it("omits empty header values", () => {
    expect(formatApiNinjaHeaders({ "X-BTV-Token": "   " })).toBe("");
  });
});

describe("createApiNinjaButton", () => {
  it("writes custom headers into API Ninja settings", () => {
    const settings = createApiNinjaButton({
      title: "Switch layout",
      method: "POST",
      url: "http://127.0.0.1:4782/api/actions/source-group/group-1",
      headers: { "X-BTV-Token": "token-1" },
      body: "{}",
    });

    expect(settings.headers).toBe("X-BTV-Token:token-1");
  });
});

describe("withStreamDeckAuthHeaders", () => {
  it("adds the local API token header to export payloads", () => {
    expect(withStreamDeckAuthHeaders({
      title: "Stop all",
      method: "POST",
      url: "http://127.0.0.1:4782/api/emergency/all",
    }, "token-2").headers).toEqual({ "X-BTV-Token": "token-2" });
  });
});
