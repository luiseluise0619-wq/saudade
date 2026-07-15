#!/usr/bin/env node
'use strict';
/**
 * saudade · civic-data
 *
 * 디스패치 생성을 "실제 공공 데이터"에 접지(ground)시키기 위한 페처.
 * 예전엔 Gemini 가 아무 소스 없이 계절 관찰을 지어냈다(감성 글귀). 이제
 * 각 도시의 실제 공휴일 + 날씨를 가져와 프롬프트에 넣고, Gemini 는 "지어내기"
 * 대신 "그 사실을 saudade 톤으로 다듬기"만 하게 한다. → 헌법 §3(가짜 금지)에 부합.
 *
 * 두 소스 모두 무료 · API 키 불필요:
 *   - 공휴일: Nager.Date  (https://date.nager.at) — 국가별 공휴일
 *   - 날씨:   Open-Meteo  (https://open-meteo.com) — 좌표별 예보
 *
 * GitHub Actions 러너에서 실행됨(외부 인터넷 가능). 어떤 소스가 실패해도
 * null 로 우아하게 degrade → 생성은 계속되고 접지만 약해진다.
 */

// 도시 표시명(EDITION_CONFIG 의 cities 값) → 국가코드 + 좌표 + 타임존.
const CITY_META = {
    'SEOUL':        { cc: 'KR', lat: 37.57,  lng: 126.98, tz: 'Asia/Seoul' },
    '서울':         { cc: 'KR', lat: 37.57,  lng: 126.98, tz: 'Asia/Seoul' },
    '부산':         { cc: 'KR', lat: 35.18,  lng: 129.08, tz: 'Asia/Seoul' },
    '제주':         { cc: 'KR', lat: 33.51,  lng: 126.52, tz: 'Asia/Seoul' },
    'TOKYO':        { cc: 'JP', lat: 35.68,  lng: 139.69, tz: 'Asia/Tokyo' },
    '東京':         { cc: 'JP', lat: 35.68,  lng: 139.69, tz: 'Asia/Tokyo' },
    '大阪':         { cc: 'JP', lat: 34.69,  lng: 135.50, tz: 'Asia/Tokyo' },
    '京都':         { cc: 'JP', lat: 35.01,  lng: 135.77, tz: 'Asia/Tokyo' },
    'LISBON':       { cc: 'PT', lat: 38.72,  lng: -9.14,  tz: 'Europe/Lisbon' },
    'LISBOA':       { cc: 'PT', lat: 38.72,  lng: -9.14,  tz: 'Europe/Lisbon' },
    'PORTO':        { cc: 'PT', lat: 41.15,  lng: -8.61,  tz: 'Europe/Lisbon' },
    'SINTRA':       { cc: 'PT', lat: 38.80,  lng: -9.39,  tz: 'Europe/Lisbon' },
    'MADRID':       { cc: 'ES', lat: 40.42,  lng: -3.70,  tz: 'Europe/Madrid' },
    'BARCELONA':    { cc: 'ES', lat: 41.39,  lng: 2.17,   tz: 'Europe/Madrid' },
    'BUENOS AIRES': { cc: 'AR', lat: -34.60, lng: -58.38, tz: 'America/Argentina/Buenos_Aires' }
};

async function getJson(url, ms = 12000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(t);
    }
}

// 어제 ~ 2주 뒤 사이의 공휴일(국가 단위). 연말 경계면 다음 해도 조회.
async function holidaysSoon(cc, todayStr) {
    const year = Number(todayStr.slice(0, 4));
    let list = [];
    for (const y of [year, year + 1]) {
        try { list = list.concat(await getJson(`https://date.nager.at/api/v3/PublicHolidays/${y}/${cc}`)); }
        catch (e) { /* degrade */ }
    }
    const today = new Date(todayStr + 'T00:00:00Z').getTime();
    return list
        .filter(h => {
            const days = (new Date(h.date + 'T00:00:00Z').getTime() - today) / 86400000;
            return days >= -1 && days <= 14;
        })
        .map(h => ({ date: h.date, name: h.localName || h.name }));
}

async function weatherFor(meta, todayStr) {
    try {
        const d = await getJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${meta.lat}&longitude=${meta.lng}` +
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode` +
            `&timezone=${encodeURIComponent(meta.tz)}&start_date=${todayStr}&end_date=${todayStr}`
        );
        const day = d && d.daily;
        if (!day) return null;
        return {
            tmax: day.temperature_2m_max && day.temperature_2m_max[0],
            tmin: day.temperature_2m_min && day.temperature_2m_min[0],
            precip: day.precipitation_sum && day.precipitation_sum[0],
            code: day.weathercode && day.weathercode[0]
        };
    } catch (e) { return null; }
}

// 도시명 배열 → { <도시명>: { holidays:[...], weather:{...} } | null }
async function fetchCityFacts(cityNames, todayStr) {
    const out = {};
    for (const name of cityNames) {
        const meta = CITY_META[name] || CITY_META[String(name).toUpperCase()];
        if (!meta) { out[name] = null; continue; }
        try {
            const [holidays, weather] = await Promise.all([
                holidaysSoon(meta.cc, todayStr),
                weatherFor(meta, todayStr)
            ]);
            out[name] = { holidays, weather };
        } catch (e) {
            out[name] = null;
        }
    }
    return out;
}

// WMO weathercode → 짧은 영어 설명(프롬프트용). 없으면 빈 문자열.
function wmoText(code) {
    if (code == null) return '';
    const m = {
        0: 'clear', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
        45: 'fog', 48: 'rime fog', 51: 'light drizzle', 53: 'drizzle', 55: 'dense drizzle',
        61: 'light rain', 63: 'rain', 65: 'heavy rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow',
        80: 'rain showers', 81: 'rain showers', 82: 'violent rain showers', 95: 'thunderstorm',
        96: 'thunderstorm with hail', 99: 'thunderstorm with heavy hail'
    };
    return m[code] || '';
}

// 도시 하나의 facts 를 프롬프트용 한 줄 요약으로.
function factsLine(name, f) {
    if (!f) return null;
    const parts = [];
    if (f.weather) {
        const w = f.weather;
        const wx = wmoText(w.code);
        const bits = [];
        if (w.tmax != null && w.tmin != null) bits.push(`${Math.round(w.tmin)}–${Math.round(w.tmax)}°C`);
        if (w.precip != null && w.precip > 0) bits.push(`${w.precip}mm precip`);
        if (wx) bits.push(wx);
        if (bits.length) parts.push('weather: ' + bits.join(', '));
    }
    if (f.holidays && f.holidays.length) {
        parts.push('public holidays soon: ' + f.holidays.map(h => `${h.name} (${h.date})`).join('; '));
    }
    return parts.length ? `${name} — ${parts.join(' · ')}` : null;
}

module.exports = { fetchCityFacts, factsLine, CITY_META };

// CLI: node scripts/civic-data.js [YYYY-MM-DD] city1 city2 ...
if (require.main === module) {
    const args = process.argv.slice(2);
    const today = /^\d{4}-\d{2}-\d{2}$/.test(args[0]) ? args.shift() : new Date().toISOString().slice(0, 10);
    const cities = args.length ? args : ['SEOUL', 'TOKYO', 'LISBON'];
    fetchCityFacts(cities, today).then(f => {
        for (const c of cities) console.log(factsLine(c, f[c]) || `${c} — (no data)`);
    });
}
