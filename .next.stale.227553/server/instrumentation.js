"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "instrumentation";
exports.ids = ["instrumentation"];
exports.modules = {

/***/ "(instrument)/./src/instrumentation-flags.ts":
/*!**************************************!*\
  !*** ./src/instrumentation-flags.ts ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   shouldBindRemoteAuthDb: () => (/* binding */ shouldBindRemoteAuthDb),\n/* harmony export */   shouldPreferLocalAuthDb: () => (/* binding */ shouldPreferLocalAuthDb)\n/* harmony export */ });\n/**\n * Edge-safe flags for instrumentation. Keep this file free of node:fs / sqlite\n * so Edge compilation of instrumentation.ts can import it.\n */ /** Live D1 REST is the default. Sqlite only when AUTH_DB_PREFER_LOCAL=1. */ function shouldPreferLocalAuthDb() {\n    if (false) {}\n    if (process.env.AUTH_DB_USE_HTTP === \"1\") return false;\n    return process.env.AUTH_DB_PREFER_LOCAL === \"1\";\n}\n/**\n * Remote OpenNext bind needs a Cloudflare token and a live API. CI, E2E, and\n * tokenless `next dev` must skip it — otherwise wrangler starts a remote\n * proxy session that never becomes ready and `register()` never resolves.\n */ function shouldBindRemoteAuthDb() {\n    if (false) {}\n    if (false) {}\n    if (process.env.CI === \"true\") return false;\n    if (true) return false;\n    if (process.env.AUTH_DB_PREFER_LOCAL === \"1\") return false;\n    if (process.env.AUTH_DB_USE_HTTP === \"1\") return false;\n    if (!process.env.CLOUDFLARE_API_TOKEN) return false;\n    return true;\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGluc3RydW1lbnQpLy4vc3JjL2luc3RydW1lbnRhdGlvbi1mbGFncy50cyIsIm1hcHBpbmdzIjoiOzs7OztBQUFBOzs7Q0FHQyxHQUVELDBFQUEwRSxHQUNuRSxTQUFTQTtJQUNkLElBQUlDLEtBQXNDLEVBQUUsRUFBYTtJQUN6RCxJQUFJQSxRQUFRQyxHQUFHLENBQUNDLGdCQUFnQixLQUFLLEtBQUssT0FBTztJQUNqRCxPQUFPRixRQUFRQyxHQUFHLENBQUNFLG9CQUFvQixLQUFLO0FBQzlDO0FBRUE7Ozs7Q0FJQyxHQUNNLFNBQVNDO0lBQ2QsSUFBSUosS0FBcUMsRUFBRSxFQUFhO0lBQ3hELElBQUlBLEtBQXNDLEVBQUUsRUFBYTtJQUN6RCxJQUFJQSxRQUFRQyxHQUFHLENBQUNLLEVBQUUsS0FBSyxRQUFRLE9BQU87SUFDdEMsSUFBSU4sSUFBbUMsRUFBRSxPQUFPO0lBQ2hELElBQUlBLFFBQVFDLEdBQUcsQ0FBQ0Usb0JBQW9CLEtBQUssS0FBSyxPQUFPO0lBQ3JELElBQUlILFFBQVFDLEdBQUcsQ0FBQ0MsZ0JBQWdCLEtBQUssS0FBSyxPQUFPO0lBQ2pELElBQUksQ0FBQ0YsUUFBUUMsR0FBRyxDQUFDTyxvQkFBb0IsRUFBRSxPQUFPO0lBQzlDLE9BQU87QUFDVCIsInNvdXJjZXMiOlsiL3dvcmtzcGFjZS9zcmMvaW5zdHJ1bWVudGF0aW9uLWZsYWdzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRWRnZS1zYWZlIGZsYWdzIGZvciBpbnN0cnVtZW50YXRpb24uIEtlZXAgdGhpcyBmaWxlIGZyZWUgb2Ygbm9kZTpmcyAvIHNxbGl0ZVxuICogc28gRWRnZSBjb21waWxhdGlvbiBvZiBpbnN0cnVtZW50YXRpb24udHMgY2FuIGltcG9ydCBpdC5cbiAqL1xuXG4vKiogTGl2ZSBEMSBSRVNUIGlzIHRoZSBkZWZhdWx0LiBTcWxpdGUgb25seSB3aGVuIEFVVEhfREJfUFJFRkVSX0xPQ0FMPTEuICovXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkUHJlZmVyTG9jYWxBdXRoRGIoKTogYm9vbGVhbiB7XG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gXCJkZXZlbG9wbWVudFwiKSByZXR1cm4gZmFsc2U7XG4gIGlmIChwcm9jZXNzLmVudi5BVVRIX0RCX1VTRV9IVFRQID09PSBcIjFcIikgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gcHJvY2Vzcy5lbnYuQVVUSF9EQl9QUkVGRVJfTE9DQUwgPT09IFwiMVwiO1xufVxuXG4vKipcbiAqIFJlbW90ZSBPcGVuTmV4dCBiaW5kIG5lZWRzIGEgQ2xvdWRmbGFyZSB0b2tlbiBhbmQgYSBsaXZlIEFQSS4gQ0ksIEUyRSwgYW5kXG4gKiB0b2tlbmxlc3MgYG5leHQgZGV2YCBtdXN0IHNraXAgaXQg4oCUIG90aGVyd2lzZSB3cmFuZ2xlciBzdGFydHMgYSByZW1vdGVcbiAqIHByb3h5IHNlc3Npb24gdGhhdCBuZXZlciBiZWNvbWVzIHJlYWR5IGFuZCBgcmVnaXN0ZXIoKWAgbmV2ZXIgcmVzb2x2ZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRCaW5kUmVtb3RlQXV0aERiKCk6IGJvb2xlYW4ge1xuICBpZiAocHJvY2Vzcy5lbnYuTkVYVF9SVU5USU1FICE9PSBcIm5vZGVqc1wiKSByZXR1cm4gZmFsc2U7XG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gXCJkZXZlbG9wbWVudFwiKSByZXR1cm4gZmFsc2U7XG4gIGlmIChwcm9jZXNzLmVudi5DSSA9PT0gXCJ0cnVlXCIpIHJldHVybiBmYWxzZTtcbiAgaWYgKHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0UyRSA9PT0gXCIxXCIpIHJldHVybiBmYWxzZTtcbiAgaWYgKHByb2Nlc3MuZW52LkFVVEhfREJfUFJFRkVSX0xPQ0FMID09PSBcIjFcIikgcmV0dXJuIGZhbHNlO1xuICBpZiAocHJvY2Vzcy5lbnYuQVVUSF9EQl9VU0VfSFRUUCA9PT0gXCIxXCIpIHJldHVybiBmYWxzZTtcbiAgaWYgKCFwcm9jZXNzLmVudi5DTE9VREZMQVJFX0FQSV9UT0tFTikgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gdHJ1ZTtcbn1cbiJdLCJuYW1lcyI6WyJzaG91bGRQcmVmZXJMb2NhbEF1dGhEYiIsInByb2Nlc3MiLCJlbnYiLCJBVVRIX0RCX1VTRV9IVFRQIiwiQVVUSF9EQl9QUkVGRVJfTE9DQUwiLCJzaG91bGRCaW5kUmVtb3RlQXV0aERiIiwiTkVYVF9SVU5USU1FIiwiQ0kiLCJORVhUX1BVQkxJQ19FMkUiLCJDTE9VREZMQVJFX0FQSV9UT0tFTiJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(instrument)/./src/instrumentation-flags.ts\n");

/***/ }),

