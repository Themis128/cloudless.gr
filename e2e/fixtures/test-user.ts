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

export const URL_PATHS = {
  home: "/",
  login: "/auth/login",
  signup: "/auth/signup",
  forgotPassword: "/auth/forgot-password",
  dashboard: "/dashboard",
  profile: "/dashboard/profile",
  purchases: "/dashboard/purchases",
  consultations: "/dashboard/consultations",
  settings: "/dashboard/settings",
  admin: "/admin",
  users: "/admin/users",
  orders: "/admin/orders",
  crm: "/admin/crm",
  analytics: "/admin/analytics",
  services: "/services",
  store: "/store",
  blog: "/blog",
  contact: "/contact",
  privacy: "/privacy",
  terms: "/terms",
  cookies: "/cookies",
  refund: "/refund-policy",
};

export const WAIT_TIMES = {
  short: 500,
  medium: 1000,
  long: 3000,
  veryLong: 5000,
};
