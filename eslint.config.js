// eslint.config.js — flat config (ESLint v9+).
// Minimal correctness rules only — we do not enforce style on a
// hand-formatted vanilla-JS craft codebase. The point is to catch
// undeclared globals (the class of bug that ships as
// 'ReferenceError: foo is not defined' on first user) and parsing
// regressions, not to bikeshed brace placement.
//
// Run:  npm run lint
//       npx eslint saudade-edition.js   # one file

'use strict';

const browserGlobals = {
    window: 'readonly', document: 'readonly', navigator: 'readonly',
    location: 'readonly', history: 'readonly', screen: 'readonly',
    localStorage: 'readonly', sessionStorage: 'readonly',
    fetch: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
    console: 'readonly', performance: 'readonly',
    setTimeout: 'readonly', clearTimeout: 'readonly',
    setInterval: 'readonly', clearInterval: 'readonly',
    requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
    requestIdleCallback: 'readonly', queueMicrotask: 'readonly',
    matchMedia: 'readonly', getComputedStyle: 'readonly',
    alert: 'readonly', confirm: 'readonly', prompt: 'readonly',
    AbortController: 'readonly', AbortSignal: 'readonly',
    Promise: 'readonly', Map: 'readonly', Set: 'readonly',
    WeakMap: 'readonly', WeakSet: 'readonly', JSON: 'readonly',
    Math: 'readonly', Date: 'readonly', Array: 'readonly',
    Object: 'readonly', String: 'readonly', Number: 'readonly',
    Boolean: 'readonly', RegExp: 'readonly', Symbol: 'readonly',
    Error: 'readonly', TypeError: 'readonly', RangeError: 'readonly',
    Intl: 'readonly', BigInt: 'readonly',
    FormData: 'readonly', FileReader: 'readonly', Blob: 'readonly',
    File: 'readonly',
    ResizeObserver: 'readonly', IntersectionObserver: 'readonly',
    MutationObserver: 'readonly', PerformanceObserver: 'readonly',
    HTMLElement: 'readonly', Element: 'readonly', SVGElement: 'readonly',
    Node: 'readonly', NodeFilter: 'readonly', DocumentFragment: 'readonly',
    Event: 'readonly', CustomEvent: 'readonly',
    KeyboardEvent: 'readonly', MouseEvent: 'readonly', TouchEvent: 'readonly',
    PointerEvent: 'readonly', WheelEvent: 'readonly',
    Audio: 'readonly', Image: 'readonly', MediaError: 'readonly',
    MediaRecorder: 'readonly', MediaSource: 'readonly',
    XMLHttpRequest: 'readonly', WebSocket: 'readonly', EventSource: 'readonly',
    DOMParser: 'readonly', XMLSerializer: 'readonly',
    Worker: 'readonly', SharedWorker: 'readonly',
    crypto: 'readonly', atob: 'readonly', btoa: 'readonly',
    CSS: 'readonly', FontFace: 'readonly',
    Notification: 'readonly', speechSynthesis: 'readonly',
    SpeechSynthesisUtterance: 'readonly',
    addEventListener: 'readonly', removeEventListener: 'readonly',
    Uint8Array: 'readonly', Uint16Array: 'readonly', Uint32Array: 'readonly',
    Int8Array: 'readonly', Int16Array: 'readonly', Int32Array: 'readonly',
    Float32Array: 'readonly', Float64Array: 'readonly',
    ArrayBuffer: 'readonly', DataView: 'readonly',
    TextDecoder: 'readonly', TextEncoder: 'readonly',
    structuredClone: 'readonly', globalThis: 'readonly'
};

const swGlobals = {
    self: 'readonly', caches: 'readonly',
    Response: 'readonly', Request: 'readonly', Headers: 'readonly'
};

const nodeGlobals = {
    require: 'readonly', module: 'readonly', exports: 'readonly',
    process: 'readonly', __dirname: 'readonly', __filename: 'readonly',
    Buffer: 'readonly', global: 'readonly'
};

const correctness = {
    'no-undef':            'error',
    'no-redeclare':        'error',
    'no-unreachable':      'error',
    'no-dupe-keys':        'error',
    'no-dupe-args':        'error',
    'no-self-assign':      'error',
    'no-cond-assign':      ['error', 'except-parens'],
    'use-isnan':           'error',
    'valid-typeof':        'error',
    'no-empty':            ['warn', { allowEmptyCatch: true }],
    'no-constant-condition': ['warn', { checkLoops: false }],
    'no-unused-vars':      ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none'
    }]
};

module.exports = [
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'data/**',
            'audio/**',
            'photos/**',
            '.backups/**',
            'test-suite.html',
            'logo-preview.html'
        ]
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: { ...browserGlobals, ...swGlobals, ...nodeGlobals }
        },
        rules: correctness
    },
    {
        // Worker uses `export default {...}` — ES module syntax.
        files: ['cloudflare-worker.js'],
        languageOptions: { sourceType: 'module' }
    }
];
