import { describe, it, expect } from "vitest";
import { authOpenApiSpec } from "@/lib/auth-openapi";

describe("authOpenApiSpec", () => {
  it("is a valid OpenAPI 3.0 spec shape", () => {
    expect(authOpenApiSpec.openapi).toMatch(/^3\./);
    expect(authOpenApiSpec.info.title).toBeDefined();
    expect(typeof authOpenApiSpec.info.version).toBe("string");
  });

  it("documents the login endpoint", () => {
    expect(authOpenApiSpec.paths["/api/auth/login"]).toBeDefined();
    expect(authOpenApiSpec.paths["/api/auth/login"].post).toBeDefined();
  });

  it("documents the register endpoint", () => {
    const paths = authOpenApiSpec.paths as Record<string, unknown>;
    const registerKey = Object.keys(paths).find((k) => k.includes("register"));
    expect(registerKey).toBeDefined();
  });

  it("has non-empty paths", () => {
    expect(Object.keys(authOpenApiSpec.paths).length).toBeGreaterThan(0);
  });
});
