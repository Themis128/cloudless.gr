try {
  const { getHttpAuthDb } = require("@/lib/d1-http");
  console.log("require succeeded");
  const httpDb = getHttpAuthDb();
  console.log("httpDb:", httpDb);
} catch (e) {
  console.error("require failed:", e);
}