// The app is ES5 scripts for the TV's Chromium 79, with no build step and no dependencies, so the rules are listed
// here rather than pulled from @eslint/js. Run with: npx --yes eslint@9 app
module.exports = [
  {
    files: ['app/*.js'],
    languageOptions: {
      ecmaVersion: 5,
      sourceType: 'script',
      globals: {
        window: 'readonly', document: 'readonly', location: 'readonly', navigator: 'readonly', console: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
        requestAnimationFrame: 'readonly', WebSocket: 'readonly', Image: 'readonly', Promise: 'readonly',
        Intl: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-shadow': ['error', { builtinGlobals: false }],
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-cond-assign': ['error', 'except-parens'],
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-func-assign': 'error',
      'no-inner-declarations': 'off',
      'no-sparse-arrays': 'error',
      'no-unexpected-multiline': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
];