/***/ "(instrument)/./src/instrumentation.ts":
/*!********************************!*\
  !*** ./src/instrumentation.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   register: () => (/* binding */ register),\n/* harmony export */   shouldBindRemoteAuthDb: () => (/* reexport safe */ _instrumentation_flags__WEBPACK_IMPORTED_MODULE_0__.shouldBindRemoteAuthDb),\n/* harmony export */   shouldPreferLocalAuthDb: () => (/* reexport safe */ _instrumentation_flags__WEBPACK_IMPORTED_MODULE_0__.shouldPreferLocalAuthDb)\n/* harmony export */ });\n/* harmony import */ var _instrumentation_flags__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./instrumentation-flags */ \"(instrument)/./src/instrumentation-flags.ts\");\n/**\n * Next.js instrumentation — runs once per server instance and must finish\n * before the process accepts requests (Next 16 gates the request handler on\n * `register()`).\n *\n * Next compiles this file for BOTH Node and Edge (Turbopack always builds\n * `instrumentation.edge`; see vercel/next.js#86479). Node-only APIs in THIS\n * file — even inside helpers — are reported as Edge errors (#85938). The\n * documented split is an inline NEXT_RUNTIME check + dynamic import of a\n * separate file (#61728: do not wrap the check in a helper).\n *\n * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation\n * @see https://nextjs.org/docs/app/guides/instrumentation#importing-runtime-specific-code\n * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/\n */ \nasync function register() {\n    if (true) {\n        const { registerNode } = await __webpack_require__.e(/*! import() */ \"_instrument_src_instrumentation_node_ts\").then(__webpack_require__.bind(__webpack_require__, /*! ./instrumentation.node */ \"(instrument)/./src/instrumentation.node.ts\"));\n        await registerNode();\n    }\n    if (false) {}\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGluc3RydW1lbnQpLy4vc3JjL2luc3RydW1lbnRhdGlvbi50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7O0NBY0MsR0FFeUY7QUFFbkYsZUFBZUU7SUFDcEIsSUFBSUMsSUFBcUMsRUFBRTtRQUN6QyxNQUFNLEVBQUVHLFlBQVksRUFBRSxHQUFHLE1BQU0sZ05BQWdDO1FBQy9ELE1BQU1BO0lBQ1I7SUFFQSxJQUFJSCxLQUFtQyxFQUFFLEVBR3hDO0FBQ0giLCJzb3VyY2VzIjpbIi93b3Jrc3BhY2Uvc3JjL2luc3RydW1lbnRhdGlvbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE5leHQuanMgaW5zdHJ1bWVudGF0aW9uIOKAlCBydW5zIG9uY2UgcGVyIHNlcnZlciBpbnN0YW5jZSBhbmQgbXVzdCBmaW5pc2hcbiAqIGJlZm9yZSB0aGUgcHJvY2VzcyBhY2NlcHRzIHJlcXVlc3RzIChOZXh0IDE2IGdhdGVzIHRoZSByZXF1ZXN0IGhhbmRsZXIgb25cbiAqIGByZWdpc3RlcigpYCkuXG4gKlxuICogTmV4dCBjb21waWxlcyB0aGlzIGZpbGUgZm9yIEJPVEggTm9kZSBhbmQgRWRnZSAoVHVyYm9wYWNrIGFsd2F5cyBidWlsZHNcbiAqIGBpbnN0cnVtZW50YXRpb24uZWRnZWA7IHNlZSB2ZXJjZWwvbmV4dC5qcyM4NjQ3OSkuIE5vZGUtb25seSBBUElzIGluIFRISVNcbiAqIGZpbGUg4oCUIGV2ZW4gaW5zaWRlIGhlbHBlcnMg4oCUIGFyZSByZXBvcnRlZCBhcyBFZGdlIGVycm9ycyAoIzg1OTM4KS4gVGhlXG4gKiBkb2N1bWVudGVkIHNwbGl0IGlzIGFuIGlubGluZSBORVhUX1JVTlRJTUUgY2hlY2sgKyBkeW5hbWljIGltcG9ydCBvZiBhXG4gKiBzZXBhcmF0ZSBmaWxlICgjNjE3Mjg6IGRvIG5vdCB3cmFwIHRoZSBjaGVjayBpbiBhIGhlbHBlcikuXG4gKlxuICogQHNlZSBodHRwczovL25leHRqcy5vcmcvZG9jcy9hcHAvYXBpLXJlZmVyZW5jZS9maWxlLWNvbnZlbnRpb25zL2luc3RydW1lbnRhdGlvblxuICogQHNlZSBodHRwczovL25leHRqcy5vcmcvZG9jcy9hcHAvZ3VpZGVzL2luc3RydW1lbnRhdGlvbiNpbXBvcnRpbmctcnVudGltZS1zcGVjaWZpYy1jb2RlXG4gKiBAc2VlIGh0dHBzOi8vZG9jcy5zZW50cnkuaW8vcGxhdGZvcm1zL2phdmFzY3JpcHQvZ3VpZGVzL25leHRqcy9cbiAqL1xuXG5leHBvcnQgeyBzaG91bGRCaW5kUmVtb3RlQXV0aERiLCBzaG91bGRQcmVmZXJMb2NhbEF1dGhEYiB9IGZyb20gXCIuL2luc3RydW1lbnRhdGlvbi1mbGFnc1wiO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVnaXN0ZXIoKSB7XG4gIGlmIChwcm9jZXNzLmVudi5ORVhUX1JVTlRJTUUgPT09IFwibm9kZWpzXCIpIHtcbiAgICBjb25zdCB7IHJlZ2lzdGVyTm9kZSB9ID0gYXdhaXQgaW1wb3J0KFwiLi9pbnN0cnVtZW50YXRpb24ubm9kZVwiKTtcbiAgICBhd2FpdCByZWdpc3Rlck5vZGUoKTtcbiAgfVxuXG4gIGlmIChwcm9jZXNzLmVudi5ORVhUX1JVTlRJTUUgPT09IFwiZWRnZVwiKSB7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcImRldmVsb3BtZW50XCIpIHJldHVybjtcbiAgICBhd2FpdCBpbXBvcnQoXCIuLi9zZW50cnkuZWRnZS5jb25maWdcIik7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJzaG91bGRCaW5kUmVtb3RlQXV0aERiIiwic2hvdWxkUHJlZmVyTG9jYWxBdXRoRGIiLCJyZWdpc3RlciIsInByb2Nlc3MiLCJlbnYiLCJORVhUX1JVTlRJTUUiLCJyZWdpc3Rlck5vZGUiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(instrument)/./src/instrumentation.ts\n");

