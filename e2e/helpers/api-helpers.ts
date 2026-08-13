// API Helper Utilities for Comprehensive Testing
import { APIRequestContext, APIResponse, expect } from "@playwright/test";

/**
 * Admin route-coverage: auth gate passed (not 401/403) and the handler responded.
 * 4xx (missing input / wrong method) and 5xx (unbound integrations in dev) are OK —
 * same contract as e2e/admin-api-sweep.spec.ts.
 */
export function assertAdminRouteWired(status: number): void {
  expect([401, 403]).not.toContain(status);
  expect(status).toBeGreaterThanOrEqual(200);
  expect(status).toBeLessThan(600);
}

/**
 * Public route-coverage: any HTTP response proves the route is mounted.
 * Missing/optional surfaces may 404; unbound integrations may 503/5xx.
 */
export function assertPublicRouteWired(status: number): void {
  expect(status).toBeGreaterThanOrEqual(200);
  expect(status).toBeLessThan(600);
}

/**
 * Enhanced API request wrapper with validation and logging.
 * Status checks only run when `expectedStatus` is explicitly provided —
 * callers should use assertAdminRouteWired / assertPublicRouteWired for
 * route-coverage sweeps.
 */
export class APITestHelper {
  constructor(
    protected request: APIRequestContext,
    protected baseURL: string,
    protected testName: string
  ) {}

  private assertExpectedStatus(
    endpoint: string,
    status: number,
    expectedStatus: number | number[] | undefined
  ): void {
    if (expectedStatus === undefined) return;
    const statusArray = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    if (!statusArray.includes(status)) {
      throw new Error(
        `[${this.testName}] Expected status ${statusArray.join(" or ")} for ${endpoint}, got ${status}`
      );
    }
  }

  /**
   * Make a GET request with optional status validation
   */
  async get(
    endpoint: string,
    options: {
      authToken?: string;
      queryParams?: Record<string, string>;
      expectedStatus?: number | number[];
      validateSchema?: unknown;
      headers?: Record<string, string>;
    } = {}
  ): Promise<APIResponse> {
    const {
      authToken,
      queryParams = {},
      expectedStatus,
      validateSchema,
      headers = {},
    } = options;

    const url = new URL(endpoint, this.baseURL);
    Object.keys(queryParams).forEach((key) =>
      url.searchParams.set(key, queryParams[key])
    );

    const requestHeaders: Record<string, string> = {
      ...headers,
    };

    if (authToken) {
      // Match admin-fixture / api-auth header lookup (lowercase).
      requestHeaders["authorization"] = `Bearer ${authToken}`;
    }

    const response = await this.request.get(url.toString(), {
      headers: requestHeaders,
      failOnStatusCode: false,
      // OAuth and other admin starts may 302 off-origin; do not follow.
      maxRedirects: 0,
    });

    this.assertExpectedStatus(endpoint, response.status(), expectedStatus);

    if (validateSchema && response.status() < 500) {
      try {
        const responseBody = await response.json();
        this.validateSchema(responseBody, validateSchema, endpoint);
      } catch (e) {
        if (e instanceof Error && e.message.includes("Unexpected token")) {
          // Not JSON, skip schema validation
        } else {
          throw e;
        }
      }
    }

    return response;
  }

  /**
   * Make a POST request with optional status validation
   */
  async post(
    endpoint: string,
    data: unknown,
    options: {
      authToken?: string;
      expectedStatus?: number | number[];
      validateSchema?: unknown;
      headers?: Record<string, string>;
    } = {}
  ): Promise<APIResponse> {
    const { authToken, expectedStatus, validateSchema, headers = {} } = options;

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    if (authToken) {
      requestHeaders["authorization"] = `Bearer ${authToken}`;
    }

    const url = new URL(endpoint, this.baseURL).toString();
    const response = await this.request.post(url, {
      data,
      headers: requestHeaders,
      failOnStatusCode: false,
      maxRedirects: 0,
    });

    this.assertExpectedStatus(endpoint, response.status(), expectedStatus);

    if (validateSchema && response.status() < 500) {
      try {
        const responseBody = await response.json();
        this.validateSchema(responseBody, validateSchema, endpoint);
      } catch (e) {
        if (e instanceof Error && e.message.includes("Unexpected token")) {
          // Not JSON, skip schema validation
        } else {
          throw e;
        }
      }
    }

    return response;
  }

