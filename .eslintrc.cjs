/* ESLint config for Cloudflare Workers + ES Modules */
module.exports = {
  root: true,
  env: {
    es2022: true,
    browser: true,   // Cloudflare Workers use browser-like globals (fetch, Request, Response)
    worker: true,    // Service Worker API globals
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  extends: [
    "eslint:recommended"
  ],
  rules: {
    // === Required rules (from your prompt) ===
    "no-unused-vars": ["warn", { 
      "varsIgnorePattern": "^_", 
      "argsIgnorePattern": "^_" 
    }],
    "no-undef": "warn",
    "consistent-return": "warn",

    // === Keep noise low ===
    "no-console": "off"
  }
};