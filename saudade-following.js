// SAUDADE · v8 §02 — 사용자 도시 선택 Dispatches (Following 3)
//
// v7 의 정착+주변 자동 매핑 → 사용자 직접 3개 도시 선택 모델로 전환.
// API:
//   window.SAUDADE_FOLLOWING.list()              → ['lisbon', 'tokyo', 'berlin']
//   window.SAUDADE_FOLLOWING.set([slug,slug,slug]) → save (max 3)
//   window.SAUDADE_FOLLOWING.applyPairing(id)    → apply popular pairing
//   window.SAUDADE_FOLLOWING.pool()              → city-pool.json cities[]
//   window.SAUDADE_FOLLOWING.pairings()          → city-pool.json popular_pairings
//   window.SAUDADE_FOLLOWING.cityName(slug, ed?) → localized display name
//   window.SAUDADE_FOLLOWING.subscribe(fn)       → fn(list) on change
//
// 저장: localStorage (saudade.following.cities = ["slug","slug","slug"]).
// D1 sync: optional via worker /following endpoint (RFP: M2 ready, deferred).
//
// 마이그레이션: 기존 SAUDADE_CITY.persistentHomeCity() 가 정착 도시 → 첫 슬롯
// 자동 채움. position 2,3 은 비워두고 사용자가 직접 추가.

'use strict';

(function() {
    if (window.SAUDADE_FOLLOWING) return;

    const KEY = 'saudade.following.cities';
    const SUB = new Set();
    let _pool = null;            // city-pool.json (lazy)
    let _poolPromise = null;

    function loadPool() {
        if (_pool) return Promise.resolve(_pool);
        if (_poolPromise) return _poolPromise;
        _poolPromise = fetch('./data/city-pool.json', { cache: 'force-cache' })
            .then(r => r.ok ? r.json() : null)
            .then(j => { _pool = j || { cities: [], popular_pairings: [] }; return _pool; })
            .catch(() => { _pool = { cities: [], popular_pairings: [] }; return _pool; });
        return _poolPromise;
    }

    function readList() {
        try {
            const raw = localStorage.getItem(KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr.filter(s => typeof s === 'string').slice(0, 3) : [];
        } catch (e) { return []; }
    }
    function writeList(arr) {
        const sanitized = (arr || []).filter(s => typeof s === 'string').slice(0, 3);
        try { localStorage.setItem(KEY, JSON.stringify(sanitized)); } catch (e) {}
        // worker fire-and-forget (D1 sync)
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        const user = window.SAUDADE_AUTH?.getUser?.();
        if (base && user && user.id) {
            fetch(base + '/following', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, cities: sanitized }),
                credentials: 'omit'
            }).catch(() => {});
        }
        SUB.forEach(fn => { try { fn(sanitized); } catch (e) {} });
        return sanitized;
    }

    function list() { return readList(); }
    function set(arr) { return writeList(arr); }
    function add(slug) {
        const cur = readList();
        if (cur.includes(slug)) return cur;
        if (cur.length >= 3) cur.shift();   // FIFO — 가장 오래된 빠짐
        cur.push(slug);
        return writeList(cur);
    }
    function remove(slug) {
        return writeList(readList().filter(s => s !== slug));
    }
    function setSlot(position, slug) {
        const cur = readList();
        while (cur.length < 3) cur.push(null);
        cur[position - 1] = slug;
        return writeList(cur.filter(Boolean));
    }
    function applyPairing(id) {
        if (!_pool) return;
        const p = (_pool.popular_pairings || []).find(x => x.id === id);
        if (p) writeList(p.cities.slice(0, 3));
    }
    function pool() { return _pool ? _pool.cities : []; }
    function pairings() { return _pool ? _pool.popular_pairings : []; }
    function cityName(slug, ed) {
        const e = ed || (window.SAUDADE_EDITION?.get?.() || 'en');
        const c = (_pool?.cities || []).find(x => x.slug === slug);
        return c?.names?.[e] || c?.names?.en || slug;
    }
    function pairingLabel(p, ed) {
        const e = ed || (window.SAUDADE_EDITION?.get?.() || 'en');
        return p?.label?.[e] || p?.label?.en || p?.id || '';
    }
    function subscribe(fn) { SUB.add(fn); return () => SUB.delete(fn); }

    // 마이그레이션: 첫 진입 시 정착 도시가 있고 Following 비었으면 자동 채움.
    function autoMigrate() {
        const cur = readList();
        if (cur.length > 0) return;
        const home = window.SAUDADE_CITY?.persistentHomeCity?.();
        if (!home) return;
        // home 이름 → slug 매칭
        const slug = String(home).toLowerCase().replace(/\s+/g, '-');
        if ((_pool?.cities || []).some(c => c.slug === slug)) {
            writeList([slug]);
        }
    }

    function init() {
        loadPool().then(() => autoMigrate());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_FOLLOWING = {
        list, set, add, remove, setSlot, applyPairing,
        pool, pairings, cityName, pairingLabel, subscribe,
        loadPool
    };
})();