  /**
   * Make a PUT request with optional status validation
   */
  async put(
    endpoint: string,
    data: unknown,
    options: {
      authToken?: string;
      expectedStatus?: number | number[];
      validateSchema?: unknown;
      headers?: Record<string, string>;
    } = {}
  ): Promise<APIResponse> {
    const { authToken, expectedStatus, validateSchema, headers = {} } = options;

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    if (authToken) {
      requestHeaders["authorization"] = `Bearer ${authToken}`;
    }

    const url = new URL(endpoint, this.baseURL).toString();
    const response = await this.request.put(url, {
      data,
      headers: requestHeaders,
      failOnStatusCode: false,
      maxRedirects: 0,
    });

    this.assertExpectedStatus(endpoint, response.status(), expectedStatus);

    if (validateSchema && response.status() < 500) {
      try {
        const responseBody = await response.json();
        this.validateSchema(responseBody, validateSchema, endpoint);
      } catch (e) {
        if (e instanceof Error && e.message.includes("Unexpected token")) {
          // Not JSON, skip schema validation
        } else {
          throw e;
        }
      }
    }

    return response;
  }

  /**
   * Make a DELETE request with optional status validation
   */
  async delete(
    endpoint: string,
    options: {
      authToken?: string;
      expectedStatus?: number | number[];
      validateSchema?: unknown;
      headers?: Record<string, string>;
    } = {}
  ): Promise<APIResponse> {
    const { authToken, expectedStatus, validateSchema, headers = {} } = options;

    const requestHeaders: Record<string, string> = {
      ...headers,
    };

    if (authToken) {
      requestHeaders["authorization"] = `Bearer ${authToken}`;
    }

    const url = new URL(endpoint, this.baseURL).toString();
    const response = await this.request.delete(url, {
      headers: requestHeaders,
      failOnStatusCode: false,
      maxRedirects: 0,
    });

    this.assertExpectedStatus(endpoint, response.status(), expectedStatus);

    if (validateSchema && response.status() < 500) {
      try {
        const responseBody = await response.json();
        this.validateSchema(responseBody, validateSchema, endpoint);
      } catch (e) {
        if (e instanceof Error && e.message.includes("Unexpected token")) {
          // Not JSON, skip schema validation
        } else {
          throw e;
        }
      }
    }

    return response;
  }

  /**
   * Basic schema validation (can be enhanced with a proper JSON schema library)
   */
  private validateSchema(data: unknown, schema: unknown, endpoint: string): void {
    if (typeof schema === "object" && schema !== null) {
      if (Array.isArray(schema)) {
        if (!Array.isArray(data)) {
          throw new Error(
            `[${this.testName}] ${endpoint}: Expected array, got ${typeof data}`
          );
        }
        if (schema.length > 0 && data.length > 0) {
          data.forEach((item, index) => {
            try {
              this.validateSchema(item, schema[0], `${endpoint}[${index}]`);
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              throw new Error(`[${this.testName}] ${endpoint}[${index}]: ${msg}`);
            }
          });
        }
      } else {
        if (typeof data !== "object" || data === null) {
          throw new Error(
            `[${this.testName}] ${endpoint}: Expected object, got ${typeof data}`
          );
        }

        const schemaObj = schema as {
          required?: string[];
          properties?: Record<string, unknown>;
        };
        const dataObj = data as Record<string, unknown>;

        if (schemaObj.required && Array.isArray(schemaObj.required)) {
          for (const requiredProp of schemaObj.required) {
            if (!(requiredProp in dataObj)) {
              throw new Error(
                `[${this.testName}] ${endpoint}: Missing required property '${requiredProp}'`
              );
            }
          }
        }

        if (schemaObj.properties && typeof schemaObj.properties === "object") {
          for (const [prop, propSchema] of Object.entries(schemaObj.properties)) {
            if (prop in dataObj) {
              try {
                this.validateSchema(dataObj[prop], propSchema, `${endpoint}.${prop}`);
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                throw new Error(`[${this.testName}] ${msg}`);
              }
            }
          }
        }
      }
    } else if (typeof schema === "string") {
      switch (schema) {
        case "string":
          if (typeof data !== "string") {
            throw new Error(`[${this.testName}] Expected string, got ${typeof data}`);
          }
          break;
        case "number":
          if (typeof data !== "number" || Number.isNaN(data)) {
            throw new Error(`[${this.testName}] Expected number, got ${typeof data}`);
          }
          break;
        case "boolean":
          if (typeof data !== "boolean") {
            throw new Error(`[${this.testName}] Expected boolean, got ${typeof data}`);
          }
          break;
        case "object":
          if (typeof data !== "object" || data === null || Array.isArray(data)) {
            throw new Error(`[${this.testName}] Expected object, got ${typeof data}`);
          }
          break;
        case "array":
          if (!Array.isArray(data)) {
            throw new Error(`[${this.testName}] Expected array, got ${typeof data}`);
          }
          break;
      }
    }
  }
}

/**
 * Factory function to create an API test helper
 */
export function createAPIHelper(
  request: APIRequestContext,
  baseURL: string,
  testName: string
): APITestHelper {
  return new APITestHelper(request, baseURL, testName);
}