/***/ }),

/***/ "child_process":
/*!********************************!*\
  !*** external "child_process" ***!
  \********************************/
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ "diagnostics_channel":
/*!**************************************!*\
  !*** external "diagnostics_channel" ***!
  \**************************************/
/***/ ((module) => {

module.exports = require("diagnostics_channel");

/***/ }),

/***/ "events":
/*!*************************!*\
  !*** external "events" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("events");

/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ "import-in-the-middle":
/*!***************************************!*\
  !*** external "import-in-the-middle" ***!
  \***************************************/
/***/ ((module) => {

module.exports = require("import-in-the-middle");

/***/ }),

/***/ "module":
/*!*************************!*\
  !*** external "module" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("module");

/***/ }),

/***/ "node:async_hooks":
/*!***********************************!*\
  !*** external "node:async_hooks" ***!
  \***********************************/
/***/ ((module) => {

module.exports = require("node:async_hooks");

/***/ }),

/***/ "node:child_process":
/*!*************************************!*\
  !*** external "node:child_process" ***!
  \*************************************/
/***/ ((module) => {

module.exports = require("node:child_process");

/***/ }),

/***/ "node:diagnostics_channel":
/*!*******************************************!*\
  !*** external "node:diagnostics_channel" ***!
  \*******************************************/
