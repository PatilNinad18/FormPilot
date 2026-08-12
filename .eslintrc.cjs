/**
 * ESLint configuration for FormPilot AI.
 *
 * Uses flat-discipline rules on top of ts-eslint + react to enforce the quality
 * bar expected of a production extension headed toward a commercial SaaS launch:
 * no floating TODOs, no unused symbols, exhaustive deps, and prettier parity.
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    // TS strictness
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/switch-exhaustiveness-check': 'error',

    // React
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // General hygiene
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': 'off',
    'no-constant-condition': ['error', { checkLoops: false }],
    eqeqeq: ['error', 'smart'],
    'no-var': 'error',
    'prefer-const': 'error',

    // Forbid leftover placeholders in production-grade code.
    'no-warning-comments': [
      'error',
      { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'anywhere' },
    ],
  },
  ignorePatterns: ['dist', 'node_modules', '*.config.js', '*.cjs', 'scripts/**'],
};
