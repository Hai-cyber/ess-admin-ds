/* ESLint config for Cloudflare Workers + ES Modules */
module.exports = {
  root: true,
  ignorePatterns: ['node_modules/', '.wrangler/', 'coverage/', 'dist/'],
  env: {
    es2022: true,
    browser: true,   // Cloudflare Workers use browser-like globals (fetch, Request, Response)
    worker: true,    // Service Worker API globals
    node: true,
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
      "argsIgnorePattern": "^_",
      "ignoreRestSiblings": true
    }],
    "no-undef": "warn",
    "consistent-return": "warn",

    // === Keep noise low ===
    "no-console": "off"
  }
};