/***/ ((module) => {

module.exports = require("node:diagnostics_channel");

/***/ }),

/***/ "node:events":
/*!******************************!*\
  !*** external "node:events" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("node:events");

/***/ }),

/***/ "node:fs":
/*!**************************!*\
  !*** external "node:fs" ***!
  \**************************/
/***/ ((module) => {

module.exports = require("node:fs");

/***/ }),

/***/ "node:http":
/*!****************************!*\
  !*** external "node:http" ***!
  \****************************/
/***/ ((module) => {

module.exports = require("node:http");

/***/ }),

/***/ "node:https":
/*!*****************************!*\
  !*** external "node:https" ***!
  \*****************************/
/***/ ((module) => {

module.exports = require("node:https");

/***/ }),

/***/ "node:inspector":
/*!*********************************!*\
  !*** external "node:inspector" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("node:inspector");

/***/ }),

/***/ "node:module":
/*!******************************!*\
  !*** external "node:module" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("node:module");

/***/ }),

/***/ "node:net":
/*!***************************!*\
  !*** external "node:net" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("node:net");

/***/ }),

/***/ "node:os":
/*!**************************!*\
  !*** external "node:os" ***!
  \**************************/
/***/ ((module) => {

module.exports = require("node:os");

/***/ }),

/***/ "node:path":
/*!****************************!*\
  !*** external "node:path" ***!
  \****************************/
/***/ ((module) => {

module.exports = require("node:path");

/***/ }),

/***/ "node:readline":
/*!********************************!*\
  !*** external "node:readline" ***!
  \********************************/
/***/ ((module) => {

module.exports = require("node:readline");

/***/ }),

/***/ "node:stream":
/*!******************************!*\
  !*** external "node:stream" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("node:stream");

/***/ }),

/***/ "node:tls":
/*!***************************!*\
  !*** external "node:tls" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("node:tls");

/***/ }),

/***/ "node:url":
/*!***************************!*\
  !*** external "node:url" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("node:url");

/***/ }),

/***/ "node:util":
/*!****************************!*\
  !*** external "node:util" ***!
  \****************************/
/***/ ((module) => {

module.exports = require("node:util");

/***/ }),

/***/ "node:worker_threads":
/*!**************************************!*\
  !*** external "node:worker_threads" ***!
  \**************************************/
/***/ ((module) => {

module.exports = require("node:worker_threads");

/***/ }),

/***/ "node:zlib":
/*!****************************!*\
  !*** external "node:zlib" ***!
  \****************************/
/***/ ((module) => {

module.exports = require("node:zlib");

/***/ }),

/***/ "os":
/*!*********************!*\
  !*** external "os" ***!
  \*********************/
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("path");

/***/ }),

/***/ "perf_hooks":
/*!*****************************!*\
  !*** external "perf_hooks" ***!
  \*****************************/
/***/ ((module) => {

module.exports = require("perf_hooks");

/***/ }),

/***/ "require-in-the-middle":
/*!****************************************!*\
  !*** external "require-in-the-middle" ***!
  \****************************************/
/***/ ((module) => {

module.exports = require("require-in-the-middle");

/***/ }),

/***/ "tty":
/*!**********************!*\
  !*** external "tty" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("tty");

/***/ }),

/***/ "url":
/*!**********************!*\
  !*** external "url" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("url");

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("util");

/***/ }),

/***/ "worker_threads":
/*!*********************************!*\
  !*** external "worker_threads" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("worker_threads");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("./webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = (__webpack_exec__("(instrument)/./src/instrumentation.ts"));
module.exports = __webpack_exports__;

})();