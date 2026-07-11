// SAUDADE · billing — Stripe Checkout + Customer Portal client.
//
// Wires support.html's "Subscribe" / "Patron" buttons to the worker's
// /billing/checkout endpoint, which returns a Stripe Checkout URL.
// Also exposes window.SAUDADE_BILLING for tier-aware UI elsewhere.
//
// Free / Patron / Subscriber tiers — see schema/subscriptions.sql and
// the billing handlers in cloudflare-worker.js.
//
// No Stripe.js loaded — we redirect to Stripe-hosted Checkout.
'use strict';

// IIFE — 로드 즉시 실행. Stripe 결제(Checkout/Portal) 연동 + 티어 인식 UI 모듈.
(function () {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_BILLING) return;

    // ORIGIN — Worker(백엔드) 주소. 전역 AURA_SERVER 가 있으면 그것, 없으면 프로덕션 기본값.
    // Default to the production worker; bootstrap.js or page can override.
    const ORIGIN = (typeof window.AURA_SERVER === 'string' && window.AURA_SERVER) ||
                   'https://saudade.absbjj1230.workers.dev';

    // getUser — localStorage 의 로그인 사용자 정보를 읽는다(없거나 깨지면 null).
    function getUser() {
        try {
            const raw = localStorage.getItem('saudade.auth.user');
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    // getTier — 현재 사용자 티어(free/patron/subscriber). 미로그인은 free.
    function getTier() {
        const u = getUser();
        return (u && u.tier) || 'free';
    }

    // postJson — Worker 에 JSON POST(로그인 시 Authorization 헤더 포함). 응답을 표준화해 반환.
    async function postJson(path, body, opts) {
        opts = opts || {};
        const u = getUser();
        const headers = { 'Content-Type': 'application/json' };
        if (u && u.id) headers.Authorization = 'Bearer ' + u.id;
        const res = await fetch(ORIGIN + path, {
            method: 'POST', headers, body: JSON.stringify(body || {})
        });
        let j = null;
        try { j = await res.json(); } catch (e) {}
        return { ok: res.ok, status: res.status, body: j };
    }

    // startCheckout — 결제 시작. 미로그인이면 먼저 로그인 유도, 아니면 Stripe Checkout 으로 리다이렉트.
    async function startCheckout(plan) {
        plan = plan || 'subscriber';
        const u = getUser();
        if (!u) {
            // not signed in — open auth modal first, then continue
            if (window.SAUDADE_AUTH && window.SAUDADE_AUTH.openModal) {
                window.SAUDADE_AUTH.openModal();
                return { ok: false, status: 401, reason: 'sign-in-required' };
            }
            alert('Sign in first to subscribe — magic link, no password.');
            return { ok: false, status: 401, reason: 'sign-in-required' };
        }
        // POST /billing/checkout — Stripe 결제 페이지 URL 을 받아 이동.
        const r = await postJson('/billing/checkout', { plan });
        if (r.ok && r.body && r.body.url) {
            window.location.href = r.body.url;
            return { ok: true };
        }
        // Billing is dormant — worker returns 410 GONE_FREE_MODE on
        // checkout/portal until Stripe is wired. 503 is the older signal
        // for the same state (Stripe not configured). Both surface the
        // same friendly message — the default "Checkout failed." or the
        // raw "GONE_FREE_MODE" code would confuse a reader who just
        // clicked Subscribe on the support page.
        if (r.status === 410 || r.status === 503) {
            alert('Subscriptions are not yet open. The patron link on the support page works today.');
            return { ok: false, status: r.status };
        }
        const msg = (r.body && r.body.error) || 'Checkout failed.';
        alert(msg);
        return { ok: false, status: r.status };
    }

    // openPortal — Stripe 고객 포털(구독 관리)로 이동(로그인 필요).
    async function openPortal() {
        const u = getUser();
        if (!u) return { ok: false, reason: 'sign-in-required' };
        // POST /billing/portal — 포털 URL 을 받아 이동.
        const r = await postJson('/billing/portal', {});
        if (r.ok && r.body && r.body.url) {
            window.location.href = r.body.url;
            return { ok: true };
        }
        // Same dormant-billing handling as startCheckout — friendly message
        // instead of "Could not open billing portal." on the 410/503 path.
        if (r.status === 410 || r.status === 503) {
            alert('Subscriptions are not yet open — no billing portal to show. The patron link on the support page works today.');
            return { ok: false, status: r.status };
        }
        alert((r.body && r.body.error) || 'Could not open billing portal.');
        return { ok: false };
    }

    // refreshTier — 서버(진실원)에서 현재 티어를 받아 로컬 사용자/화면 속성을 갱신.
    async function refreshTier() {
        // Pull tier from the worker (source of truth) and update local copy.
        try {
            const u = getUser();
            const headers = u && u.id ? { Authorization: 'Bearer ' + u.id } : {};
            const res = await fetch(ORIGIN + '/billing/me', { headers });
            const j = await res.json();
            if (j && j.ok && j.signed_in && u) {
                u.tier = j.tier || 'free';
                localStorage.setItem('saudade.auth.user', JSON.stringify(u));
                document.body.setAttribute('data-tier', u.tier);
            } else {
                document.body.setAttribute('data-tier', 'free');
            }
            return j;
        } catch (e) { return null; }
    }

    // applyTierVisibility — data-tier-show 속성의 티어 목록에 현재 티어가 있으면 보이고 아니면 숨김.
    function applyTierVisibility() {
        // Elements with data-tier-show="free patron" appear only when the
        // current tier matches one of the listed values. Re-run on tier change.
        const tier = getTier();
        document.querySelectorAll('[data-tier-show]').forEach(el => {
            const wanted = (el.getAttribute('data-tier-show') || '').split(/\s+/);
            const visible = wanted.includes(tier);
            el.style.display = visible ? '' : 'none';
        });
    }

    // init — 시동: 티어 속성 세팅 + 결제 버튼 배선 + 섹션 변화 시 재적용 + 성공 리다이렉트 처리.
    function init() {
        document.body.setAttribute('data-tier', getTier());
        applyTierVisibility();

        // support.html — buttons opt in via data-saudade-checkout="subscriber" or "patron".
        document.querySelectorAll('[data-saudade-checkout]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const plan = btn.getAttribute('data-saudade-checkout') || 'subscriber';
                startCheckout(plan);
            });
        });

        // Re-apply tier-visibility when sections re-render (mutation observer).
        const mo = new MutationObserver(() => applyTierVisibility());
        mo.observe(document.body, { childList: true, subtree: true });

        // 결제 성공 후 ?subscribed=1 로 돌아오면 티어를 새로고침.
        // ?subscribed=1 success redirect — refresh tier.
        if (/[?&]subscribed=1\b/.test(window.location.search)) {
            refreshTier();
        }
    }

    // 문서 로딩 중이면 DOMContentLoaded 후, 아니면 즉시 시동.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 전역 공개 API — 티어 조회 + 결제/포털 + 티어 갱신/가시성.
    window.SAUDADE_BILLING = {
        getTier, getUser, startCheckout, openPortal, refreshTier, applyTierVisibility
    };
})();
