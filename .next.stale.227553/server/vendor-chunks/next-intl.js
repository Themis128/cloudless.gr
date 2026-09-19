"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/next-intl";
exports.ids = ["vendor-chunks/next-intl"];
exports.modules = {

/***/ "(rsc)/./node_modules/next-intl/dist/esm/development/routing/defineRouting.js":
/*!******************************************************************************!*\
  !*** ./node_modules/next-intl/dist/esm/development/routing/defineRouting.js ***!
  \******************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ defineRouting)\n/* harmony export */ });\nfunction defineRouting(config) {\n  if (config.domains) {\n    validateUniqueLocalesPerDomain(config.domains);\n  }\n  return config;\n}\nfunction validateUniqueLocalesPerDomain(domains) {\n  const domainsByLocale = new Map();\n  for (const {\n    domain,\n    locales\n  } of domains) {\n    for (const locale of locales) {\n      const localeDomains = domainsByLocale.get(locale) || new Set();\n      localeDomains.add(domain);\n      domainsByLocale.set(locale, localeDomains);\n    }\n  }\n  const duplicateLocaleMessages = Array.from(domainsByLocale.entries()).filter(([, localeDomains]) => localeDomains.size > 1).map(([locale, localeDomains]) => `- \"${locale}\" is used by: ${Array.from(localeDomains).join(', ')}`);\n  if (duplicateLocaleMessages.length > 0) {\n    console.warn('Locales are expected to be unique per domain, but found overlap:\\n' + duplicateLocaleMessages.join('\\n') + '\\nPlease see https://next-intl.dev/docs/routing/configuration#domains');\n  }\n}\n\n\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC1pbnRsL2Rpc3QvZXNtL2RldmVsb3BtZW50L3JvdXRpbmcvZGVmaW5lUm91dGluZy5qcyIsIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUk7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxxS0FBcUssT0FBTyxnQkFBZ0IscUNBQXFDO0FBQ2pPO0FBQ0E7QUFDQTtBQUNBOztBQUVvQyIsInNvdXJjZXMiOlsiL3dvcmtzcGFjZS9ub2RlX21vZHVsZXMvbmV4dC1pbnRsL2Rpc3QvZXNtL2RldmVsb3BtZW50L3JvdXRpbmcvZGVmaW5lUm91dGluZy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJmdW5jdGlvbiBkZWZpbmVSb3V0aW5nKGNvbmZpZykge1xuICBpZiAoY29uZmlnLmRvbWFpbnMpIHtcbiAgICB2YWxpZGF0ZVVuaXF1ZUxvY2FsZXNQZXJEb21haW4oY29uZmlnLmRvbWFpbnMpO1xuICB9XG4gIHJldHVybiBjb25maWc7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZVVuaXF1ZUxvY2FsZXNQZXJEb21haW4oZG9tYWlucykge1xuICBjb25zdCBkb21haW5zQnlMb2NhbGUgPSBuZXcgTWFwKCk7XG4gIGZvciAoY29uc3Qge1xuICAgIGRvbWFpbixcbiAgICBsb2NhbGVzXG4gIH0gb2YgZG9tYWlucykge1xuICAgIGZvciAoY29uc3QgbG9jYWxlIG9mIGxvY2FsZXMpIHtcbiAgICAgIGNvbnN0IGxvY2FsZURvbWFpbnMgPSBkb21haW5zQnlMb2NhbGUuZ2V0KGxvY2FsZSkgfHwgbmV3IFNldCgpO1xuICAgICAgbG9jYWxlRG9tYWlucy5hZGQoZG9tYWluKTtcbiAgICAgIGRvbWFpbnNCeUxvY2FsZS5zZXQobG9jYWxlLCBsb2NhbGVEb21haW5zKTtcbiAgICB9XG4gIH1cbiAgY29uc3QgZHVwbGljYXRlTG9jYWxlTWVzc2FnZXMgPSBBcnJheS5mcm9tKGRvbWFpbnNCeUxvY2FsZS5lbnRyaWVzKCkpLmZpbHRlcigoWywgbG9jYWxlRG9tYWluc10pID0+IGxvY2FsZURvbWFpbnMuc2l6ZSA+IDEpLm1hcCgoW2xvY2FsZSwgbG9jYWxlRG9tYWluc10pID0+IGAtIFwiJHtsb2NhbGV9XCIgaXMgdXNlZCBieTogJHtBcnJheS5mcm9tKGxvY2FsZURvbWFpbnMpLmpvaW4oJywgJyl9YCk7XG4gIGlmIChkdXBsaWNhdGVMb2NhbGVNZXNzYWdlcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc29sZS53YXJuKCdMb2NhbGVzIGFyZSBleHBlY3RlZCB0byBiZSB1bmlxdWUgcGVyIGRvbWFpbiwgYnV0IGZvdW5kIG92ZXJsYXA6XFxuJyArIGR1cGxpY2F0ZUxvY2FsZU1lc3NhZ2VzLmpvaW4oJ1xcbicpICsgJ1xcblBsZWFzZSBzZWUgaHR0cHM6Ly9uZXh0LWludGwuZGV2L2RvY3Mvcm91dGluZy9jb25maWd1cmF0aW9uI2RvbWFpbnMnKTtcbiAgfVxufVxuXG5leHBvcnQgeyBkZWZpbmVSb3V0aW5nIGFzIGRlZmF1bHQgfTtcbiJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next-intl/dist/esm/development/routing/defineRouting.js\n");

/***/ })

};
;