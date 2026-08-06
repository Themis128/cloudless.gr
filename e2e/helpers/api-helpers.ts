// API Helper Utilities for Comprehensive Testing
import { APIRequestContext, APIResponse } from "@playwright/test";

/**
 * Enhanced API request wrapper with validation and logging
 */
export class APITestHelper {
  constructor(
    protected request: APIRequestContext,
    protected baseURL: string,
    protected testName: string
  ) {}

  /**
   * Make a GET request with comprehensive validation
   */
  async get(
    endpoint: string,
    options: {
      authToken?: string;
      queryParams?: Record<string, string>;
      expectedStatus?: number | number[];
      validateSchema?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<APIResponse> {
    const {
      authToken,
      queryParams = {},
      expectedStatus = 200,
      validateSchema,
      headers = {}
    } = options;

    // Build URL with query parameters
    const url = new URL(endpoint, this.baseURL);
    Object.keys(queryParams).forEach(key => 
      url.searchParams.set(key, queryParams[key])
    );

    // Prepare headers
    const requestHeaders: Record<string, string> = {
      ...headers
    };

    if (authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    // Make request
    const response = await this.request.get(url.toString(), {
      headers: requestHeaders,
      failOnStatusCode: false
    });

    // Validate status code
    const statusArray = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    if (!statusArray.includes(response.status())) {
      throw new Error(
        `[${this.testName}] Expected status ${statusArray.join(' or ')} for ${endpoint}, got ${response.status()}`
      );
    }

    // Validate response schema if provided
    if (validateSchema && response.status() < 500) {
      try {
        const responseBody = await response.json();
        // In a real implementation, you would use a JSON schema validator here
        // For now, we'll do basic type checking
        this.validateSchema(responseBody, validateSchema, endpoint);
      } catch (e) {
        if (e instanceof Error && e.message.includes('Unexpected token')) {
          // Not JSON, skip schema validation
        } else {
          throw e;
        }
      }
    }

    return response;
  }

  /**
   * Make a POST request with comprehensive validation
   */
  async post(
    endpoint: string,
    data: any,
    options: {
      authToken?: string;
      expectedStatus?: number | number[];
      validateSchema?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<APIResponse> {
    const {
      authToken,
      expectedStatus = 200,
      validateSchema,
      headers = {}
    } = options;

    // Prepare headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    };

    if (authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    // Make request
    const response = await this.request.post(endpoint, {
      data,
      headers: requestHeaders,
      failOnStatusCode: false
    });

    // Validate status code
    const statusArray = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    if (!statusArray.includes(response.status())) {
      throw new Error(
        `[${this.testName}] Expected status ${statusArray.join(' or ')} for ${endpoint}, got ${response.status()}`
      );
    }

    // Validate response schema if provided
    if (validateSchema && response.status() < 500) {
      try {
        const responseBody = await response.json();
        this.validateSchema(responseBody, validateSchema, endpoint);
      } catch (e) {
        if (e instanceof Error && e.message.includes('Unexpected token')) {
          // Not JSON, skip schema validation
        } else {
          throw e;
        }
      }
    }

    return response;
  }

  /**
   * Make a PUT request with comprehensive validation
   */
  async put(
    endpoint: string,
    data: any,
    options: {
      authToken?: string;
      expectedStatus?: number | number[];
      validateSchema?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<APIResponse> {
    const {
      authToken,
      expectedStatus = 200,
      validateSchema,
      headers = {}
    } = options;

    // Prepare headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    };

    if (authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    // Make request
    const response = await this.request.put(endpoint, {
      data,
      headers: requestHeaders,
      failOnStatusCode: false
    });

    // Validate status code
    const statusArray = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    if (!statusArray.includes(response.status())) {
      throw new Error(
        `[${this.testName}] Expected status ${statusArray.join(' or ')} for ${endpoint}, got ${response.status()}`
      );
    }

    // Validate response schema if provided
    if (validateSchema && response.status() < 500) {
      try {
        const responseBody = await response.json();
        this.validateSchema(responseBody, validateSchema, endpoint);
      } catch (e) {
        if (e instanceof Error && e.message.includes('Unexpected token')) {
          // Not JSON, skip schema validation
        } else {
          throw e;
        }
      }
    }

    return response;
  }

  /**
   * Make a DELETE request with comprehensive validation
   */
  async delete(
    endpoint: string,
    options: {
      authToken?: string;
      expectedStatus?: number | number[];
      validateSchema?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<APIResponse> {
    const {
      authToken,
      expectedStatus = 200,
      validateSchema,
      headers = {}
    } = options;

    // Prepare headers
    const requestHeaders: Record<string, string> = {
      ...headers
    };

    if (authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    // Make request
    const response = await this.request.delete(endpoint, {
      headers: requestHeaders,
      failOnStatusCode: false
    });

    // Validate status code
    const statusArray = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    if (!statusArray.includes(response.status())) {
      throw new Error(
        `[${this.testName}] Expected status ${statusArray.join(' or ')} for ${endpoint}, got ${response.status()}`
      );
    }

    // Validate response schema if provided
    if (validateSchema && response.status() < 500) {
      try {
        const responseBody = await response.json();
        this.validateSchema(responseBody, validateSchema, endpoint);
      } catch (e) {
        if (e instanceof Error && e.message.includes('Unexpected token')) {
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
  private validateSchema(data: any, schema: any, endpoint: string): void {
    // This is a simplified validator - in production, use AJV or similar
    if (typeof schema === 'object' && schema !== null) {
      if (Array.isArray(schema)) {
        if (!Array.isArray(data)) {
          throw new Error(`[${this.testName}] ${endpoint}: Expected array, got ${typeof data}`);
        }
        // Validate each item against the first schema element
        if (schema.length > 0 && data.length > 0) {
          data.forEach((item, index) => {
            try {
              this.validateSchema(item, schema[0], `${endpoint}[${index}]`);
            } catch (e) {
              throw new Error(`[${this.testName}] ${endpoint}[${index}]: ${e.message}`);
            }
          });
        }
      } else {
        // Object validation
        if (typeof data !== 'object' || data === null) {
          throw new Error(`[${this.testName}] ${endpoint}: Expected object, got ${typeof data}`);
        }
        
        // Check required properties
        if (schema.required && Array.isArray(schema.required)) {
          for (const requiredProp of schema.required) {
            if (!(requiredProp in data)) {
              throw new Error(`[${this.testName}] ${endpoint}: Missing required property '${requiredProp}'`);
            }
          }
        }
        
        // Validate each property
        if (schema.properties && typeof schema.properties === 'object') {
          for (const [prop, propSchema] of Object.entries(schema.properties)) {
            if (prop in data) {
              try {
                this.validateSchema(data[prop], propSchema, `${endpoint}.${prop}`);
              } catch (e) {
                throw new Error(`[${this.testName}] ${e.message}`);
              }
            }
          }
        }
      }
    }
    // Primitive types validation
    else if (typeof schema === 'string') {
      switch (schema) {
        case 'string':
          if (typeof data !== 'string') {
            throw new Error(`[${this.testName}] Expected string, got ${typeof data}`);
          }
          break;
        case 'number':
          if (typeof data !== 'number' || isNaN(data)) {
            throw new Error(`[${this.testName}] Expected number, got ${typeof data}`);
          }
          break;
        case 'boolean':
          if (typeof data !== 'boolean') {
            throw new Error(`[${this.testName}] Expected boolean, got ${typeof data}`);
          }
          break;
        case 'object':
          if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            throw new Error(`[${this.testName}] Expected object, got ${typeof data}`);
          }
          break;
        case 'array':
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