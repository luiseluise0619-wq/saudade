// SAUDADE · CITY SYSTEM (Handoff v6 §5)
// 정착 도시 (home city) + 주변 도시 (adjacent) 시스템.
// data/city-definitions.json — 편집부 정의 (사용자 변경 X).
// localStorage:
//   saudade.home.city                — 사용자가 선택한 정착 도시
//   saudade.desk.switch              — 임시 모드 { from, to, returns_at } (3일)
//   saudade.city.requests            — 정의 안 된 도시 요청 누적 (100명 → 다음 분기)
'use strict';

(function() {
    if (window.SAUDADE_CITY) return;

    const KEY_HOME = 'saudade.home.city';
    const KEY_SWITCH = 'saudade.desk.switch';
    const KEY_REQUESTS = 'saudade.city.requests';

    let _defs = null;       // city-definitions.json cache

    function load() {
        if (_defs) return Promise.resolve(_defs);
        return fetch('./data/city-definitions.json', { cache: 'force-cache' })
            .then(r => r.ok ? r.json() : null)
            .then(d => { _defs = d || { cities: {}, edition_default_home: {} }; return _defs; })
            .catch(() => { _defs = { cities: {}, edition_default_home: {} }; return _defs; });
    }

    function getDefinedCity(name) {
        if (!_defs || !name) return null;
        return _defs.cities[name] || null;
    }

    function isDefined(name) {
        return !!getDefinedCity(name);
    }

    // 사용자가 명시적으로 선택한 home city. 없으면 edition default.
    function getHomeCity() {
        try {
            const v = localStorage.getItem(KEY_HOME);
            if (v && isDefined(v)) return v;
        } catch (e) {}
        const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
        return _defs?.edition_default_home?.[ed] || 'Lisbon';
    }
    function setHomeCity(name) {
        if (!name) return false;
        try { localStorage.setItem(KEY_HOME, name); } catch (e) {}
        // 모든 saudade-* 모듈 reload
        try { window.SAUDADE_COVER?.render?.(); } catch (e) {}
        try { window.SAUDADE_DISPATCHES?.reload?.(); } catch (e) {}
        try { window.SAUDADE_DESK?.render?.(); } catch (e) {}
        return true;
    }

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
    function endSwitch() {
        try { localStorage.removeItem(KEY_SWITCH); } catch (e) {}
        try { window.SAUDADE_COVER?.render?.(); } catch (e) {}
        try { window.SAUDADE_DISPATCHES?.reload?.(); } catch (e) {}
        try { window.SAUDADE_DESK?.render?.(); } catch (e) {}
    }
    function makePermanent() {
        const s = getSwitch();
        if (!s || !s.to) return false;
        setHomeCity(s.to);
        endSwitch();
        return true;
    }

    // v6 §5.1: Atlas + Ledger 는 정착 도시 유지. Dispatches + Listening + Cover (날짜 라벨) 만 변경.
    // 활성 desk = switch.to 가 있으면 그것, 없으면 home
    function activeDeskCity() {
        const s = getSwitch();
        return (s && s.to) ? s.to : getHomeCity();
    }
    function persistentHomeCity() {
        return getHomeCity();
    }

    // v6 §5.5 — 정의 안 된 도시 요청 누적
    function getRequests() {
        try { return JSON.parse(localStorage.getItem(KEY_REQUESTS) || '{}'); }
        catch (e) { return {}; }
    }
    function recordRequest(cityName) {
        if (!cityName) return 0;
        const all = getRequests();
        all[cityName] = (all[cityName] || 0) + 1;
        try { localStorage.setItem(KEY_REQUESTS, JSON.stringify(all)); } catch (e) {}
        return all[cityName];
    }

    // 주변 도시 (adjacent) — 활성 desk 기준
    function adjacentCities() {
        const def = getDefinedCity(activeDeskCity());
        return def?.adjacent || [];
    }

    // 도시명 자국어 (cover-titles.json 의 city 필드와 별개로 city-definitions.json names)
    function cityName(city, ed) {
        const def = getDefinedCity(city);
        const e = ed || (window.SAUDADE_EDITION?.get?.() || 'en');
        return def?.names?.[e] || city;
    }

    function init() {
        load();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

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
