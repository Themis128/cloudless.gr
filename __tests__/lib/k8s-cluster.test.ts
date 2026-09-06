import { describe, it, expect } from "vitest";
import { isInCluster, getCurrentNamespace } from "@/lib/k8s-cluster";

describe("isInCluster", () => {
  it("returns false in a Node.js test env (no KUBERNETES_SERVICE_HOST)", () => {
    expect(isInCluster()).toBe(false);
  });
});

describe("getCurrentNamespace", () => {
  it("returns null or a string when not in cluster", () => {
    const ns = getCurrentNamespace();
    expect(ns === null || typeof ns === "string").toBe(true);
  });
});
