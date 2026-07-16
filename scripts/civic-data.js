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
// area = 한국관광공사 TourAPI areaCode (KR 도시만; 축제 API 옵션용).
const CITY_META = {
    'SEOUL':        { cc: 'KR', lat: 37.57,  lng: 126.98, tz: 'Asia/Seoul', area: 1 },
    '서울':         { cc: 'KR', lat: 37.57,  lng: 126.98, tz: 'Asia/Seoul', area: 1 },
    '부산':         { cc: 'KR', lat: 35.18,  lng: 129.08, tz: 'Asia/Seoul', area: 6 },
    '제주':         { cc: 'KR', lat: 33.51,  lng: 126.52, tz: 'Asia/Seoul', area: 39 },
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

async function getText(url, ms = 12000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
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
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,sunrise,sunset,uv_index_max` +
            `&timezone=${encodeURIComponent(meta.tz)}&start_date=${todayStr}&end_date=${todayStr}`
        );
        const day = d && d.daily;
        if (!day) return null;
        const hhmm = s => (typeof s === 'string' && s.length >= 16) ? s.slice(11, 16) : null;
        return {
            tmax: day.temperature_2m_max && day.temperature_2m_max[0],
            tmin: day.temperature_2m_min && day.temperature_2m_min[0],
            precip: day.precipitation_sum && day.precipitation_sum[0],
            code: day.weathercode && day.weathercode[0],
            sunrise: hhmm(day.sunrise && day.sunrise[0]),
            sunset: hhmm(day.sunset && day.sunset[0]),
            uv: day.uv_index_max && day.uv_index_max[0]
        };
    } catch (e) { return null; }
}

// 대기질(미세먼지). Open-Meteo Air-Quality — 키 불필요. 오늘 스냅샷.
async function airQualityFor(meta) {
    try {
        const d = await getJson(
            `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${meta.lat}&longitude=${meta.lng}` +
            `&current=pm2_5,pm10,european_aqi&timezone=${encodeURIComponent(meta.tz)}`
        );
        const c = d && d.current;
        if (!c) return null;
        return { pm25: c.pm2_5, pm10: c.pm10, aqi: c.european_aqi };
    } catch (e) { return null; }
}

function ymdShift(ymd, deltaDays) {
    const t = new Date(ymd + 'T00:00:00Z').getTime() + deltaDays * 86400000;
    return new Date(t).toISOString().slice(0, 10);
}

// 축제/행사 — KR 은 한국관광공사 TourAPI, 그 외 도시는 Ticketmaster.
// 둘 다 무료 키 옵션(DATA_GO_KR_KEY / TICKETMASTER_KEY). 키 없으면 스킵.
async function festivalsFor(meta, todayStr) {
    if (meta.cc === 'KR' && meta.area) return festivalsKR(meta, todayStr);
    return festivalsIntl(meta, todayStr);
}
async function festivalsKR(meta, todayStr) {
    const key = (process.env.DATA_GO_KR_KEY || '').trim();
    if (!key) return null;
    try {
        const start = todayStr.replace(/-/g, '');
        const url = `https://apis.data.go.kr/B551011/KorService1/searchFestival1` +
            `?serviceKey=${encodeURIComponent(key)}&MobileOS=ETC&MobileApp=saudade&_type=json` +
            `&arrange=A&areaCode=${meta.area}&eventStartDate=${start}&numOfRows=5&pageNo=1`;
        const d = await getJson(url, 15000);
        const items = d && d.response && d.response.body && d.response.body.items && d.response.body.items.item;
        const arr = Array.isArray(items) ? items : (items ? [items] : []);
        return arr.slice(0, 3).map(it => ({ title: it.title, start: it.eventstartdate })).filter(f => f.title);
    } catch (e) { return null; }
}
async function festivalsIntl(meta, todayStr) {
    const key = (process.env.TICKETMASTER_KEY || '').trim();
    if (!key) return null;
    try {
        const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${encodeURIComponent(key)}` +
            `&latlong=${meta.lat},${meta.lng}&radius=25&unit=km&size=5&sort=date,asc` +
            `&startDateTime=${todayStr}T00:00:00Z`;
        const d = await getJson(url, 15000);
        const evs = d && d._embedded && d._embedded.events;
        const arr = Array.isArray(evs) ? evs : [];
        return arr.slice(0, 3).map(e => ({
            title: e.name,
            start: e.dates && e.dates.start && e.dates.start.localDate
        })).filter(f => f.title);
    } catch (e) { return null; }
}

// 환율 — Frankfurter(ECB), 키 불필요. 현지 통화 1 USD 기준. 노마드 핵심 정보.
const CURRENCY = { KR: 'KRW', JP: 'JPY', PT: 'EUR', ES: 'EUR', AR: 'ARS' };
async function fxFor(meta) {
    const cur = CURRENCY[meta.cc];
    if (!cur) return null;
    try {
        const d = await getJson(`https://api.frankfurter.app/latest?from=USD&to=${cur}`);
        const rate = d && d.rates && d.rates[cur];
        return rate ? { cur, rate } : null;    // 1 USD = rate <cur>
    } catch (e) { return null; }
}

