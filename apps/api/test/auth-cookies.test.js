import { describe, expect, it } from "vitest";
import { clearRefreshCookieOptions, refreshCookieOptions } from "../src/services/authTokens.js";

describe("refresh cookie options", () => {
  it("keeps local refresh cookie defaults strict and insecure", () => {
    const config = {
      refreshCookieSameSite: "strict",
      refreshCookieSecure: false,
      refreshTokenDays: 30
    };

    expect(refreshCookieOptions(config)).toMatchObject({
      httpOnly: true,
      path: "/auth",
      sameSite: "strict",
      secure: false
    });
    expect(clearRefreshCookieOptions(config)).toEqual({
      path: "/auth",
      sameSite: "strict",
      secure: false
    });
  });

  it("supports production cross-site refresh cookies and guards SameSite=None with Secure", () => {
    const config = {
      refreshCookieSameSite: "none",
      refreshCookieSecure: false,
      refreshTokenDays: 30
    };

    expect(refreshCookieOptions(config)).toMatchObject({
      httpOnly: true,
      path: "/auth",
      sameSite: "none",
      secure: true
    });
    expect(clearRefreshCookieOptions(config)).toEqual({
      path: "/auth",
      sameSite: "none",
      secure: true
    });
  });
});
