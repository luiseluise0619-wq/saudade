// ═══════════════════════════════════════════════════════════════════════════
//  Λ U R Λ : WORLD PULSE — COMMON UTILITIES v1.0
//  공통 유틸 (안전한 JSON / fetch / 스토리지 / 리스너 / URL)
//  다른 모든 스크립트보다 먼저 로드되어야 함
//  © 2026 LEEJAEJIN (JADDY)
// ═══════════════════════════════════════════════════════════════════════════

(function(global) {
    'use strict';

    // 이미 로드됐으면 skip
    if (global.AURA && global.AURA.__version) return;

    const DEBUG = !!global.__DEBUG;

    // ─────────────────────────────────────────────────────────────
    //  1. Safe JSON
    // ─────────────────────────────────────────────────────────────
    function safeJsonParse(str, fallback) {
        if (fallback === undefined) fallback = null;
        if (str === null || str === undefined || str === '') return fallback;
        try {
            return JSON.parse(str);
        } catch (e) {
            if (DEBUG) console.warn('[AURA] JSON parse failed:', e.message);
            return fallback;
        }
    }

    function safeJsonStringify(obj, fallback) {
        if (fallback === undefined) fallback = '{}';
        try {
            return JSON.stringify(obj);
        } catch (e) {
            if (DEBUG) console.warn('[AURA] JSON stringify failed:', e.message);
            return fallback;
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  2. Safe Storage (localStorage with quota handling)
    // ─────────────────────────────────────────────────────────────
    const STORAGE_QUOTA_KEY = 'aura_storage_quota_hit';

    function safeStorageGet(key, fallback) {
        if (fallback === undefined) fallback = null;
        try {
            const v = global.localStorage.getItem(key);
            if (v === null) return fallback;
            return v;
        } catch (e) {
            if (DEBUG) console.warn('[AURA] storage read failed:', key);
            return fallback;
        }
    }

    function safeStorageGetJson(key, fallback) {
        const raw = safeStorageGet(key);
        if (raw === null || raw === undefined) return fallback;
        return safeJsonParse(raw, fallback);
    }

    function safeStorageSet(key, value) {
        try {
            const str = typeof value === 'string' ? value : safeJsonStringify(value);
            global.localStorage.setItem(key, str);
            return true;
        } catch (e) {
            // QuotaExceededError: 오래된 데이터 정리 시도
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                try {
                    // 오래된 캐시 먼저 제거
                    const toRemove = [];
                    for (let i = 0; i < global.localStorage.length; i++) {
                        const k = global.localStorage.key(i);
                        if (!k) continue;
                        if (k.startsWith('aura_events_cache') ||
                            k.startsWith('aura_translate') ||
                            k.startsWith('aura_crypto') ||
                            k.startsWith('aura_producthunt')) {
                            toRemove.push(k);
                        }
                    }
                    toRemove.forEach(k => {
                        try { global.localStorage.removeItem(k); } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
                    });
                    // 재시도
                    const str = typeof value === 'string' ? value : safeJsonStringify(value);
                    global.localStorage.setItem(key, str);
                    global.localStorage.setItem(STORAGE_QUOTA_KEY, String(Date.now()));
                    return true;
                } catch (e2) {
                    if (DEBUG) console.warn('[AURA] storage quota full, giving up:', key);
                    return false;
                }
            }
            if (DEBUG) console.warn('[AURA] storage write failed:', key, e.message);
            return false;
        }
    }

    function safeStorageRemove(key) {
        try {
            global.localStorage.removeItem(key);
            return true;
        } catch (e) { return false; }
    }

    // ─────────────────────────────────────────────────────────────
    //  3. Safe Fetch (timeout + abort)
    // ─────────────────────────────────────────────────────────────
    async function safeFetch(url, opts) {
        opts = opts || {};
        const timeout = opts.timeout || 8000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const res = await fetch(url, {
                ...opts,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return res;
        } catch (e) {
            clearTimeout(timeoutId);
            if (e.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw e;
        }
    }

    async function safeFetchJson(url, opts) {
        const res = await safeFetch(url, opts);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        return safeJsonParse(text, null);
    }

    async function safeFetchText(url, opts) {
        const res = await safeFetch(url, opts);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.text();
    }

    // ─────────────────────────────────────────────────────────────
    //  4. URL Safety
    // ─────────────────────────────────────────────────────────────
    function safeUrl(url) {
        if (!url || typeof url !== 'string') return null;
        try {
            const u = new URL(url);
            if (!/^https?:$/.test(u.protocol)) return null;
            return u.toString();
        } catch {
            return null;
        }
    }

    function openSafeUrl(url) {
        const safe = safeUrl(url);
        if (!safe) return false;
        global.open(safe, '_blank', 'noopener,noreferrer');
        return true;
    }

    // ─────────────────────────────────────────────────────────────
    //  5. Listener Registry (메모리 누수 방지)
    // ─────────────────────────────────────────────────────────────
    const listenerRegistry = new WeakMap();
    const globalListeners = []; // document/window 용

    function addListener(el, event, handler, opts) {
        if (!el) return;
        el.addEventListener(event, handler, opts);
        if (!listenerRegistry.has(el)) listenerRegistry.set(el, []);
        listenerRegistry.get(el).push({ event, handler, opts });
    }

    function addGlobalListener(target, event, handler, opts) {
        if (!target) return;
        target.addEventListener(event, handler, opts);
        globalListeners.push({ target, event, handler, opts });
    }

    function cleanupGlobalListeners() {
        globalListeners.forEach(({ target, event, handler, opts }) => {
            try { target.removeEventListener(event, handler, opts); } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
        });
        globalListeners.length = 0;
    }

    // ─────────────────────────────────────────────────────────────
    //  6. Timer Registry (setTimeout/setInterval 추적)
    // ─────────────────────────────────────────────────────────────
    const activeTimers = new Set();
    const activeIntervals = new Set();

    function safeTimeout(fn, delay) {
        const id = setTimeout(() => {
            activeTimers.delete(id);
            try { fn(); } catch (e) {
                if (DEBUG) console.error('[AURA] timer error:', e);
            }
        }, delay);
        activeTimers.add(id);
        return id;
    }

    function safeInterval(fn, interval) {
        const id = setInterval(() => {
            try { fn(); } catch (e) {
                if (DEBUG) console.error('[AURA] interval error:', e);
            }
        }, interval);
        activeIntervals.add(id);
        return id;
    }

    function clearSafeTimeout(id) {
        clearTimeout(id);
        activeTimers.delete(id);
    }

    function clearSafeInterval(id) {
        clearInterval(id);
        activeIntervals.delete(id);
    }

    function cleanupAllTimers() {
        activeTimers.forEach(id => clearTimeout(id));
        activeIntervals.forEach(id => clearInterval(id));
        activeTimers.clear();
        activeIntervals.clear();
    }

    // ─────────────────────────────────────────────────────────────
    //  7. DOM Helpers (XSS-safe)
    // ─────────────────────────────────────────────────────────────
    function createEl(tag, opts) {
        const el = document.createElement(tag);
        if (!opts) return el;
        if (opts.className) el.className = opts.className;
        if (opts.id) el.id = opts.id;
        if (opts.text !== undefined) el.textContent = String(opts.text);
        if (opts.title) el.title = opts.title;
        if (opts.type) el.type = opts.type;
        if (opts.ariaLabel) el.setAttribute('aria-label', opts.ariaLabel);
        if (opts.attrs) {
            Object.keys(opts.attrs).forEach(k => el.setAttribute(k, opts.attrs[k]));
        }
        if (opts.style) {
            Object.keys(opts.style).forEach(k => el.style[k] = opts.style[k]);
        }
        if (opts.children) {
            opts.children.forEach(c => {
                if (c) el.appendChild(c);
            });
        }
        if (opts.onClick) {
            addListener(el, 'click', opts.onClick);
        }
        return el;
    }

    function clearChildren(el) {
        if (!el) return;
        while (el.firstChild) el.removeChild(el.firstChild);
    }

    // ─────────────────────────────────────────────────────────────
    //  8. 디바운스 / 스로틀
    // ─────────────────────────────────────────────────────────────
    function debounce(fn, delay) {
        let tid = null;
        return function(...args) {
            if (tid) clearTimeout(tid);
            tid = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    function throttle(fn, interval) {
        let last = 0;
        let tid = null;
        return function(...args) {
            const now = Date.now();
            if (now - last >= interval) {
                last = now;
                fn.apply(this, args);
            } else {
                if (tid) clearTimeout(tid);
                tid = setTimeout(() => {
                    last = Date.now();
                    fn.apply(this, args);
                }, interval - (now - last));
            }
        };
    }

    // ─────────────────────────────────────────────────────────────
    //  9. 자동 정리 (페이지 언로드 시)
    // ─────────────────────────────────────────────────────────────
    addGlobalListener(global, 'beforeunload', () => {
        cleanupAllTimers();
        cleanupGlobalListeners();
    });

    // ─────────────────────────────────────────────────────────────
    //  Logging + retry helpers (이전엔 빈 catch {}와 setTimeout 재시도 패턴이 흩어져 있었음)
    // ─────────────────────────────────────────────────────────────
    function dbgWarn(label, err) {
        if (!err) return;
        if (DEBUG) console.warn('[AURA]', label, err && err.message ? err.message : err);
    }
    // 조건이 충족될 때까지 폴링 (setTimeout 재시도 코드 통합용)
    // condition: 조건 함수 (true 반환 시 onReady 호출)
    // onReady:   조건 충족 시 1회 호출
    // opts.maxAttempts (기본 15) / opts.delay (기본 800ms) / opts.label (디버그용)
    function waitFor(condition, onReady, opts) {
        opts = opts || {};
        const maxAttempts = opts.maxAttempts || 15;
        const delay = opts.delay || 800;
        let attempt = 0;
        function tick() {
            try {
                if (condition()) { onReady(); return; }
            } catch (e) { dbgWarn(opts.label || 'waitFor cond', e); }
            attempt++;
            if (attempt < maxAttempts) safeTimeout(tick, delay);
            else if (opts.onTimeout) try { opts.onTimeout(); } catch (e) { dbgWarn('waitFor timeout cb', e); }
        }
        tick();
    }
    // localStorage quota 안전 setter — 가득 차면 오래된 캐시 키부터 제거 후 재시도
    const PRUNABLE_PREFIXES = ['aura_pexels_cache_', 'aura_cat_gif_cache_', 'aura_translate_cache_', 'aura_rss_cache_'];
    function pruneStorage() {
        try {
            const keys = Object.keys(localStorage);
            // 가장 오래된 cache prefix들 먼저 제거
            for (const prefix of PRUNABLE_PREFIXES) {
                const matches = keys.filter(k => k.startsWith(prefix));
                if (matches.length > 1) {
                    // 가장 낮은 버전 1개 제거
                    matches.sort();
                    localStorage.removeItem(matches[0]);
                    return true;
                }
            }
            // 그래도 빈 자리 없으면 가장 큰 캐시 1개 제거
            let biggest = null, biggestLen = 0;
            for (const k of keys) {
                if (PRUNABLE_PREFIXES.some(p => k.startsWith(p))) {
                    const len = (localStorage.getItem(k) || '').length;
                    if (len > biggestLen) { biggestLen = len; biggest = k; }
                }
            }
            if (biggest) { localStorage.removeItem(biggest); return true; }
        } catch (e) { dbgWarn('pruneStorage', e); }
        return false;
    }
    function safeStorageSetGuarded(key, value) {
        if (typeof value !== 'string') value = safeJsonStringify(value);
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            // QuotaExceededError → 한 번만 prune 후 재시도
            if (e && /quota/i.test(e.name + e.message)) {
                if (pruneStorage()) {
                    try { localStorage.setItem(key, value); return true; }
                    catch (e2) { dbgWarn('safeStorageSetGuarded retry', e2); }
                }
            } else {
                dbgWarn('safeStorageSetGuarded', e);
            }
            return false;
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  Export
    // ─────────────────────────────────────────────────────────────
    global.AURA = {
        __version: '1.1',
        dbgWarn,
        waitFor,
        pruneStorage,
        safeStorageSetGuarded,
        safeJsonParse,
        safeJsonStringify,
        safeStorageGet,
        safeStorageGetJson,
        safeStorageSet,
        safeStorageRemove,
        safeFetch,
        safeFetchJson,
        safeFetchText,
        safeUrl,
        openSafeUrl,
        addListener,
        addGlobalListener,
        cleanupGlobalListeners,
        safeTimeout,
        safeInterval,
        clearSafeTimeout,
        clearSafeInterval,
        cleanupAllTimers,
        createEl,
        clearChildren,
        debounce,
        throttle
    };

    if (DEBUG) console.log('[AURA] common utilities loaded v1.0');
})(window);
