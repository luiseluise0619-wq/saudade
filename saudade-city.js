// SAUDADE · CITY SYSTEM (Handoff v6 §5)
// 정착 도시 (home city) + 주변 도시 (adjacent) 시스템.
// data/city-definitions.json — 편집부 정의 (사용자 변경 X).
// localStorage:
//   saudade.home.city                — 사용자가 선택한 정착 도시
//   saudade.desk.switch              — 임시 모드 { from, to, returns_at } (3일)
//   saudade.city.requests            — 정의 안 된 도시 요청 누적 (100명 → 다음 분기)
'use strict';

// IIFE — 로드 즉시 실행. 정착 도시 + 임시 전환 + 주변 도시를 관리하는 도시 시스템 모듈.
(function() {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_CITY) return;

    // 저장 키들: 정착 도시 / 임시 전환 상태 / 미정의 도시 요청 누적.
    const KEY_HOME = 'saudade.home.city';
    const KEY_SWITCH = 'saudade.desk.switch';
    const KEY_REQUESTS = 'saudade.city.requests';

    let _defs = null;       // city-definitions.json cache

    // load — 도시 정의 JSON 을 한 번만 로드해 캐시(force-cache, 실패 시 빈 정의로 폴백).
    function load() {
        if (_defs) return Promise.resolve(_defs);
        return fetch('./data/city-definitions.json', { cache: 'force-cache' })
            .then(r => r.ok ? r.json() : null)
            .then(d => { _defs = d || { cities: {}, edition_default_home: {} }; return _defs; })
            .catch(() => { _defs = { cities: {}, edition_default_home: {} }; return _defs; });
    }

    // getDefinedCity — 편집부가 정의한 도시 객체를 이름으로 찾는다(없으면 null).
    function getDefinedCity(name) {
        if (!_defs || !name) return null;
        return _defs.cities[name] || null;
    }

    // isDefined — 그 도시가 정의돼 있는지 여부.
    function isDefined(name) {
        return !!getDefinedCity(name);
    }

    // Per-edition home city. The legacy single KEY_HOME was edition-agnostic,
    // so a 'Seoul' saved while reading EN persisted into ES and the cover
    // kept showing Seoul cafés. Each edition now has its own memory at
    // KEY_HOME + '.<ed>'. No legacy migration — without knowing which edition
    // the legacy value was chosen under, migrating risks miscarrying the
    // user's EN choice into KO. New per-edition data accrues on next pick.
    // getHomeCity — 에디션별 정착 도시. 저장값이 유효하면 그것, 없으면 에디션 기본 도시.
    function getHomeCity() {
        const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
        try {
            const v = localStorage.getItem(KEY_HOME + '.' + ed);
            if (v && isDefined(v)) return v;
        } catch (e) {}
        return _defs?.edition_default_home?.[ed] || 'Lisbon';
    }
    // setHomeCity — 현재 에디션의 정착 도시를 저장하고 관련 화면들을 다시 그린다.
    function setHomeCity(name) {
        if (!name) return false;
        const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
        try { localStorage.setItem(KEY_HOME + '.' + ed, name); } catch (e) {}
        // 모든 saudade-* 모듈 reload
        try { window.SAUDADE_COVER?.render?.(); } catch (e) {}
        try { window.SAUDADE_DISPATCHES?.reload?.(); } catch (e) {}
        try { window.SAUDADE_DESK?.render?.(); } catch (e) {}
        return true;
    }

    // getSwitch — 유효한 임시 전환 상태를 반환. returns_at 지났으면 자동 클리어 후 null.
    // 임시 desk switch 모드 (v6 §5.4) — 3일 후 자동 복귀
    function getSwitch() {
        try {
            const raw = localStorage.getItem(KEY_SWITCH);
            if (!raw) return null;
            const s = JSON.parse(raw);
            // 만료 (returns_at 지났으면) 자동 클리어
            if (s.returns_at && new Date(s.returns_at).getTime() < Date.now()) {
                localStorage.removeItem(KEY_SWITCH);
                return null;
            }
            return s;
        } catch (e) { return null; }
    }
    // startSwitch — 정의된 도시로 3일간 임시 전환하고 관련 화면을 다시 그린다.
    function startSwitch(toCity) {
        if (!isDefined(toCity)) return false;
        const from = getHomeCity();
        const returnsAt = new Date(Date.now() + 3 * 86400000).toISOString();
        const s = { from, to: toCity, returns_at: returnsAt };
        try { localStorage.setItem(KEY_SWITCH, JSON.stringify(s)); } catch (e) {}
        try { window.SAUDADE_COVER?.render?.(); } catch (e) {}
        try { window.SAUDADE_DISPATCHES?.reload?.(); } catch (e) {}
        try { window.SAUDADE_DESK?.render?.(); } catch (e) {}
        return true;
    }
    // endSwitch — 임시 전환을 지우고 정착 도시로 복귀(관련 화면 재렌더).
    function endSwitch() {
        try { localStorage.removeItem(KEY_SWITCH); } catch (e) {}
        try { window.SAUDADE_COVER?.render?.(); } catch (e) {}
        try { window.SAUDADE_DISPATCHES?.reload?.(); } catch (e) {}
        try { window.SAUDADE_DESK?.render?.(); } catch (e) {}
    }
    // makePermanent — 임시 전환 대상을 정착 도시로 굳힌 뒤 전환 상태를 종료.
    function makePermanent() {
        const s = getSwitch();
        if (!s || !s.to) return false;
        setHomeCity(s.to);
        endSwitch();
        return true;
    }

    // v6 §5.1: Atlas + Ledger 는 정착 도시 유지. Dispatches + Listening + Cover (날짜 라벨) 만 변경.
    // 활성 desk = switch.to 가 있으면 그것, 없으면 home
    // activeDeskCity — 현재 활성 데스크 도시(전환 중이면 대상, 아니면 정착 도시).
    function activeDeskCity() {
        const s = getSwitch();
        return (s && s.to) ? s.to : getHomeCity();
    }
    // persistentHomeCity — Atlas/Ledger 가 쓰는 변하지 않는 정착 도시.
    function persistentHomeCity() {
        return getHomeCity();
    }

    // getRequests — 미정의 도시 요청 누적 카운트를 읽는다.
    // v6 §5.5 — 정의 안 된 도시 요청 누적
    function getRequests() {
        try { return JSON.parse(localStorage.getItem(KEY_REQUESTS) || '{}'); }
        catch (e) { return {}; }
    }
    // recordRequest — 특정 도시 요청 수를 1 늘리고 새 카운트를 반환(100명 → 다음 분기 검토).
    function recordRequest(cityName) {
        if (!cityName) return 0;
        const all = getRequests();
        all[cityName] = (all[cityName] || 0) + 1;
        try { localStorage.setItem(KEY_REQUESTS, JSON.stringify(all)); } catch (e) {}
        return all[cityName];
    }

    // adjacentCities — 활성 데스크 도시의 주변 도시 목록.
    // 주변 도시 (adjacent) — 활성 desk 기준
    function adjacentCities() {
        const def = getDefinedCity(activeDeskCity());
        return def?.adjacent || [];
    }

    // cityName — 도시의 현지어 표기(정의에 없으면 원래 이름 그대로).
    // 도시명 자국어 (cover-titles.json 의 city 필드와 별개로 city-definitions.json names)
    function cityName(city, ed) {
        const def = getDefinedCity(city);
        const e = ed || (window.SAUDADE_EDITION?.get?.() || 'en');
        return def?.names?.[e] || city;
    }

    // init — 도시 정의를 미리 로드해 둔다.
    function init() {
        load();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 전역 공개 API — 도시 정의 조회 + 정착/전환/주변 도시 + 요청 누적.
    window.SAUDADE_CITY = {
        load,
        isDefined, getDefinedCity,
        getHomeCity, setHomeCity,
        getSwitch, startSwitch, endSwitch, makePermanent,
        activeDeskCity, persistentHomeCity,
        adjacentCities, cityName,
        recordRequest, getRequests
    };
})();
