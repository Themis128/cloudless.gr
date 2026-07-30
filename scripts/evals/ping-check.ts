const https = require("https");

https
  .get("https://cloudless.gr", () => {
    // Static log line only (CodeQL js/log-injection — status/error text is external).
    console.log("OK");
  })
  .on("error", () => {
    console.log("FAIL");
  });
