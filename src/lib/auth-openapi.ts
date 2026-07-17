/**
 * OpenAPI specification for auth endpoints.
 *
 * This file documents the auth API for:
 * - Login: POST /api/auth/login
 * - Logout: POST /api/auth/logout
 * - Register: POST /api/auth/register-d1
 * - Session check: GET /api/auth/login
 * - Password reset: POST /api/auth/reset-password
 * - Password reset confirm: POST /api/auth/reset-confirm
 * - Email verification: POST /api/auth/activate-d1
 */

export const authOpenApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Cloudless.gr Auth API",
    version: "1.0.0",
    description: "Authentication endpoints for cloudless.gr using D1 database",
  },
  paths: {
    "/api/auth/login": {
      post: {
        summary: "User login",
        description: "Authenticate user with email and password. Optionally supports 'Remember me' for longer sessions.",
        operationId: "login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    example: "user@example.com",
                  },
                  password: {
                    type: "string",
                    format: "password",
                    example: "SecurePassword123!",
                  },
                  rememberMe: {
                    type: "boolean",
                    description: "If true, extends session to 60 days; otherwise 30 days",
                    example: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Successful login",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        email: { type: "string", format: "email" },
                        name: { type: "string" },
                        company: { type: "string" },
                        phone: { type: "string" },
                      },
                    },
                    isAdmin: { type: "boolean" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
          "429": {
            description: "Rate limited or account locked",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
        },
      },
      get: {
        summary: "Check current session",
        description: "Returns user info if session is valid, null otherwise",
        operationId: "getSession",
        responses: {
          "200": {
            description: "Session info",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: {
                      type: "object",
                      nullable: true,
                      properties: {
                        id: { type: "string", format: "uuid" },
                        email: { type: "string", format: "email" },
                        name: { type: "string", nullable: true },
                        company: { type: "string", nullable: true },
                        phone: { type: "string", nullable: true },
                      },
                    },
                    isAdmin: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/register-d1": {
      post: {
        summary: "Register new user",
        description: "Create a new user account. Returns activation token for email verification.",
        operationId: "register",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "user@example.com" },
                  password: { type: "string", format: "password", description: "Min 8 chars, mixed case, number, symbol" },
                  fullName: { type: "string", example: "John Doe" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "User created or confirmation message sent",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    token: { type: "string", description: "Activation token for email verification" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid input or password requirements not met",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/reset-password": {
      post: {
        summary: "Request password reset",
        description: "Send password reset email. Always returns success to prevent enumeration.",
        operationId: "requestPasswordReset",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Reset email sent (or user doesn't exist)",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean" } } },
              },
            },
          },
        },
      },
    },
    "/api/auth/reset-confirm": {
      post: {
        summary: "Confirm password reset",
        description: "Set new password using reset token",
        operationId: "confirmPasswordReset",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "newPassword", "confirmPassword"],
                properties: {
                  token: { type: "string" },
                  newPassword: { type: "string", format: "password" },
                  confirmPassword: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Password updated",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean" } } },
              },
            },
          },
          "400": {
            description: "Invalid or expired token",
            content: {
              "application/json": {
                schema: { type: "object", properties: { error: { type: "string" } } },
              },
            },
          },
        },
      },
    },
    "/api/auth/activate-d1": {
      post: {
        summary: "Verify email with OTP",
        description: "Complete email verification using OTP code",
        operationId: "verifyEmail",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "otp", "token"],
                properties: {
                  email: { type: "string", format: "email" },
                  otp: { type: "string", description: "6-digit code sent via email" },
                  token: { type: "string", description: "Activation token from registration" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Email verified",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean" } } },
              },
            },
          },
        },
      },
    },
  },
} as const;

export default authOpenApiSpec;