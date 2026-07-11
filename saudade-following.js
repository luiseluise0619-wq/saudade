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

// IIFE — 로드 즉시 실행. 사용자가 직접 고른 최대 3개 도시(Following)를 관리하는 모듈.
(function() {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_FOLLOWING) return;

    // KEY: 저장 키. SUB: 변경 구독자 집합. _pool: city-pool.json 캐시(지연 로드).
    const KEY = 'saudade.following.cities';
    const SUB = new Set();
    let _pool = null;            // city-pool.json (lazy)
    let _poolPromise = null;

    // loadPool — 도시 풀 JSON 을 한 번만 로드해 캐시(force-cache, 실패 시 빈 풀).
    function loadPool() {
        if (_pool) return Promise.resolve(_pool);
        if (_poolPromise) return _poolPromise;
        _poolPromise = fetch('./data/city-pool.json', { cache: 'force-cache' })
            .then(r => r.ok ? r.json() : null)
            .then(j => { _pool = j || { cities: [], popular_pairings: [] }; return _pool; })
            .catch(() => { _pool = { cities: [], popular_pairings: [] }; return _pool; });
        return _poolPromise;
    }

    // readList — 저장된 팔로잉 도시 배열을 읽는다(문자열만, 최대 3개).
    function readList() {
        try {
            const raw = localStorage.getItem(KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr.filter(s => typeof s === 'string').slice(0, 3) : [];
        } catch (e) { return []; }
    }
    // writeList — 목록을 저장하고, 로그인 상태면 Worker(D1)에 동기화, 구독자에게 알린다.
    function writeList(arr) {
        const sanitized = (arr || []).filter(s => typeof s === 'string').slice(0, 3);
        try { localStorage.setItem(KEY, JSON.stringify(sanitized)); } catch (e) {}
        // worker fire-and-forget (D1 sync)
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        const user = window.SAUDADE_AUTH?.getUser?.();
        // PUT /following — 로그인 사용자의 도시 목록을 서버에 저장(실패해도 무시).
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

    // list/set — 목록 읽기/통째로 저장.
    function list() { return readList(); }
    function set(arr) { return writeList(arr); }
    // add — 도시 추가(중복 무시, 3개 넘으면 가장 오래된 것을 뺀다 FIFO).
    function add(slug) {
        const cur = readList();
        if (cur.includes(slug)) return cur;
        if (cur.length >= 3) cur.shift();   // FIFO — 가장 오래된 빠짐
        cur.push(slug);
        return writeList(cur);
    }
    // remove — 특정 도시를 목록에서 제거.
    function remove(slug) {
        return writeList(readList().filter(s => s !== slug));
    }
    // setSlot — 1~3번 특정 슬롯에 도시를 지정(빈 슬롯은 정리).
    function setSlot(position, slug) {
        const cur = readList();
        while (cur.length < 3) cur.push(null);
        cur[position - 1] = slug;
        return writeList(cur.filter(Boolean));
    }
    // applyPairing — 미리 정의된 인기 도시 조합(id)을 통째로 적용.
    function applyPairing(id) {
        if (!_pool) return;
        const p = (_pool.popular_pairings || []).find(x => x.id === id);
        if (p) writeList(p.cities.slice(0, 3));
    }
    // pool/pairings — 선택 가능한 도시 목록 / 인기 조합 목록.
    function pool() { return _pool ? _pool.cities : []; }
    function pairings() { return _pool ? _pool.popular_pairings : []; }
    // cityName — slug 를 현재 언어 도시명으로(없으면 영어, 그마저 없으면 slug).
    function cityName(slug, ed) {
        const e = ed || (window.SAUDADE_EDITION?.get?.() || 'en');
        const c = (_pool?.cities || []).find(x => x.slug === slug);
        return c?.names?.[e] || c?.names?.en || slug;
    }
    // pairingLabel — 인기 조합의 현재 언어 라벨.
    function pairingLabel(p, ed) {
        const e = ed || (window.SAUDADE_EDITION?.get?.() || 'en');
        return p?.label?.[e] || p?.label?.en || p?.id || '';
    }
    // subscribe — 목록 변경 콜백을 등록(반환값 호출 시 해제).
    function subscribe(fn) { SUB.add(fn); return () => SUB.delete(fn); }

    // autoMigrate — 첫 진입 시 목록이 비었고 정착 도시가 있으면 첫 슬롯에 자동 채움.
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

    // v8 §02 — 다른 기기 동기화. signed-in + localStorage 비었으면 worker 에서 pull.
    // 서버가 새 디바이스 진실원: localStorage 비어있을 때만 덮어씀 (사용자 최근 변경 보존).
    // pullFromWorker — 로그인 + 로컬이 비어 있을 때만 서버에서 목록을 당겨온다(로컬 우선).
    function pullFromWorker() {
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        const user = window.SAUDADE_AUTH?.getUser?.();
        if (!base || !user || !user.id) return Promise.resolve(null);
        const cur = readList();
        if (cur.length > 0) return Promise.resolve(cur);   // 로컬 우선
        // GET /following — 다른 기기에서 저장한 목록을 조회.
        return fetch(base + '/following?user_id=' + encodeURIComponent(user.id), {
            cache: 'no-cache', credentials: 'omit'
        })
        .then(r => r.ok ? r.json() : null)
        .then(j => {
            if (j && Array.isArray(j.cities) && j.cities.length) {
                // 직접 localStorage 만 쓰고 SUB notify (writeList 가 다시 PUT 하지 않게)
                const sanitized = j.cities.filter(s => typeof s === 'string').slice(0, 3);
                try { localStorage.setItem(KEY, JSON.stringify(sanitized)); } catch (e) {}
                SUB.forEach(fn => { try { fn(sanitized); } catch (e) {} });
                return sanitized;
            }
            return cur;
        })
        .catch(() => cur);
    }

    // init — 도시 풀 로드 → 서버 동기화 시도 → 그래도 비면 정착 도시로 마이그레이션.
    function init() {
        loadPool().then(() => {
            // 우선 worker pull (signed-in 다른 기기 동기화)
            pullFromWorker().then(() => {
                // 그래도 비어있으면 home city 로 마이그레이션
                autoMigrate();
            });
        });
    }

    // 문서 로딩 중이면 DOMContentLoaded 후, 아니면 즉시 시동.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 전역 공개 API — 목록 관리 + 도시 풀/조합 + 이름 변환 + 구독.
    window.SAUDADE_FOLLOWING = {
        list, set, add, remove, setSlot, applyPairing,
        pool, pairings, cityName, pairingLabel, subscribe,
        loadPool
    };
})();