// 지진 — USGS(키 불필요). 최근 3일, 도시 반경 ~350km, 규모 4.5+.
async function quakesFor(meta, todayStr) {
    try {
        const start = ymdShift(todayStr, -3);
        const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=4.5` +
            `&latitude=${meta.lat}&longitude=${meta.lng}&maxradiuskm=350&starttime=${start}&orderby=magnitude`;
        const d = await getJson(url, 15000);
        const feats = d && d.features;
        if (!Array.isArray(feats) || !feats.length) return null;
        const top = feats[0];
        return { mag: top.properties && top.properties.mag, place: top.properties && top.properties.place };
    } catch (e) { return null; }
}

// 작은 지역 civic 뉴스 — "한강공원 개장" 같은 것. Google 뉴스 RSS(키 불필요, 전 언어).
// 도시명 + civic 키워드로 검색 → 최근 헤드라인. 정치/사건은 리뷰 게이트가 거른다.
const NEWS = {
    en: { hl: 'en',    gl: 'US', ceid: 'US:en',     terms: 'park OR festival OR exhibition OR opening OR library OR reopens' },
    ko: { hl: 'ko',    gl: 'KR', ceid: 'KR:ko',     terms: '공원 OR 축제 OR 전시 OR 개장 OR 무료개방 OR 도서관 OR 개관' },
    ja: { hl: 'ja',    gl: 'JP', ceid: 'JP:ja',     terms: '公園 OR 祭り OR 展覧会 OR オープン OR 開館 OR 無料開放' },
    pt: { hl: 'pt-PT', gl: 'PT', ceid: 'PT:pt-150', terms: 'parque OR festival OR exposição OR inauguração OR reabre' },
    es: { hl: 'es',    gl: 'ES', ceid: 'ES:es',     terms: 'parque OR festival OR exposición OR apertura OR reabre' }
};

function decodeXml(s) {
    return String(s || '')
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#0?39;/g, "'")
        .replace(/&amp;/g, '&')
        .trim();
}

function parseNewsRss(xml, todayStr, maxAgeDays = 6) {
    const out = [];
    const cutoff = new Date(ymdShift(todayStr, -maxAgeDays) + 'T00:00:00Z').getTime();
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = re.exec(xml)) && out.length < 4) {
        const block = m[1];
        const rawTitle = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
        const pd = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
        // Google 뉴스 제목은 "헤드라인 - 매체" 형식 → 매체 부분 제거.
        const title = decodeXml(rawTitle).replace(/\s+-\s+[^-]+$/, '').trim();
        if (!title || title.length < 6) continue;
        const when = pd ? Date.parse(pd) : NaN;
        if (!isNaN(when) && when < cutoff) continue;   // 오래된 것 제외(날짜 없으면 통과)
        out.push(title);
    }
    return out;
}

async function civicNewsFor(name, edition, todayStr) {
    const cfg = NEWS[edition] || NEWS.en;
    try {
        const q = encodeURIComponent(`"${name}" (${cfg.terms})`);
        const url = `https://news.google.com/rss/search?q=${q}&hl=${cfg.hl}&gl=${cfg.gl}&ceid=${cfg.ceid}`;
        const xml = await getText(url, 15000);
        const items = parseNewsRss(xml, todayStr);
        return items.length ? items : null;
    } catch (e) { return null; }
}

// 도시명 배열 → { <도시명>: { holidays, weather, air, festivals, fx, quake, news } | null }
async function fetchCityFacts(cityNames, todayStr, edition) {
    const out = {};
    for (const name of cityNames) {
        const meta = CITY_META[name] || CITY_META[String(name).toUpperCase()];
        if (!meta) { out[name] = null; continue; }
        try {
            // 지진(quakesFor)은 리뷰 게이트의 '재난' 규칙과 충돌해 제외.
            const [holidays, weather, air, festivals, fx, news] = await Promise.all([
                holidaysSoon(meta.cc, todayStr),
                weatherFor(meta, todayStr),
                airQualityFor(meta),
                festivalsFor(meta, todayStr),
                fxFor(meta),
                civicNewsFor(name, edition, todayStr)
            ]);
            out[name] = { holidays, weather, air, festivals, fx, news };
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
function aqiText(aqi) {
    if (aqi == null) return '';
    if (aqi <= 20) return 'good';
    if (aqi <= 40) return 'fair';
    if (aqi <= 60) return 'moderate';
    if (aqi <= 80) return 'poor';
    if (aqi <= 100) return 'very poor';
    return 'extremely poor';
}
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
        if (w.uv != null && w.uv >= 8) bits.push(`UV ${Math.round(w.uv)} (very high)`);
        if (w.sunset) bits.push(`sunset ${w.sunset}`);
        if (bits.length) parts.push('weather: ' + bits.join(', '));
    }
    if (f.air && f.air.aqi != null) {
        const t = aqiText(f.air.aqi);
        const pm = f.air.pm25 != null ? `, PM2.5 ${Math.round(f.air.pm25)}` : '';
        parts.push(`air quality: ${t}${pm}`);
    }
    if (f.fx && f.fx.rate != null) {
        const r = f.fx.rate >= 100 ? Math.round(f.fx.rate) : Math.round(f.fx.rate * 100) / 100;
        parts.push(`exchange rate: 1 USD = ${r} ${f.fx.cur}`);
    }
    if (f.festivals && f.festivals.length) {
        parts.push('festivals/events on now: ' + f.festivals.map(x => x.title).join('; '));
    }
    if (f.news && f.news.length) {
        parts.push('recent local civic headlines (use only calm, non-political ones): ' + f.news.join(' | '));
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
