// TS 7 enables noUncheckedSideEffectImports by default — bare `import "./x.css"`
// needs a wildcard ambient declaration (bundler handles the actual asset).
declare module "*.css";
