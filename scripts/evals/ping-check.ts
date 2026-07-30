const https = require("https");

function sanitizeForLog(value) {
  return String(value).replace(/[\r\n\x00-\x1f\x7f]/g, " ").slice(0, 500);
}

https
  .get("https://cloudless.gr", (res) => {
    console.log("OK", sanitizeForLog(res.statusCode));
  })
  .on("error", (err) => {
    console.log("FAIL", sanitizeForLog(err.message));
  });
