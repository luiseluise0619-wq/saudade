// eslint.config.js — flat config (ESLint v9+).
// Minimal: catches typos, undeclared globals, and shadowing. We do not
// enforce style — the codebase is hand-formatted and that is fine.
//
// Run:
//   npm run lint
//   npx eslint saudade-edition.js   # one file

'use strict';

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
            globals: {
                // Browser
                window: 'readonly', document: 'readonly', navigator: 'readonly',
                location: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly',
                fetch: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
                console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
                setInterval: 'readonly', clearInterval: 'readonly', requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly', AbortController: 'readonly', AbortSignal: 'readonly',
                Promise: 'readonly', Map: 'readonly', Set: 'readonly', WeakMap: 'readonly',
                WeakSet: 'readonly', JSON: 'readonly', Math: 'readonly', Date: 'readonly',
                Array: 'readonly', Object: 'readonly', String: 'readonly', Number: 'readonly',
                Boolean: 'readonly', RegExp: 'readonly', Symbol: 'readonly', Error: 'readonly',
                TypeError: 'readonly', RangeError: 'readonly', Intl: 'readonly',
                FormData: 'readonly', FileReader: 'readonly', Blob: 'readonly', File: 'readonly',
                ResizeObserver: 'readonly', IntersectionObserver: 'readonly',
                MutationObserver: 'readonly', requestIdleCallback: 'readonly',
                HTMLElement: 'readonly', Element: 'readonly', Node: 'readonly',
                Event: 'readonly', CustomEvent: 'readonly', KeyboardEvent: 'readonly',
                MouseEvent: 'readonly', Audio: 'readonly', Image: 'readonly',
                crypto: 'readonly', atob: 'readonly', btoa: 'readonly',
                // Service worker
                self: 'readonly', caches: 'readonly', Response: 'readonly', Request: 'readonly',
                Headers: 'readonly',
                // Additional browser globals
                history: 'readonly', matchMedia: 'readonly', alert: 'readonly',
                confirm: 'readonly', prompt: 'readonly', CSS: 'readonly',
                FontFace: 'readonly', NodeFilter: 'readonly', Notification: 'readonly',
                screen: 'readonly', performance: 'readonly', getComputedStyle: 'readonly',
                speechSynthesis: 'readonly', SpeechSynthesisUtterance: 'readonly',
                MediaRecorder: 'readonly', MediaSource: 'readonly',
                XMLHttpRequest: 'readonly', WebSocket: 'readonly', EventSource: 'readonly',
                DOMParser: 'readonly', XMLSerializer: 'readonly',
                Worker: 'readonly', SharedWorker: 'readonly',
                SVGElement: 'readonly',
                // Node (scripts/)
                require: 'readonly', module: 'readonly', exports: 'readonly',
                process: 'readonly', __dirname: 'readonly', __filename: 'readonly',
                Buffer: 'readonly', global: 'readonly', globalThis: 'readonly',
                queueMicrotask: 'readonly', structuredClone: 'readonly',
                TextDecoder: 'readonly', TextEncoder: 'readonly',
                Uint8Array: 'readonly', ArrayBuffer: 'readonly', DataView: 'readonly'
            }
        },
        rules: {
            'no-undef': 'error',
            'no-redeclare': 'error',
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrors: 'none'
            }],
            'no-unreachable': 'error',
            'no-dupe-keys': 'error',
            'no-dupe-args': 'error',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-constant-condition': ['warn', { checkLoops: false }],
            'no-self-assign': 'error',
            'no-cond-assign': ['error', 'except-parens'],
            'use-isnan': 'error',
            'valid-typeof': 'error'
        }
    },
    {
        // Worker uses `export default {...}` — ES module syntax.
        files: ['cloudflare-worker.js'],
        languageOptions: { sourceType: 'module' }
    }
];
