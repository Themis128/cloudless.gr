import { describe, expect, it } from "vitest";

import { loadLocalAuthDbModule } from "@/lib/auth-db-node/loader";

describe("auth-db-node loader", () => {
  it("returns null when the local adapter cannot be required (vitest empty context)", () => {
    expect(loadLocalAuthDbModule()).toBeNull();
  });
});
