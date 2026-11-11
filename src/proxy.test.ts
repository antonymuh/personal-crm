import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getAuth: () => ({ api: { getSession } }) }));

const { proxy } = await import("@/proxy");

const request = () => new NextRequest("http://localhost:3000/");

beforeEach(() => {
  getSession.mockReset();
});

describe("proxy", () => {
  it("sends a visitor without a session to the sign-in page", async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null });

    const response = await proxy(request());

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in"
    );
  });

  it("lets the page show its own error when the session cannot be checked", async () => {
    // For example, the database is down. The page checks the session again,
    // fails the same way and shows the app's error page, not a bare 500.
    getSession.mockRejectedValue(new Error("Database query failed"));

    const response = await proxy(request());

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });
});
