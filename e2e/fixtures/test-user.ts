/**
 * Centralized test data and fixtures
 */

export const TEST_USERS = {
  newCustomer: {
    email: "new-customer@test.example.com",
    password: "TestPassword123!",
    name: "New Customer",
  },
  existingCustomer: {
    email: "customer@test.example.com",
    password: "TestPassword123!",
    name: "Existing Customer",
  },
  admin: {
    email: "admin@test.example.com",
    password: "TestPassword123!",
    name: "Admin User",
  },
};

export const TEST_DATA = {
  productIds: ["prod_1", "prod_2", "prod_3"],
  apiEndpoints: {
    login: "/api/auth/login",
    signup: "/api/auth/signup",
    logout: "/api/auth/logout",
  },
  locales: ["en", "el", "fr"],
  formTemplates: {
    contact: {
      name: "Test User",
      email: "test@example.com",
      subject: "Test Subject",
      message: "This is a test message",
    },
  },
};

/** Locale-prefixed paths — baseURL is host-only for absolute `/…` gotos; localePrefix is always. */
export const URL_PATHS = {
  home: "/en",
  login: "/en/auth/login",
  signup: "/en/auth/signup",
  forgotPassword: "/en/auth/forgot-password",
  dashboard: "/en/dashboard",
  profile: "/en/dashboard/profile",
  purchases: "/en/dashboard/purchases",
  consultations: "/en/dashboard/consultations",
  settings: "/en/dashboard/settings",
  admin: "/en/admin",
  users: "/en/admin/users",
  orders: "/en/admin/orders",
  crm: "/en/admin/crm",
  analytics: "/en/admin/analytics",
  services: "/en/services",
  store: "/en/store",
  blog: "/en/blog",
  contact: "/en/contact",
  privacy: "/en/privacy",
  terms: "/en/terms",
  cookies: "/en/cookies",
  refund: "/en/refund-policy",
};

export const WAIT_TIMES = {
  short: 500,
  medium: 1000,
  long: 3000,
  veryLong: 5000,
};
