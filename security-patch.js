// ═══════════════════════════════════════════════════════════════════════════
//  Λ U R Λ : WORLD PULSE — SECURITY PATCH v1.0
//  Hardening: XSS, CSP, rate limit, cache cleanup, error tracking
//  © 2026 LEEJAEJIN (JADDY)
// ═══════════════════════════════════════════════════════════════════════════
//  이 파일은 optimize.js 직후에 로드됩니다.
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

(function() {
    // ── 1. 디버그 플래그 (프로덕션에서 로그 비활성화) ──────────────────────────
    const DEBUG = localStorage.getItem('aura_debug') === '1' ||
                  location.hostname === 'localhost' ||
                  location.hostname === '127.0.0.1' ||
                  location.protocol === 'file:';
    
    if (!DEBUG) {
        // 프로덕션: console 로그 모두 무력화 (에러는 유지)
        const noop = () => {};
        const origError = console.error.bind(console);
        Object.assign(console, {
            log: noop, info: noop, debug: noop, warn: noop,
            table: noop, group: noop, groupEnd: noop,
            error: origError  // 에러는 살려둠
        });
    }
    
    window.__DEBUG = DEBUG;

    // ── 2. HTML SANITIZER (innerHTML 대체) ─────────────────────────────────
    // DOMParser를 사용한 안전한 HTML 파싱
    window.__safeHTML = function(dirtyString, options = {}) {
        const allowedTags = options.tags || ['b', 'strong', 'i', 'em', 'br', 'span', 'div', 'p'];
        const allowedAttrs = options.attrs || ['class', 'style'];
        const maxLength = options.maxLength || 5000;
        
        const input = String(dirtyString || '').slice(0, maxLength);
        const doc = new DOMParser().parseFromString(input, 'text/html');
        const body = doc.body;
        
        function sanitizeNode(node) {
            if (node.nodeType === Node.TEXT_NODE) return node;
            if (node.nodeType !== Node.ELEMENT_NODE) { node.remove(); return null; }
            
            const tag = node.tagName.toLowerCase();
            
            // 허용 안 된 태그 → textContent만 유지
            if (!allowedTags.includes(tag)) {
                const text = document.createTextNode(node.textContent);
                node.replaceWith(text);
                return text;
            }
            
            // script, on* 이벤트 속성 제거
            [...node.attributes].forEach(attr => {
                const name = attr.name.toLowerCase();
                if (!allowedAttrs.includes(name) || name.startsWith('on')) {
                    node.removeAttribute(attr.name);
                } else if (name === 'style') {
                    // style 속성의 위험한 것 제거 (javascript:, expression 등)
                    const v = attr.value.toLowerCase();
                    if (v.includes('javascript:') || v.includes('expression(') || v.includes('@import')) {
                        node.removeAttribute('style');
                    }
                }
            });
            
            // 자식 노드 재귀
            [...node.childNodes].forEach(sanitizeNode);
            return node;
        }
        
        [...body.childNodes].forEach(sanitizeNode);
        return body.innerHTML;
    };

    // ── 3. SAFE textContent 도우미 (HTML 대신 구조체로) ────────────────────
    window.__el = function(tag, props = {}, children = []) {
        const node = document.createElement(tag);
        for (const [k, v] of Object.entries(props)) {
            if (v == null) continue;
            if (k === 'class' || k === 'className') node.className = v;
            else if (k === 'text' || k === 'textContent') node.textContent = v;
            else if (k === 'style' && typeof v === 'object') {
                for (const [sk, sv] of Object.entries(v)) node.style[sk] = sv;
            } else if (k.startsWith('on') && typeof v === 'function') {
                node.addEventListener(k.slice(2).toLowerCase(), v);
            } else if (k === 'dataset' && typeof v === 'object') {
                for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
            } else {
                node.setAttribute(k, String(v));
            }
        }
        if (!Array.isArray(children)) children = [children];
        for (const child of children) {
            if (child == null) continue;
            if (typeof child === 'string' || typeof child === 'number') {
                node.appendChild(document.createTextNode(String(child)));
            } else if (child instanceof Node) {
                node.appendChild(child);
            }
        }
        return node;
    };

    // ── 4. RATE LIMITER (F5 연타 방지) ─────────────────────────────────────
    const rateLimits = new Map();
    window.__rateLimit = function(key, windowMs = 1000, maxCalls = 3) {
        const now = Date.now();
        const entry = rateLimits.get(key) || { calls: [], blockedUntil: 0 };
        
        if (now < entry.blockedUntil) return false;
        
        entry.calls = entry.calls.filter(t => now - t < windowMs);
        if (entry.calls.length >= maxCalls) {
            entry.blockedUntil = now + windowMs * 2;
            rateLimits.set(key, entry);
            return false;
        }
        entry.calls.push(now);
        rateLimits.set(key, entry);
        return true;
    };

    // Refresh button rate limit 적용
    setTimeout(() => {
        const btn = document.getElementById('refreshBtn');
        if (btn && !btn.dataset.rateLimited) {
            btn.dataset.rateLimited = '1';
            const origClick = btn.onclick;
            btn.addEventListener('click', (e) => {
                if (!window.__rateLimit('refresh', 5000, 2)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    if (window.showToast) window.showToast(
                        window.state?.lang === 'ko' ? '잠시 후 다시 시도하세요' : 'Please wait a moment',
                        'warn', 2000
                    );
                    return false;
                }
            }, true);
        }
    }, 1500);

    // ── 5. FETCH CACHE CLEANUP (메모리 누수 방지) ──────────────────────────
    setInterval(() => {
        if (!window.__fetchCache) return;
        const now = Date.now();
        let removed = 0;
        for (const [k, v] of window.__fetchCache) {
            if (v.expiresAt < now) {
                window.__fetchCache.delete(k);
                removed++;
            }
        }
        if (removed > 0 && DEBUG) console.log(`[SEC] Cleaned ${removed} expired cache entries`);
    }, 60 * 1000);

    // ── 6. ERROR TRACKING ───────────────────────────────────────────────────
    window.__errors = [];
    const MAX_ERRORS = 50;
    
    window.addEventListener('error', (e) => {
        const err = {
            type: 'error',
            message: e.message?.slice(0, 200),
            source: e.filename?.split('/').pop(),
            line: e.lineno,
            time: Date.now()
        };
        window.__errors.push(err);
        if (window.__errors.length > MAX_ERRORS) window.__errors.shift();
        if (DEBUG) console.error('[AURA-ERR]', err);
    });
    
    window.addEventListener('unhandledrejection', (e) => {
        const err = {
            type: 'promise',
            message: String(e.reason).slice(0, 200),
            time: Date.now()
        };
        window.__errors.push(err);
        if (window.__errors.length > MAX_ERRORS) window.__errors.shift();
    });

    // ── 7. localStorage QUOTA HANDLER ──────────────────────────────────────
    window.__safeSetItem = function(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                // 가장 오래된 캐시 키 제거
                const deletableKeys = ['aura_wp_v50_translations', 'aura_wp_intel_notified'];
                for (const k of deletableKeys) {
                    try { localStorage.removeItem(k); } catch (e) { window.AURA?.dbgWarn?.("caught", e); }
                }
                try {
                    localStorage.setItem(key, value);
                    if (window.showToast) window.showToast(
                        window.state?.lang === 'ko' ? '저장 공간 정리됨' : 'Storage cleaned',
                        'warn', 2000
                    );
                    return true;
                } catch { return false; }
            }
            return false;
        }
    };

    // ── 8. 입력 검증 강화 (URL, 텍스트) ─────────────────────────────────────
    window.__validateInput = function(value, type = 'text', maxLen = 200) {
        if (value == null) return '';
        const str = String(value);
        
        switch (type) {
            case 'url':
                try {
                    const u = new URL(str.trim());
                    if (!/^https?:$/i.test(u.protocol)) return '#';
                    return u.href;
                } catch { return '#'; }
            
            case 'number':
                const n = Number(str);
                return Number.isFinite(n) ? n : 0;
            
            case 'text':
            default:
                return str
                    .replace(/[\u0000-\u001f\u007f]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, maxLen);
        }
    };

    // ── 9. CSP VIOLATION REPORTING ─────────────────────────────────────────
    document.addEventListener('securitypolicyviolation', (e) => {
        if (DEBUG) {
            if (window.__DEBUG) console.warn('[CSP]', {
                directive: e.violatedDirective,
                blocked: e.blockedURI,
                source: e.sourceFile
            });
        }
    });

    // ── 10. AUTO-LOCK (일정 시간 비활성 시 민감 데이터 숨김) ─────────────────
    let lastActivity = Date.now();
    const AUTO_LOCK_MS = 30 * 60 * 1000; // 30분

    ['mousemove', 'keypress', 'scroll', 'click', 'touchstart'].forEach(evt => {
        window.addEventListener(evt, () => { lastActivity = Date.now(); }, { passive: true });
    });

    setInterval(() => {
        const idle = Date.now() - lastActivity;
        const lockSetting = localStorage.getItem('aura_auto_lock') === '1';
        if (lockSetting && idle >= AUTO_LOCK_MS) {
            // 북마크 탭에 민감 정보가 있을 수 있으니 홈으로
            if (window.state && window.state.activeTab === 'bookmarks') {
                const newsTab = document.querySelector('.tab-btn[data-tab="news"]');
                if (newsTab) newsTab.click();
            }
        }
    }, 60 * 1000);

    // ── 11. 안전한 JSON 파싱 ──────────────────────────────────────────────
    window.__safeJson = function(str, fallback = null) {
        try {
            return JSON.parse(String(str));
        } catch {
            return fallback;
        }
    };

    // ── 12. XSS 패치: 기존 innerHTML 사용 부분 감시 ─────────────────────────
    // personalization 렌더링이 innerHTML 사용 → 오버라이드
    const waitForPersonalization = setInterval(() => {
        if (window.__renderPersonalization) {
            clearInterval(waitForPersonalization);
            
            const original = window.__renderPersonalization;
            window.__renderPersonalization = function() {
                const body = document.getElementById('personalizationBody');
                if (!body) return;
                
                const p = window.__personalization;
                if (!p) return;
                
                const events = p.totalEvents();
                const top = p.getTopInterests();
                const isKo = window.state?.lang === 'ko';
                
                // innerHTML 대신 __el 사용
                while (body.firstChild) body.removeChild(body.firstChild);
                
                if (events < 3) {
                    const hint = window.__el('div', { style: { color: 'var(--sub)' } }, [
                        isKo ? '아직 학습 데이터가 부족합니다.' : 'Not enough learning data yet.',
                        window.__el('br'),
                        isKo ? '기사를 클릭하고 북마크하면 자동으로 학습됩니다.' : 'Click articles and bookmark to train.',
                        window.__el('br'),
                        window.__el('br'),
                        window.__el('strong', {}, [isKo ? '학습된 이벤트: ' : 'Events: ']),
                        events.toFixed(0)
                    ]);
                    body.appendChild(hint);
                    return;
                }
                
                // 학습 이벤트 수
                body.appendChild(window.__el('div', { style: { marginBottom: '12px' } }, [
                    window.__el('strong', { style: { color: 'var(--accent)' } }, [
                        (isKo ? '학습된 이벤트' : 'Learned Events') + ': '
                    ]),
                    events.toFixed(0)
                ]));
                
                // 관심 국가
                if (top.countries.length) {
                    const wrap = window.__el('div', { style: { marginBottom: '10px' } }, [
                        window.__el('strong', {}, [(isKo ? '관심 국가' : 'Top Countries') + ':']),
                        window.__el('br')
                    ]);
                    top.countries.forEach(([code, score]) => {
                        const country = window.COUNTRIES?.find(x => x.code === code);
                        if (!country) return;
                        wrap.appendChild(window.__el('span', {
                            style: {
                                display: 'inline-block',
                                padding: '3px 9px',
                                margin: '2px',
                                borderRadius: '999px',
                                background: 'rgba(var(--accent-rgb),0.1)',
                                border: '1px solid rgba(var(--accent-rgb),0.3)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '10px'
                            },
                            text: `${country.flag} ${isKo ? country.ko : country.en} · ${score.toFixed(0)}`
                        }));
                    });
                    body.appendChild(wrap);
                }
                
                // 관심 카테고리
                if (top.categories.length) {
                    const wrap = window.__el('div', { style: { marginBottom: '10px' } }, [
                        window.__el('strong', {}, [(isKo ? '관심 카테고리' : 'Top Categories') + ':']),
                        window.__el('br')
                    ]);
                    top.categories.forEach(([cat, score]) => {
                        wrap.appendChild(window.__el('span', {
                            style: {
                                display: 'inline-block',
                                padding: '3px 9px',
                                margin: '2px',
                                borderRadius: '999px',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid var(--border)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '10px'
                            },
                            text: `${cat.toUpperCase()} · ${score.toFixed(0)}`
                        }));
                    });
                    body.appendChild(wrap);
                }
                
                // 키워드
                if (top.tokens.length) {
                    const wrap = window.__el('div', {}, [
                        window.__el('strong', {}, [(isKo ? '핵심 키워드' : 'Top Keywords') + ':']),
                        window.__el('br')
                    ]);
                    top.tokens.slice(0, 8).forEach(([tok, score]) => {
                        wrap.appendChild(window.__el('span', {
                            style: {
                                display: 'inline-block',
                                padding: '3px 9px',
                                margin: '2px',
                                borderRadius: '999px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid var(--border)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '10px',
                                color: 'var(--text-dim)'
                            },
                            text: `${tok} · ${score.toFixed(0)}`
                        }));
                    });
                    body.appendChild(wrap);
                }
                
                body.appendChild(window.__el('div', {
                    style: {
                        marginTop: '14px',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--border)',
                        fontSize: '10px',
                        color: 'var(--sub)'
                    },
                    text: isKo ? '✨ 이 데이터로 뉴스가 재정렬됩니다' : '✨ News re-ranked from this data'
                }));
            };
        }
    }, 300);

    setTimeout(() => clearInterval(waitForPersonalization), 10000);

    // ── 13. 외부 링크 안전 열기 ────────────────────────────────────────────
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;
        const href = link.getAttribute('href');
        if (!href || href === '#' || href.startsWith('#')) return;
        
        // 외부 링크 체크
        try {
            const url = new URL(href, location.href);
            if (url.origin !== location.origin) {
                // 보안: rel, target 강제
                if (link.target !== '_blank') link.target = '_blank';
                link.rel = 'noopener noreferrer nofollow';
                
                // http 링크 경고
                if (url.protocol === 'http:' && !DEBUG) {
                    if (!confirm(window.state?.lang === 'ko' 
                        ? '보안되지 않은 사이트입니다. 계속 열까요?'
                        : 'Unsecure site. Continue?')) {
                        e.preventDefault();
                    }
                }
            }
        } catch (e) { window.AURA?.dbgWarn?.("caught", e); }
    }, true);

    // ── 14. 상태 조회 API ──────────────────────────────────────────────────
    window.auraSecurity = function() {
        const stats = {
            debug: DEBUG,
            errors: window.__errors.length,
            recentErrors: window.__errors.slice(-5),
            rateLimits: rateLimits.size,
            fetchCacheSize: window.__fetchCache?.size || 0
        };
        console.table(stats);
        return stats;
    };

    if (DEBUG) console.log('[AURA] Security patch online');
})();
