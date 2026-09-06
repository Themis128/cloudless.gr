import { describe, it, expect } from "vitest";
import { isWorkersEnvironment, getD1Config, getD1ConfigValue, setD1ConfigValue } from "@/lib/ssm-config-d1";

function makeDb(rows: Array<{ key: string; value: string }>): D1Database {
  return {
    prepare: (sql: string) => ({
      bind: (..._args: unknown[]) => ({
        run: async () => ({ results: [], success: true }),
        first: async () => rows.find((r) => sql.includes("?") && true) ?? null,
      }),
      all: async () => ({ results: rows, success: true }),
      first: async <T>() => (rows[0] as T) ?? null,
      run: async () => ({ results: [], success: true }),
    }),
    batch: async () => [],
    dump: async () => new ArrayBuffer(0),
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

describe("isWorkersEnvironment", () => {
  it("returns false in Node.js test environment", () => {
    expect(isWorkersEnvironment()).toBe(false);
  });
});

describe("getD1Config", () => {
  it("returns key-value pairs from D1 rows", async () => {
    const db = makeDb([
      { key: "SLACK_BOT_TOKEN", value: "xoxb-test" },
      { key: "SES_FROM_EMAIL", value: "test@example.com" },
    ]);
    const config = await getD1Config(db);
    expect(config["SLACK_BOT_TOKEN"]).toBe("xoxb-test");
    expect(config["SES_FROM_EMAIL"]).toBe("test@example.com");
  });

  it("returns empty object when no rows", async () => {
    const db = makeDb([]);
    const config = await getD1Config(db);
    expect(Object.keys(config)).toHaveLength(0);
  });
});

describe("getD1ConfigValue", () => {
  it("returns value for a known key", async () => {
    const db = {
      prepare: (_sql: string) => ({
        bind: (_key: string) => ({
          first: async () => ({ value: "some-value" }),
        }),
      }),
    } as unknown as D1Database;
    const result = await getD1ConfigValue(db, "ANY_KEY");
    expect(result).toBe("some-value");
  });

  it("returns undefined when key not found", async () => {
    const db = {
      prepare: (_sql: string) => ({
        bind: (_key: string) => ({
          first: async () => null,
        }),
      }),
    } as unknown as D1Database;
    const result = await getD1ConfigValue(db, "MISSING_KEY");
    expect(result).toBeUndefined();
  });
});

describe("setD1ConfigValue", () => {
  it("calls prepare/bind/run without error", async () => {
    let ran = false;
    const db = {
      prepare: (_sql: string) => ({
        bind: (..._args: unknown[]) => ({
          run: async () => {
            ran = true;
            return { success: true };
          },
        }),
      }),
    } as unknown as D1Database;
    await setD1ConfigValue(db, "MY_KEY", "my-value", "A description");
    expect(ran).toBe(true);
  });
});
