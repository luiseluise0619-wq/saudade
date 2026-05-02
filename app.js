'use strict';

// ═══════════════════════════════════════════════════════════════════════════
//  Λ U R Λ : WORLD PULSE — v5.0
//  Future Situation Room · Observe The World
//  © 2026 LEEJAEJIN (JADDY) @jaddy_102
// ═══════════════════════════════════════════════════════════════════════════

const VERSION = '5.0.0';
const BUILD_DATE = '2026-04-22';

const STORAGE_KEY = 'aura_wp_v50_articles';
const BOOKMARKS_KEY = 'aura_wp_v50_bookmarks';
const SETTINGS_KEY = 'aura_wp_v50_settings';
const INTEL_KEY = 'aura_wp_v50_intel';
const TRANSLATE_KEY = 'aura_wp_v50_translations';

const REFRESH_INTERVAL = 5 * 60 * 1000;
const AUX_REFRESH = 10 * 60 * 1000;
const AIRCRAFT_REFRESH = 15 * 1000;
const AIRCRAFT_TICK_MS = 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ARTICLES = 2500;
const HOT_THRESHOLD = 12;
const REQUEST_TIMEOUT = 9000;

// 자체 Cloudflare Worker (window.AURA_SERVER) 우선 사용. 외부 무료 프록시
// (allorigins/corsproxy/codetabs) 의존성 제거 — rate-limit/whitelist/cache 없음.
// Worker 미설정인 dev 환경에서만 fallback.
const PROXIES = (typeof window !== 'undefined' && window.AURA_SERVER)
    ? [ u => `${window.AURA_SERVER}/rss?url=${encodeURIComponent(u)}` ]
    : [
        // dev fallback only — 프로덕션은 항상 AURA_SERVER 사용.
        u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    ];

// ── 150 RSS FEEDS ──────────────────────────────────────────────────────────
// RSS 신뢰성 + 정치적 다양성 (AllSides 등급 기반): center / left-center / right-center
// 사용자 요청: 좌-중도 편향 해결 → 우측/중도 소스 추가
const RSS_FEEDS = [
    // ── 중립 / 국제 (CENTER · 가장 신뢰) ──
    { source: 'BBC World',          url: 'https://feeds.bbci.co.uk/news/world/rss.xml',                bias: 'center' },
    { source: 'BBC Business',       url: 'https://feeds.bbci.co.uk/news/business/rss.xml',             bias: 'center' },
    { source: 'BBC Tech',           url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',           bias: 'center' },
    { source: 'CNBC',               url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',      bias: 'center' },
    { source: 'DW',                 url: 'https://rss.dw.com/rdf/rss-en-all',                          bias: 'center' },
    { source: 'France 24',          url: 'https://www.france24.com/en/rss',                            bias: 'center' },
    { source: 'NPR',                url: 'https://feeds.npr.org/1001/rss.xml',                         bias: 'center' },
    { source: 'Reuters Top',        url: 'https://feeds.feedburner.com/reuters/topNews',               bias: 'center' },
    // ── 좌중도 (LEFT-CENTER) ──
    { source: 'The Guardian',       url: 'https://www.theguardian.com/world/rss',                      bias: 'left-center' },
    { source: 'Wired',              url: 'https://www.wired.com/feed/rss',                             bias: 'left-center' },
    { source: 'The Verge',          url: 'https://www.theverge.com/rss/index.xml',                     bias: 'left-center' },
    { source: 'TechCrunch',         url: 'https://techcrunch.com/feed/',                               bias: 'left-center' },
    { source: 'Politico',           url: 'https://www.politico.com/rss/politicopicks.xml',             bias: 'left-center' },
    // ── 우중도 (RIGHT-CENTER) ──
    { source: 'Fox Business',       url: 'https://moxie.foxbusiness.com/google-publisher/latest.xml',  bias: 'right-center' },
    { source: 'NY Post',            url: 'https://nypost.com/feed/',                                   bias: 'right-center' },
    { source: 'Telegraph',          url: 'https://www.telegraph.co.uk/news/rss.xml',                   bias: 'right-center' },
    { source: 'The Hill',           url: 'https://thehill.com/feed/',                                  bias: 'right-center' },
    // ── 우 (RIGHT · 균형 위해) ──
    { source: 'Daily Wire',         url: 'https://www.dailywire.com/feeds/rss.xml',                    bias: 'right' },
    // ── 비즈니스 / 시장 ──
    { source: 'Bloomberg',          url: 'https://feeds.bloomberg.com/markets/news.rss',               bias: 'center' },
    { source: 'MarketWatch',        url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', bias: 'center' },
    { source: 'The Economist',      url: 'https://www.economist.com/finance-and-economics/rss.xml',    bias: 'center' },
    // ── 테크 ──
    { source: 'Ars Technica',       url: 'https://feeds.arstechnica.com/arstechnica/index',            bias: 'center' },
    { source: 'Engadget',           url: 'https://www.engadget.com/rss.xml',                           bias: 'center' },
    { source: 'Hacker News',        url: 'https://hnrss.org/frontpage',                                bias: 'center' },
    { source: 'MIT Tech Review',    url: 'https://www.technologyreview.com/feed/',                     bias: 'left-center' },
    { source: 'VentureBeat',        url: 'https://venturebeat.com/feed/',                              bias: 'center' },
    // ── 한국 ──
    { source: 'Yonhap',             url: 'https://en.yna.co.kr/RSS/news.xml',                          bias: 'center' },
    { source: 'Korea Herald',       url: 'http://www.koreaherald.com/common/rss_xml.php?ct=102',       bias: 'center' },
    // ── 일본 ──
    { source: 'Japan Times',        url: 'https://www.japantimes.co.jp/feed/',                         bias: 'center' },
    { source: 'NHK World',          url: 'https://www3.nhk.or.jp/nhkworld/en/news/feeds/news.xml',     bias: 'center' },
    // ── 아시아 ──
    { source: 'SCMP',               url: 'https://www.scmp.com/rss/91/feed',                           bias: 'center' },
    { source: 'Straits Times',      url: 'https://www.straitstimes.com/news/world/rss.xml',            bias: 'center' },
    // ── 유럽 ──
    { source: 'Le Monde',           url: 'https://www.lemonde.fr/rss/une.xml',                         bias: 'left-center' },
    { source: 'Der Spiegel',        url: 'https://www.spiegel.de/international/index.rss',             bias: 'left-center' },
    { source: 'Politico EU',        url: 'https://www.politico.eu/feed/',                              bias: 'center' },
    { source: 'Irish Times',        url: 'https://www.irishtimes.com/cmlink/news-1.1319192',           bias: 'center' },
    // ── 호주 / 캐나다 ──
    { source: 'CBC',                url: 'https://www.cbc.ca/webfeed/rss/rss-topstories',              bias: 'center' },
    { source: 'ABC News AU',        url: 'https://www.abc.net.au/news/feed/45910/rss.xml',             bias: 'center' },
    // ── 우크라이나 (시급 이슈) ──
    { source: 'Kyiv Independent',   url: 'https://kyivindependent.com/feed/',                          bias: 'center' },
    // ── 중국 (정부 매체) ──
    { source: 'Xinhua',             url: 'http://www.xinhuanet.com/english/rss/worldrss.xml',          bias: 'center' }
];

// 피드별 회로 차단기: 연속 실패 N번 이후 이 세션 동안 호출 중단
const __feedFailures = Object.create(null);
const FEED_FAIL_LIMIT = 3;

// AllSides 등급 → UI 라벨 색
const BIAS_LABELS = {
    'left':         { label: 'L',  color: '#3b82f6', title: 'Left' },
    'left-center':  { label: 'LC', color: '#60a5fa', title: 'Lean Left' },
    'center':       { label: 'C',  color: '#9ca3af', title: 'Center' },
    'right-center': { label: 'RC', color: '#fb923c', title: 'Lean Right' },
    'right':        { label: 'R',  color: '#ef4444', title: 'Right' }
};
window.AURA_BIAS = BIAS_LABELS;


// ── COUNTRY CONFIG ─────────────────────────────────────────────────────────
const COUNTRIES = [
    { code: 'US', en: 'United States', ko: '미국', ja: 'アメリカ', zh: '美国', flag: '🇺🇸', lat: 38.9, lng: -77.0, currency: 'USD',
      kw: ['united states', 'washington', 'new york', 'wall street', 'white house', 'u.s.', 'federal reserve', 'biden', 'trump', 'pentagon', 'congress'] },
    { code: 'KR', en: 'South Korea', ko: '대한민국', ja: '韓国', zh: '韩国', flag: '🇰🇷', lat: 37.56, lng: 126.97, currency: 'KRW',
      kw: ['south korea', 'seoul', 'korean', 'samsung', 'hyundai', 'kospi', 'yoon suk yeol'] },
    { code: 'JP', en: 'Japan', ko: '일본', ja: '日本', zh: '日本', flag: '🇯🇵', lat: 35.67, lng: 139.65, currency: 'JPY',
      kw: ['japan', 'tokyo', 'nikkei', 'japanese', 'osaka'] },
    { code: 'CN', en: 'China', ko: '중국', ja: '中国', zh: '中国', flag: '🇨🇳', lat: 39.9, lng: 116.4, currency: 'CNY',
      kw: ['china', 'beijing', 'shanghai', 'chinese', 'xi jinping'] },
    { code: 'GB', en: 'United Kingdom', ko: '영국', ja: 'イギリス', zh: '英国', flag: '🇬🇧', lat: 51.5, lng: -0.12, currency: 'GBP',
      kw: ['united kingdom', 'britain', 'london', 'british', 'uk '] },
    { code: 'DE', en: 'Germany', ko: '독일', ja: 'ドイツ', zh: '德国', flag: '🇩🇪', lat: 52.52, lng: 13.4, currency: 'EUR',
      kw: ['germany', 'berlin', 'german', 'dax'] },
    { code: 'FR', en: 'France', ko: '프랑스', ja: 'フランス', zh: '法国', flag: '🇫🇷', lat: 48.85, lng: 2.35, currency: 'EUR',
      kw: ['france', 'paris', 'french', 'macron'] },
    { code: 'IN', en: 'India', ko: '인도', ja: 'インド', zh: '印度', flag: '🇮🇳', lat: 28.61, lng: 77.2, currency: 'INR',
      kw: ['india', 'indian', 'delhi', 'mumbai', 'modi'] },
    { code: 'AU', en: 'Australia', ko: '호주', ja: 'オーストラリア', zh: '澳大利亚', flag: '🇦🇺', lat: -35.28, lng: 149.13, currency: 'AUD',
      kw: ['australia', 'sydney', 'australian', 'canberra'] },
    { code: 'CA', en: 'Canada', ko: '캐나다', ja: 'カナダ', zh: '加拿大', flag: '🇨🇦', lat: 45.42, lng: -75.69, currency: 'CAD',
      kw: ['canada', 'ottawa', 'canadian', 'toronto'] },
    { code: 'RU', en: 'Russia', ko: '러시아', ja: 'ロシア', zh: '俄罗斯', flag: '🇷🇺', lat: 55.75, lng: 37.61, currency: 'RUB',
      kw: ['russia', 'moscow', 'russian', 'kremlin', 'putin'] },
    { code: 'UA', en: 'Ukraine', ko: '우크라이나', ja: 'ウクライナ', zh: '乌克兰', flag: '🇺🇦', lat: 50.45, lng: 30.52, currency: 'UAH',
      kw: ['ukraine', 'kyiv', 'ukrainian', 'zelensky'] },
    { code: 'IL', en: 'Israel', ko: '이스라엘', ja: 'イスラエル', zh: '以色列', flag: '🇮🇱', lat: 31.76, lng: 35.21, currency: 'ILS',
      kw: ['israel', 'israeli', 'gaza', 'netanyahu', 'jerusalem', 'hamas'] },
    { code: 'SA', en: 'Saudi Arabia', ko: '사우디아라비아', ja: 'サウジアラビア', zh: '沙特阿拉伯', flag: '🇸🇦', lat: 24.68, lng: 46.72, currency: 'SAR',
      kw: ['saudi', 'riyadh', 'aramco'] },
    { code: 'BR', en: 'Brazil', ko: '브라질', ja: 'ブラジル', zh: '巴西', flag: '🇧🇷', lat: -15.77, lng: -47.92, currency: 'BRL',
      kw: ['brazil', 'brazilian', 'brasilia'] },
    { code: 'ZA', en: 'South Africa', ko: '남아프리카', ja: '南アフリカ', zh: '南非', flag: '🇿🇦', lat: -25.74, lng: 28.18, currency: 'ZAR',
      kw: ['south africa', 'johannesburg'] },
    { code: 'TR', en: 'Turkey', ko: '튀르키예', ja: 'トルコ', zh: '土耳其', flag: '🇹🇷', lat: 39.93, lng: 32.86, currency: 'TRY',
      kw: ['turkey', 'turkish', 'ankara', 'erdogan'] },
    { code: 'IR', en: 'Iran', ko: '이란', ja: 'イラン', zh: '伊朗', flag: '🇮🇷', lat: 35.69, lng: 51.39, currency: 'IRR',
      kw: ['iran', 'iranian', 'tehran'] },
    { code: 'NG', en: 'Nigeria', ko: '나이지리아', ja: 'ナイジェリア', zh: '尼日利亚', flag: '🇳🇬', lat: 9.07, lng: 7.39, currency: 'NGN',
      kw: ['nigeria', 'nigerian', 'abuja', 'lagos'] },
    { code: 'MX', en: 'Mexico', ko: '멕시코', ja: 'メキシコ', zh: '墨西哥', flag: '🇲🇽', lat: 19.43, lng: -99.13, currency: 'MXN',
      kw: ['mexico', 'mexican'] },
    { code: 'GLOBAL', en: 'Global', ko: '글로벌', ja: 'グローバル', zh: '全球', flag: '🌍', lat: 0, lng: 0, currency: 'USD', kw: [] }
];

// ── i18n (KO/EN full, others minimal) ───────────────────────────────────────
const I18N = {
    en: {
        brandSub: 'OBSERVE THE WORLD',
        refresh: 'REFRESH', settings: 'SETTINGS', close: 'CLOSE', reset: 'RESET',
        search: 'Search world signals...', signals: 'SIGNALS', share: 'SHARE',
        globeTab: 'GLOBE', socialTab: 'SOCIAL', newsTab: 'NEWS', bookmarksTab: 'BOOKMARKS',
        allCat: 'ALL', world: 'WORLD', economy: 'ECONOMY', tech: 'TECH', conflict: 'CONFLICT',
        health: 'HEALTH', politics: 'POLITICS', business: 'BUSINESS',
        heatLabel: 'SIGNAL HEAT', heatHelp: 'Average intensity of news signals across all tracked countries, weighted by recency and severity.',
        feedsLive: 'FEEDS LIVE', hotZones: 'HOT ZONES', breaking: 'BREAKING',
        cacheWin: '7-DAY CACHE', cacheHelp: 'News is stored locally for 7 days then auto-pruned.',
        summary: 'SUMMARY', timeline: '7-DAY TIMELINE', latest: 'LATEST SIGNALS',
        notePlaceholder: 'Add notes...', openSource: 'OPEN SOURCE →',
        layersOn: 'ALL ON', layersOff: 'ALL OFF', fxPair: 'FX PAIR', stats: 'SYSTEM',
        articles: 'ARTICLES', aircraft: 'AIRCRAFT', quakes: 'QUAKES', disasters: 'DISASTERS',
        nextUpdate: 'NEXT SYNC', nowLabel: 'NOW', cmdCenter: 'COMMAND CENTER',
        nearWeather: 'WEATHER', nearAir: 'AIR QUALITY', nearQuake: 'NEAREST QUAKE',
        nearDisaster: 'NEAREST EVENT', relatedNews: 'RELATED NEWS',
        selectSignal: 'Select a signal above', noBookmarks: 'No bookmarks yet',
        noBookmarksHint: 'Star any story to pin it here.',
        socialHero: 'Global conversation pulse', tapFilter: 'TAP TO FILTER NEWS',
        redditBrief: 'REDDIT PULSE', wikiBrief: 'WIKIPEDIA PULSE', trendClusters: 'TREND CLUSTERS',
        translateBtn: 'TRANSLATE', theme: 'THEME', language: 'LANGUAGE',
        notifications: 'NOTIFICATIONS', breakingAlerts: 'Breaking alerts',
        observe: 'OBSERVE THE WORLD', released: 'Globe released',
        dragRotate: 'DRAG · ZOOM · CLICK COUNTRY', cardDownloaded: 'Share card downloaded',
        bookmarked: 'Bookmarked', removed: 'Bookmark removed', noteSaved: 'Note saved',
        heatExplain: 'Signal Heat measures global news intensity. It combines recent article volume, severity keywords (conflict, market shocks, disasters), and freshness. Higher = more world activity.',
        feedsExplain: 'Number of RSS sources currently reachable and returning valid data.',
        hotZonesExplain: 'Countries ranked by 7-day article volume and signal intensity.',
        breakingExplain: 'Cross-source keyword spikes detected in the last 2 hours.',
        compactLabel: 'COMPACT',
        pool: 'SIGNAL POOL', showAll: 'SHOW ALL'
    },
    ko: {
        brandSub: 'OBSERVE THE WORLD',
        refresh: '새로고침', settings: '설정', close: '닫기', reset: '초기화',
        search: '세계 신호 검색...', signals: '신호', share: '공유',
        globeTab: '지구본', socialTab: '소셜', newsTab: '뉴스', bookmarksTab: '북마크',
        allCat: '전체', world: '월드', economy: '경제', tech: '기술', conflict: '분쟁',
        health: '보건', politics: '정치', business: '비즈니스',
        heatLabel: '시그널 히트', heatHelp: '추적 중인 모든 국가의 뉴스 신호 평균 강도입니다. 최신성과 심각도로 가중치를 부여합니다.',
        feedsLive: '피드 라이브', hotZones: '핫존', breaking: '긴급',
        cacheWin: '7일 캐시', cacheHelp: '뉴스는 이 기기에 7일간 저장되고 자동 정리됩니다.',
        summary: '요약', timeline: '7일 타임라인', latest: '최신 시그널',
        notePlaceholder: '메모를 남기세요...', openSource: '원문 보기 →',
        layersOn: '전체 켜기', layersOff: '전체 끄기', fxPair: '환율', stats: '시스템',
        articles: '기사', aircraft: '항공기', quakes: '지진', disasters: '재난',
        nextUpdate: '다음 동기화', nowLabel: '현재', cmdCenter: '커맨드 센터',
        nearWeather: '날씨', nearAir: '대기질', nearQuake: '가까운 지진',
        nearDisaster: '가까운 재난', relatedNews: '관련 뉴스',
        selectSignal: '시그널을 선택하세요', noBookmarks: '북마크가 없습니다',
        noBookmarksHint: '별 버튼으로 기사를 저장하세요.',
        socialHero: '글로벌 대화의 흐름', tapFilter: '눌러서 뉴스 필터',
        redditBrief: 'REDDIT 펄스', wikiBrief: 'WIKIPEDIA 펄스', trendClusters: '트렌드 클러스터',
        translateBtn: '번역', theme: '테마', language: '언어',
        notifications: '알림', breakingAlerts: '긴급 알림',
        observe: 'OBSERVE THE WORLD', released: '지구본 회전 재개',
        dragRotate: '드래그 · 줌 · 국가 클릭', cardDownloaded: '공유 카드 다운로드됨',
        bookmarked: '북마크 추가됨', removed: '북마크 제거됨', noteSaved: '메모 저장됨',
        heatExplain: '시그널 히트는 글로벌 뉴스 강도입니다. 최근 기사량, 심각 키워드(분쟁, 시장 충격, 재난), 최신성을 합산합니다. 높을수록 세계 활동이 활발합니다.',
        feedsExplain: '현재 연결되어 유효 데이터를 반환하는 RSS 소스의 수입니다.',
        hotZonesExplain: '최근 7일 기사량과 신호 강도로 국가를 순위화합니다.',
        breakingExplain: '최근 2시간 내 여러 소스에서 동시에 튄 키워드입니다.',
        compactLabel: '컴팩트',
        pool: '신호 풀', showAll: '전체 보기'
    },
    ja: { brandSub: 'OBSERVE THE WORLD', refresh: '更新', settings: '設定', close: '閉じる', search: '世界の信号を検索...', globeTab: '地球儀', socialTab: 'ソーシャル', newsTab: 'ニュース', bookmarksTab: 'ブックマーク', heatLabel: 'シグナル熱', summary: '要約', timeline: '7日間', latest: '最新', observe: 'OBSERVE THE WORLD' },
    zh: { brandSub: 'OBSERVE THE WORLD', refresh: '刷新', settings: '设置', close: '关闭', search: '搜索世界信号...', globeTab: '地球', socialTab: '社交', newsTab: '新闻', bookmarksTab: '书签', heatLabel: '信号热度', summary: '摘要', timeline: '7天', latest: '最新', observe: 'OBSERVE THE WORLD' },
    es: { brandSub: 'OBSERVE THE WORLD', refresh: 'ACTUALIZAR', settings: 'AJUSTES', close: 'CERRAR', search: 'Buscar señales...', globeTab: 'GLOBO', socialTab: 'SOCIAL', newsTab: 'NOTICIAS', bookmarksTab: 'MARCADORES', heatLabel: 'CALOR DE SEÑAL', summary: 'RESUMEN', observe: 'OBSERVE THE WORLD' },
    fr: { brandSub: 'OBSERVE THE WORLD', refresh: 'ACTUALISER', settings: 'RÉGLAGES', close: 'FERMER', search: 'Rechercher...', globeTab: 'GLOBE', socialTab: 'SOCIAL', newsTab: 'ACTUALITÉS', bookmarksTab: 'SIGNETS', heatLabel: 'CHALEUR', summary: 'RÉSUMÉ', observe: 'OBSERVE THE WORLD' },
    ar: { brandSub: 'OBSERVE THE WORLD', refresh: 'تحديث', settings: 'الإعدادات', close: 'إغلاق', search: 'بحث...', globeTab: 'الكرة', socialTab: 'اجتماعي', newsTab: 'أخبار', bookmarksTab: 'إشارات', heatLabel: 'حرارة الإشارة', observe: 'OBSERVE THE WORLD' }
};

// ── STOPWORDS (expanded - country names filtered for issue-centric keywords) ─
const STOPWORDS = new Set([
    'the','and','with','from','after','into','amid','about','this','that','there','their','have','will','just','more','than',
    'been','also','when','what','which','were','your','they','them','said','says','news','live','world','global','breaking',
    'update','thread','first','could','would','today','monday','tuesday','wednesday','thursday','friday','saturday','sunday',
    'over','before','again','here','down','many','most','some','very','then','only','still','such','even','these','those',
    'while','during','through','against','being','because','between','where','while','both','each','other','every','same',
    'should','might','shall','cannot','because','though','without','within','around','above','below','under','since','until',
    'report','reports','reported','according','official','officials','government','statement','statements','week','weeks',
    'year','years','month','months','people','man','woman','says','said','told','tells','added','added','made','make',
    'new','old','big','small','high','low','last','next','now','yes','no','may','one','two','three','four','five',
    'reuters','bbc','cnn','associated','press','afp','bloomberg','the','of','in','on','at','to','for','by','with',
    // 국가명 (이슈 키워드에 노이즈)
    'usa','united','states','america','american','china','chinese','japan','japanese','korea','korean','russia','russian',
    'germany','german','france','french','italy','italian','spain','spanish','britain','british','england','english',
    'india','indian','brazil','brazilian','canada','canadian','australia','australian','mexico','mexican','egypt','egyptian',
    'israel','israeli','iran','iranian','iraq','iraqi','syria','syrian','ukraine','ukrainian','turkey','turkish','poland','polish',
    'taiwan','taiwanese','vietnam','vietnamese','thailand','thai','indonesia','indonesian','singapore','malaysia','philippines',
    '미국','한국','중국','일본','러시아','독일','프랑스','영국','이탈리아','스페인','인도','브라질','캐나다','호주','이란','이라크',
    '시리아','우크라이나','터키','폴란드','대만','베트남','태국','인도네시아','싱가포르','말레이시아','필리핀','북한','남한',
    // 의미 약한 한국어
    '관련','확인','발표','보도','공개','진행','시작','마감','오늘','어제','내일','지난','이번','발생','이슈','문제',
    // 1-2글자 노이즈
    'be','do','go','it','is','as','an','or','if','so','up','my','we','us','he','she','his','her','its','out','off','via'
]);

// ── STATE ───────────────────────────────────────────────────────────────────
const state = {
    lang: (navigator.language || 'en').toLowerCase().startsWith('ko') ? 'ko' : 'en',
    category: 'all',
    country: 'US',
    articleIdx: 0,
    stage: 'globe',
    activeTab: 'news',
    countryModalOpen: false,
    countryModalCode: 'US',
    settingsOpen: false,
    articlesByCountry: {},
    allArticles: [],
    bookmarks: [],
    feedsTotal: RSS_FEEDS.length,
    feedsLoaded: 0,
    refreshSec: REFRESH_INTERVAL / 1000,
    theme: 'default',
    notifications: false,
    panels: { left: true, right: true, dock: false },  // 좌측: 간략 뉴스, 우측: 마커 표시
    layers: { news: true, weather: true, air: true, earthquakes: true, disasters: true },
    fxBase: 'US',
    fxQuote: 'KR',
    fxRate: null,
    fxDate: '',
    aircraft: [],
    aircraftTotal: 0,
    earthquakes: [],
    disasters: [],
    weather: {},
    airQuality: {},
    reddit: [],
    wikipedia: [],
    trendClusters: [],
    globeLocked: false,
    topicFilter: null,
    lastNewsUpdate: '',
    lastAuxUpdate: '',
    countryStatsCache: null,
    countryStatsCacheTime: 0,
    translateCache: {}
};

let globeInstance = null;
let toastTimer = null;
let countdownInterval = null;
let auxInterval = null;
let aircraftRefreshInterval = null;
let aircraftTicker = null;
let searchTimer = null;

// ── UTILITIES ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const make = (tag, cls, txt) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (txt !== undefined && txt !== null) el.textContent = String(txt);
    return el;
};
const clearNode = n => { if (n) n.replaceChildren(); };

function safeText(v, max = 300) {
    return String(v ?? '').replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function safeUrl(input) {
    try {
        const u = new URL(String(input || '').trim(), window.location.href);
        return /^https?:$/i.test(u.protocol) ? u.href : '#';
    } catch { return '#'; }
}

function msg(key) { return (I18N[state.lang] && I18N[state.lang][key]) || I18N.en[key] || key; }
function t(en, ko) { return state.lang === 'ko' ? ko : en; }

function readJson(k, fallback) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fallback; } catch { return fallback; } }
function saveJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { window.AURA?.dbgWarn?.("caught", e); } }

function nowText() {
    const locale = state.lang === 'ko' ? 'ko-KR' : 'en-US';
    return new Intl.DateTimeFormat(locale, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

function relTime(iso) {
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return '--';
    const mins = Math.max(1, Math.floor((Date.now() - ts) / 60000));
    if (mins < 60) return t(`${mins}m`, `${mins}분`);
    if (mins < 1440) return t(`${Math.floor(mins/60)}h`, `${Math.floor(mins/60)}시간`);
    return t(`${Math.floor(mins/1440)}d`, `${Math.floor(mins/1440)}일`);
}

function compactNum(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '--';
    return new Intl.NumberFormat(state.lang === 'ko' ? 'ko-KR' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

function summarize(text, limit = 180) {
    const clean = safeText(String(text || '').replace(/<[^>]+>/g, ' '), 1200);
    return clean.length > limit ? `${clean.slice(0, limit)}...` : clean;
}

function hashArt(title, url) {
    return `${safeText(title, 120).toLowerCase()}__${safeText(url, 240).toLowerCase()}`;
}

function countryByCode(c) { return COUNTRIES.find(x => x.code === c) || COUNTRIES[0]; }
function countryName(c) {
    return c[state.lang] || c.en;
}

function haversineKm(aLat, aLng, bLat, bLng) {
    const r = 6371, toRad = d => d * Math.PI / 180;
    const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
    const sa = Math.sin(dLat/2)**2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng/2)**2;
    return 2 * r * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
}

function nearestEvent(events, country, maxKm = 4500) {
    let best = null;
    events.forEach(e => {
        const d = haversineKm(country.lat, country.lng, e.lat, e.lng);
        if (d <= maxKm && (!best || d < best.distance)) best = { ...e, distance: d };
    });
    return best;
}

// ── SETTINGS LOAD/SAVE ──────────────────────────────────────────────────────
function loadSettings() {
    const s = readJson(SETTINGS_KEY, {});
    if (s.lang) state.lang = s.lang;
    if (s.theme) state.theme = s.theme;
    state.notifications = !!s.notifications;
    if (s.panels) state.panels = { ...state.panels, ...s.panels };
    if (s.layers) state.layers = { ...state.layers, ...s.layers };
    if (s.fxBase) state.fxBase = s.fxBase;
    if (s.fxQuote) state.fxQuote = s.fxQuote;
    if (s.country) state.country = s.country;

    // v583 GeoIP 자동 — v586 강화: lat/lng 저장 (cafe nearby 활성화) +
    // fetchCountryEnv 후 AQI 알약 직접 갱신 (사용자 '오른쪽 위에 공기질/날씨 떴으면').
    try {
        (window.AURA?.safeFetchJson || ((u) => fetch(u).then(r => r.json())))('https://ipapi.co/json/')
            .then(d => {
                if (!d || !d.country_code) return;
                // 1) lat/lng 영구 저장 — nomad-cafes nearby + location-alerts 사용
                if (Number.isFinite(d.latitude) && Number.isFinite(d.longitude)) {
                    try {
                        localStorage.setItem('aura_geoip_v1', JSON.stringify({
                            lat: d.latitude, lng: d.longitude,
                            city: d.city || '', country_code: d.country_code
                        }));
                    } catch (e) {}
                }
                // 2) country 자동 (GLOBAL 일 때만, 사용자 선택 우선)
                if (state.country === 'GLOBAL' && !s.country) {
                    state.country = d.country_code;
                }
                // 3) weather + AQI fetch + 알약 갱신
                try {
                    if (typeof fetchCountryEnv === 'function') {
                        fetchCountryEnv(state.country).then(() => {
                            try {
                                const c = countryByCode(state.country);
                                const w = state.weather?.[state.country];
                                const air = state.airQuality?.[state.country];
                                const cName = (state.lang === 'ko' ? c?.ko : c?.en) || state.country;
                                window.AURA_AQI?.update?.(air?.aqi, cName, w?.temp);
                            } catch (e) {}
                        });
                    }
                    if (typeof renderAll === 'function') renderAll();
                    // nearby cafe widget 새 위치로 갱신
                    if (typeof window.AURA_NOMAD_CAFES?.nearby === 'function') {
                        // nomad-cafes 의 renderNearbyWidget 다음 setInterval (60s) 에 자동 갱신.
                        // 즉시 보이게 해당 함수 직접 호출은 불가 — 대신 alerts widget 갱신 trigger.
                    }
                } catch (e) {}
            })
            .catch(() => {});
    } catch (e) {}

    // 방어막: 두 패널 모두 false면 사용자가 다시 못 열 수 있음 → 강제 복구
    if (!state.panels.left && !state.panels.right) {
        state.panels.left = true;
        state.panels.right = true;
    }
    // v580/v589 데스크톱은 좌/우 drawer 항상 보이도록 강제 (사용자 '뉴스 패널 없음').
    // 모바일은 hidden 상태 그대로 (5탭 dock 으로 access).
    if (typeof window !== 'undefined' && window.innerWidth > 768) {
        state.panels.right = true;
        state.panels.left = true;
    }

    // 사용자 보고: "오른쪽 패널에 뉴스 달아줘 패널이 없어" — 우측 패널 강제 표시 (1회 마이그레이션)
    // 한 번이라도 패널을 본 적 있도록 v1 플래그로 리셋. 사용자는 이후 토글 가능.
    try {
        if (localStorage.getItem('aura_panel_right_seen_v1') !== '1') {
            state.panels.right = true;
            state.panels.left = true;
            localStorage.setItem('aura_panel_right_seen_v1', '1');
        }
    } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
}

function saveSettings() {
    saveJson(SETTINGS_KEY, {
        lang: state.lang, theme: state.theme, notifications: state.notifications,
        panels: state.panels, layers: state.layers, fxBase: state.fxBase, fxQuote: state.fxQuote,
        country: state.country
    });
}

function loadStoredArticles() {
    const items = readJson(STORAGE_KEY, []);
    return Array.isArray(items) ? items.filter(a => {
        const ts = new Date(a.publishedAt).getTime();
        return Number.isFinite(ts) && ts > Date.now() - SEVEN_DAYS_MS;
    }) : [];
}

function saveStoredArticles(items) { saveJson(STORAGE_KEY, items.slice(0, MAX_ARTICLES)); }

function cleanOld(items) {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    return items.filter(a => {
        const ts = new Date(a.publishedAt).getTime();
        return Number.isFinite(ts) && ts > cutoff;
    });
}

function loadIntel() {
    const c = readJson(INTEL_KEY, {});
    state.aircraft = Array.isArray(c.aircraft) ? c.aircraft : [];
    state.aircraftTotal = Number(c.aircraftTotal) || 0;
    state.earthquakes = Array.isArray(c.earthquakes) ? c.earthquakes : [];
    state.disasters = Array.isArray(c.disasters) ? c.disasters : [];
    state.weather = c.weather || {};
    state.airQuality = c.airQuality || {};
    state.reddit = Array.isArray(c.reddit) ? c.reddit : [];
    state.wikipedia = Array.isArray(c.wikipedia) ? c.wikipedia : [];
    state.trendClusters = Array.isArray(c.trendClusters) ? c.trendClusters : [];
    state.fxRate = c.fxRate || null;
    state.fxDate = c.fxDate || '';
    state.lastAuxUpdate = c.lastAuxUpdate || '';
}

function saveIntel() {
    saveJson(INTEL_KEY, {
        aircraftTotal: state.aircraftTotal,
        earthquakes: state.earthquakes, disasters: state.disasters,
        weather: state.weather, airQuality: state.airQuality,
        reddit: state.reddit, wikipedia: state.wikipedia,
        trendClusters: state.trendClusters,
        fxRate: state.fxRate, fxDate: state.fxDate, lastAuxUpdate: state.lastAuxUpdate
    });
}

// ── CLASSIFICATION ──────────────────────────────────────────────────────────
function classifyCountry(text) {
    const l = String(text || '').toLowerCase();
    for (const c of COUNTRIES) {
        if (c.code === 'GLOBAL') continue;
        if (c.kw.some(k => l.includes(k))) return c.code;
    }
    return 'GLOBAL';
}

function classifyCategory(text) {
    const l = String(text || '').toLowerCase();
    if (/(war|attack|missile|military|conflict|airstrike|troop|sanction|ceasefire|bombing|shelling)/.test(l)) return 'conflict';
    if (/(inflation|central bank|market|economy|trade|interest rate|gdp|recession|tariff|export|stock|federal reserve)/.test(l)) return 'economy';
    if (/(artificial intelligence|\bai\b|chip|semiconductor|technology|software|cyber|robot|startup)/.test(l)) return 'tech';
    if (/(health|disease|hospital|virus|vaccine|pandemic|cancer|medical|outbreak)/.test(l)) return 'health';
    if (/(election|parliament|congress|legislation|policy|president|minister|senate|vote|political)/.test(l)) return 'politics';
    if (/(company|corporate|merger|acquisition|earnings|ipo|investment|manufacturing|industry)/.test(l)) return 'business';
    return 'world';
}

function scoreArticle(a) {
    const text = `${a.title} ${a.summary}`.toLowerCase();
    let s = 3;
    if (/(war|missile|attack|military|conflict|sanction)/.test(text)) s += 12;
    if (/(inflation|market|rate|tariff|oil|trade)/.test(text)) s += 8;
    if (/(election|policy|minister|president|parliament)/.test(text)) s += 7;
    if (/(earthquake|wildfire|storm|flood|evacuation)/.test(text)) s += 6;
    if (/(\bai\b|chip|semiconductor|startup)/.test(text)) s += 5;
    const mins = Math.max(1, Math.floor((Date.now() - new Date(a.publishedAt).getTime()) / 60000));
    if (mins < 60) s += 5;
    else if (mins < 360) s += 3;
    else if (mins < 1440) s += 1;
    return s;
}

function aggregateByCountry(articles) {
    const map = {};
    COUNTRIES.forEach(c => { map[c.code] = []; });
    articles.forEach(a => { const c = a.countryCode || 'GLOBAL'; if (!map[c]) map[c] = []; map[c].push(a); });
    Object.keys(map).forEach(k => map[k].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)));
    return map;
}

function countryStats() {
    const now = Date.now();
    if (state.countryStatsCache && now - state.countryStatsCacheTime < 30000) return state.countryStatsCache;

    // 지진/재난 카운트 (대략 위경도 기반)
    const eqCounts = {};
    const dsCounts = {};
    (state.earthquakes || []).forEach(eq => {
        const c = nearestCountryByLatLng(eq.lat, eq.lng);
        if (c) eqCounts[c] = (eqCounts[c] || 0) + 1;
    });
    (state.disasters || []).forEach(d => {
        const c = nearestCountryByLatLng(d.lat, d.lng);
        if (c) dsCounts[c] = (dsCounts[c] || 0) + 1;
    });

    const stats = COUNTRIES.map(c => {
        const items = state.articlesByCountry[c.code] || [];
        let score = items.length * 8;
        items.forEach(i => { score += scoreArticle(i); });
        return {
            ...c,
            newsCount: items.length,
            earthquakes: eqCounts[c.code] || 0,
            disasters: dsCounts[c.code] || 0,
            score: Math.min(99.9, Number(score.toFixed(1)))
        };
    }).sort((a, b) => b.newsCount - a.newsCount || b.score - a.score);
    state.countryStatsCache = stats;
    state.countryStatsCacheTime = now;
    return stats;
}

function nearestCountryByLatLng(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    let best = null, bestDist = Infinity;
    for (const c of COUNTRIES) {
        if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
        const dlat = c.lat - lat, dlng = c.lng - lng;
        const d = dlat * dlat + dlng * dlng;
        if (d < bestDist) { bestDist = d; best = c.code; }
    }
    return bestDist < 400 ? best : null;  // 약 20도 이내만
}

function scoreClass(n) {
    if (n >= 20) return 'score-critical';
    if (n >= 10) return 'score-high';
    if (n >= 4) return 'score-mid';
    return 'score-low';
}

// ── KEYWORDS (high quality) ─────────────────────────────────────────────────
function normalizeTokens(text) {
    const matches = String(text || '').toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || [];
    return matches.filter(t => !STOPWORDS.has(t) && t.length >= 3 && t.length <= 24);
}

function titleCase(s) { return s.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' '); }

function collectPhrases(items) {
    const bag = new Map();
    items.forEach(item => {
        const tokens = normalizeTokens(item.title || '');
        new Set(tokens).forEach(tok => bag.set(tok, (bag.get(tok) || 0) + (item.weight || 1) * 0.7));
        for (let i = 0; i < tokens.length - 1; i++) {
            if (tokens[i] === tokens[i+1]) continue;
            const phrase = `${tokens[i]} ${tokens[i+1]}`;
            bag.set(phrase, (bag.get(phrase) || 0) + (item.weight || 1) * 1.6);
        }
    });
    return [...bag.entries()].filter(([, s]) => s >= 2.2).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
}

function buildTrendClusters() {
    const weighted = [
        ...state.reddit.map(i => ({ title: i.title, weight: 1.8 })),
        ...state.wikipedia.map(i => ({ title: i.title, weight: 1.5 })),
        ...state.allArticles.slice(0, 50).map(i => ({ title: i.title, weight: 1 }))
    ];
    const phrases = collectPhrases(weighted);
    return phrases.slice(0, 6).map(([phrase, score]) => {
        const kw = phrase.split(' ').filter(Boolean);
        const related = state.allArticles.filter(a => {
            const txt = `${a.title} ${a.summary}`.toLowerCase();
            return kw.every(k => txt.includes(k));
        }).slice(0, 6);
        return { label: titleCase(phrase), score: Number(score.toFixed(1)), keywords: kw, related };
    });
}

function topThemes(items, limit = 6) {
    return collectPhrases(items.slice(0, 40).map(i => ({ title: `${i.title} ${i.summary}`, weight: 1 })))
        .slice(0, limit).map(([p]) => titleCase(p));
}

// ── FETCH ──────────────────────────────────────────────────────────────────
async function fetchText(url, timeout = REQUEST_TIMEOUT) {
    // 1순위: Electron Node.js https (CORS 무관)
    if (window.auraAPI?.fetchRSSOne) {
        try {
            const r = await window.auraAPI.fetchRSSOne(url);
            if (r && r.ok && typeof r.body === 'string' && r.body.length > 0) return r.body;
        } catch (e) { /* fall through */ }
    }
    // 2순위: Cloudflare Worker 프록시 (배포되어 있으면 모든 RSS CORS 통과)
    // index.html의 window.AURA_SERVER 에 worker URL 설정하면 자동 사용
    if (window.AURA_SERVER) {
        try {
            const proxied = `${window.AURA_SERVER}/proxy?url=${encodeURIComponent(url)}`;
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), timeout);
            const r = await fetch(proxied, { signal: ctrl.signal });
            clearTimeout(tid);
            if (r.ok) {
                const txt = await r.text();
                if (safeText(txt, 12)) return txt;
            }
        } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
    }
    const attempts = [url, ...PROXIES.map(p => p(url))];
    for (const a of attempts) {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), timeout);
        try {
            const r = await fetch(a, { cache: 'no-store', signal: ctrl.signal });
            clearTimeout(tid);
            if (!r.ok) continue;
            const txt = await r.text();
            if (safeText(txt, 12)) return txt;
        } catch { clearTimeout(tid); }
    }
    throw new Error('fetch fail');
}

async function fetchJson(url, timeout = REQUEST_TIMEOUT) {
    // Electron 환경 — main.js의 json:fetch가 {ok, body} 반환 (body는 string)
    if (window.auraAPI?.fetchJSON) {
        try {
            const r = await window.auraAPI.fetchJSON(url);
            if (r && r.ok && typeof r.body === 'string') return JSON.parse(r.body);
        } catch (e) { /* fall through */ }
    }
    const attempts = [url, ...PROXIES.map(p => p(url))];
    for (const a of attempts) {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), timeout);
        try {
            const r = await fetch(a, { cache: 'no-store', signal: ctrl.signal });
            clearTimeout(tid);
            if (!r.ok) continue;
            const txt = await r.text();
            if (!txt) continue;
            return JSON.parse(txt);
        } catch { clearTimeout(tid); }
    }
    throw new Error('json fail');
}

function isValidRss(t) {
    const s = String(t || '').trim();
    return s.startsWith('<?xml') || s.startsWith('<rss') || s.startsWith('<feed');
}

function parseRss(xml, src) {
    try {
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        if (doc.querySelector('parsererror')) return [];
        const entries = [...doc.querySelectorAll('item, entry')];
        return entries.map(e => {
            const title = safeText(e.querySelector('title')?.textContent || 'Untitled', 220);
            const desc = safeText(
                e.querySelector('description')?.textContent ||
                e.querySelector('summary')?.textContent ||
                e.querySelector('content')?.textContent || '', 1200);
            const linkNode = e.querySelector('link');
            const rawLink = linkNode?.getAttribute('href') || linkNode?.textContent || '#';
            const link = safeUrl(rawLink);
            const dateText = e.querySelector('pubDate')?.textContent || e.querySelector('published')?.textContent || e.querySelector('updated')?.textContent || '';
            const publishedAt = Number.isFinite(new Date(dateText).getTime()) ? new Date(dateText).toISOString() : new Date().toISOString();
            const combined = `${title} ${desc}`;
            return {
                source: safeText(src, 60),
                title, summary: summarize(desc || title, 200),
                publishedAt, url: link,
                countryCode: classifyCountry(combined),
                category: classifyCategory(combined),
                id: hashArt(title, link)
            };
        }).filter(i => i.url !== '#');
    } catch { return []; }
}

async function fetchAllFeeds(onProgress) {
    const results = [];
    state.feedsLoaded = 0;
    const liveFeeds = RSS_FEEDS.filter(f => (__feedFailures[f.source] || 0) < FEED_FAIL_LIMIT);
    let loaded = 0;
    const BATCH = 3;
    for (let i = 0; i < liveFeeds.length; i += BATCH) {
        const batch = liveFeeds.slice(i, i + BATCH);
        await Promise.allSettled(batch.map(async f => {
            try {
                const xml = await fetchText(f.url);
                if (!isValidRss(xml)) throw new Error('invalid');
                const parsed = parseRss(xml, f.source);
                // 각 article에 bias 정보 부착 (UI에서 라벨 표시용)
                if (f.bias) parsed.forEach(a => { a.bias = f.bias; });
                if (parsed.length) {
                    results.push(...parsed);
                    state.feedsLoaded++;
                    __feedFailures[f.source] = 0;
                } else {
                    __feedFailures[f.source] = (__feedFailures[f.source] || 0) + 1;
                }
            } catch {
                __feedFailures[f.source] = (__feedFailures[f.source] || 0) + 1;
            }
            loaded++;
            onProgress && onProgress(loaded, liveFeeds.length, f.source);
        }));
        await new Promise(r => setTimeout(r, 80));
    }
    return results;
}

function mergeArticles(oldA, newA) {
    const map = new Map();
    [...oldA, ...newA].forEach(a => map.set(a.id, a));
    return [...map.values()].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).slice(0, MAX_ARTICLES);
}

// ── TRANSLATION (영구 캐시 + 일일 쿼터 + 인플라이트 디듀프 + 다중 fallback) ───
const TRANSLATE_QUOTA_KEY = 'aura_translate_quota_v1';
const TRANSLATE_DAILY_LIMIT = 800; // MyMemory 1000자/일 한도 - 안전 마진
const __inflightTranslations = new Map(); // 같은 텍스트 중복 요청 방지

function getTranslateQuota() {
    try {
        const raw = localStorage.getItem(TRANSLATE_QUOTA_KEY);
        const today = new Date().toISOString().slice(0, 10);
        if (!raw) return { date: today, used: 0 };
        const data = JSON.parse(raw);
        if (data.date !== today) return { date: today, used: 0 };
        return data;
    } catch {
        return { date: new Date().toISOString().slice(0, 10), used: 0 };
    }
}

function bumpTranslateQuota(chars) {
    try {
        const q = getTranslateQuota();
        q.used += chars;
        localStorage.setItem(TRANSLATE_QUOTA_KEY, JSON.stringify(q));
    } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
}

async function translateText(text, target) {
    if (!text || (state.lang === 'en' && target === 'en')) return text;
    if (text.length < 3) return text;

    const cacheKey = `${target}_${text.slice(0, 80)}`;

    // 1. 메모리 캐시
    if (state.translateCache[cacheKey]) return state.translateCache[cacheKey];

    // 2. 인플라이트 디듀프 (같은 텍스트 동시 요청 → 1번만)
    if (__inflightTranslations.has(cacheKey)) {
        return __inflightTranslations.get(cacheKey);
    }

    const truncated = text.slice(0, 500);
    const promise = (async () => {
        const sources = [];

        // 1순위: 서버 프록시 (CORS 안전 + 캐시 공유)
        if (window.AURA_SERVER) {
            sources.push({
                name: 'server',
                url: `${window.AURA_SERVER}/translate?q=${encodeURIComponent(truncated)}&to=${target}`,
                parse: (d) => d?.text,
                countQuota: false
            });
        }

        // 2순위: MyMemory (일일 한도 체크 + GET CORS 허용)
        const quota = getTranslateQuota();
        if (quota.used + truncated.length <= TRANSLATE_DAILY_LIMIT) {
            sources.push({
                name: 'mymemory',
                url: `https://api.mymemory.translated.net/get?q=${encodeURIComponent(truncated)}&langpair=en|${target}`,
                parse: (d) => d?.responseData?.translatedText,
                countQuota: true,
                chars: truncated.length
            });
        }

        // LibreTranslate 인스턴스들은 거의 다 죽거나 CORS 막힘 → 제거
        // 서버 미설정 + MyMemory 한도 초과 = 번역 안됨 (원본 표시)

        for (const src of sources) {
            try {
                let data;
                if (src.method === 'POST') {
                    const ctrl = new AbortController();
                    const tid = setTimeout(() => ctrl.abort(), 6000);
                    const res = await fetch(src.url, {
                        method: 'POST', body: src.body, headers: src.headers,
                        signal: ctrl.signal
                    });
                    clearTimeout(tid);
                    if (!res.ok) continue;
                    data = await res.json();
                } else {
                    data = await fetchJson(src.url, 6000);
                }
                const result = src.parse(data);
                if (result && typeof result === 'string' && result.length > 0 && result !== truncated) {
                    state.translateCache[cacheKey] = result;
                    if (src.countQuota) bumpTranslateQuota(src.chars || truncated.length);
                    // LRU: 300개 초과 시 50개 제거
                    // 캐시 cap 강화: 200개 초과 시 100개 제거 (localStorage 무한 성장 차단)
                    const keys = Object.keys(state.translateCache);
                    if (keys.length > 200) keys.slice(0, 100).forEach(k => delete state.translateCache[k]);
                    try { saveJson(TRANSLATE_KEY, state.translateCache); } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
                    return result;
                }
            } catch (e) { /* 다음 소스 시도 */ }
        }
        return text; // 전부 실패 → 원본
    })();

    __inflightTranslations.set(cacheKey, promise);
    try {
        return await promise;
    } finally {
        __inflightTranslations.delete(cacheKey);
    }
}

async function maybeTranslateArticle(article) {
    if (state.lang === 'en') return article;
    if (article.translatedLang === state.lang) return article;
    const titleT = await translateText(article.title, state.lang);
    const summaryT = await translateText(article.summary, state.lang);
    article.titleTranslated = titleT;
    article.summaryTranslated = summaryT;
    article.translatedLang = state.lang;
    return article;
}

// ── AIRCRAFT ────────────────────────────────────────────────────────────────
async function fetchAircraft() {
    try {
        const j = await fetchJson('https://opensky-network.org/api/states/all', 10000);
        const states = Array.isArray(j.states) ? j.states : [];
        const mapped = states.filter(r => Array.isArray(r) && Number.isFinite(Number(r[5])) && Number.isFinite(Number(r[6])))
            .map(r => ({
                id: `${safeText(r[0] || Math.random(), 24)}_${Number(r[5]).toFixed(2)}_${Number(r[6]).toFixed(2)}`,
                callsign: safeText(r[1] || 'FLT', 12),
                origin: safeText(r[2] || 'N/A', 8),
                lng: Number(r[5]), lat: Number(r[6]),
                velocity: Math.max(0, Number(r[9]) || 0),
                heading: Number(r[10]) || 0,
                altitude: Number(r[13]) || 0,
                seenAt: Date.now()
            }))
            .filter(r => Math.abs(r.lat) <= 90 && Math.abs(r.lng) <= 180)
            .sort((a, b) => b.velocity - a.velocity);
        state.aircraftTotal = mapped.length;
        state.aircraft = mapped.slice(0, 350);
        return state.aircraft;
    } catch { return state.aircraft; }
}

// ── EARTHQUAKES ─────────────────────────────────────────────────────────────
async function fetchEarthquakes() {
    try {
        const j = await fetchJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
        const items = Array.isArray(j.features) ? j.features : [];
        return items.map(f => ({
            id: safeText(f.id, 60),
            title: safeText(f.properties?.place || 'Unknown', 120),
            magnitude: Number(f.properties?.mag) || 0,
            time: new Date(f.properties?.time || Date.now()).toISOString(),
            lat: Number(f.geometry?.coordinates?.[1]),
            lng: Number(f.geometry?.coordinates?.[0]),
            depth: Number(f.geometry?.coordinates?.[2]) || 0,
            url: safeUrl(f.properties?.url)
        })).filter(i => Number.isFinite(i.lat) && Number.isFinite(i.lng)).sort((a, b) => b.magnitude - a.magnitude);
    } catch { return []; }
}

async function fetchDisasters() {
    try {
        const j = await fetchJson('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50');
        const events = Array.isArray(j.events) ? j.events : [];
        return events.map(e => {
            const g = Array.isArray(e.geometry) ? [...e.geometry].reverse().find(x => Array.isArray(x.coordinates) && x.coordinates.length >= 2) : null;
            const c = g?.coordinates || [0, 0];
            return {
                id: safeText(e.id || e.title, 80),
                title: safeText(e.title || 'Event', 140),
                category: safeText(e.categories?.[0]?.title || 'Disaster', 40),
                lat: Number(c[1]), lng: Number(c[0]),
                date: g?.date || new Date().toISOString()
            };
        }).filter(i => Number.isFinite(i.lat) && Number.isFinite(i.lng));
    } catch { return []; }
}

async function fetchCountryEnv(code) {
    const c = countryByCode(code);
    if (!c || code === 'GLOBAL') return;
    try {
        const w = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&current=temperature_2m,wind_speed_10m,weather_code&timezone=auto`);
        if (w?.current) state.weather[code] = { temp: Number(w.current.temperature_2m), wind: Number(w.current.wind_speed_10m), code: Number(w.current.weather_code) };
    } catch (e) { window.AURA?.dbgWarn?.("caught", e); }
    try {
        const a = await fetchJson(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${c.lat}&longitude=${c.lng}&current=us_aqi,pm2_5,pm10&timezone=auto`);
        if (a?.current) state.airQuality[code] = { aqi: Number(a.current.us_aqi), pm25: Number(a.current.pm2_5), pm10: Number(a.current.pm10) };
    } catch (e) { window.AURA?.dbgWarn?.("caught", e); }

    // 도시별 날씨/대기질 (CITIES_BY_COUNTRY 사용)
    const cities = window.AURA_CITIES?.CITIES_BY_COUNTRY?.[code] || [];
    if (!state.cityWeather) state.cityWeather = {};
    if (!state.cityAir) state.cityAir = {};
    if (cities.length > 0) {
        // Promise.allSettled로 병렬 (캐시되어 있어 빠름)
        await Promise.allSettled(cities.map(async (city) => {
            const key = `${city.lat},${city.lng}`;
            // 30분 이내 캐시면 스킵
            const cached = state.cityWeather[key];
            if (cached && (Date.now() - (cached.ts || 0)) < 1800000) return;
            try {
                const w = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lng}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&timezone=auto`);
                if (w?.current) {
                    state.cityWeather[key] = {
                        temp: Number(w.current.temperature_2m),
                        feels: Number(w.current.apparent_temperature),
                        humidity: Number(w.current.relative_humidity_2m),
                        code: Number(w.current.weather_code),
                        ts: Date.now()
                    };
                }
            } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
            try {
                const a = await fetchJson(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.lat}&longitude=${city.lng}&current=us_aqi,pm2_5,pm10`);
                if (a?.current) {
                    state.cityAir[key] = {
                        aqi: Number(a.current.us_aqi),
                        pm25: Number(a.current.pm2_5),
                        pm10: Number(a.current.pm10),
                        ts: Date.now()
                    };
                }
            } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
        }));
    }
}

// 환율 캐시 (1시간 영구)
const FX_CACHE_KEY = 'aura_fx_cache_v1';
function getFxCache() {
    try {
        const raw = localStorage.getItem(FX_CACHE_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (Date.now() - obj.ts > 3600 * 1000) return null;
        return obj.data;
    } catch { return null; }
}
function setFxCache(data) {
    try { localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
}

async function fetchFx(baseCode, quoteCode) {
    const base = countryByCode(baseCode), quote = countryByCode(quoteCode);
    if (!base || !quote || base.currency === quote.currency) {
        state.fxRate = base.currency === quote.currency ? 1 : null;
        state.fxDate = '';
        return;
    }

    // 1. 캐시 먼저 (즉시 응답)
    const cached = getFxCache();
    if (cached?.rates) {
        const r = cached.rates[quote.currency] / (cached.rates[base.currency] || 1);
        if (Number.isFinite(r)) {
            state.fxRate = r;
            state.fxDate = cached.date || '';
        }
    }

    // 2. 다중 소스 fetch (background)
    const sources = [
        // 1순위: Worker 프록시 (CORS 안전)
        () => window.AURA_SERVER ? fetchJson(`${window.AURA_SERVER}/currency`) : Promise.reject(),
        // 2순위: 직접
        () => fetchJson(`https://api.frankfurter.app/latest?from=USD`),
        // 3순위: open.er-api.com (CORS 허용)
        () => fetchJson(`https://open.er-api.com/v6/latest/USD`).then(j => ({ rates: j.rates, date: j.time_last_update_utc?.slice(5, 16) })),
        // 4순위: exchangerate.host
        () => fetchJson(`https://api.exchangerate.host/latest?base=USD`)
    ];

    for (const src of sources) {
        try {
            const j = await src();
            if (j?.rates && Object.keys(j.rates).length > 5) {
                j.rates.USD = 1;
                setFxCache(j);
                const r = j.rates[quote.currency] / (j.rates[base.currency] || 1);
                if (Number.isFinite(r)) {
                    state.fxRate = r;
                    state.fxDate = safeText(j.date || '', 20);
                    return;
                }
            }
        } catch (e) { /* 다음 소스 */ }
    }

    // 5순위: 정적 fallback (대략적, API 다 막혔을 때)
    const STATIC_RATES = {
        USD: 1, KRW: 1380, JPY: 155, EUR: 0.92, GBP: 0.79, CNY: 7.25,
        AUD: 1.52, CAD: 1.37, CHF: 0.91, INR: 83.5, BRL: 5.1, MXN: 17.2,
        SGD: 1.35, THB: 36.5, TRY: 32.5, HKD: 7.82, NZD: 1.66, NOK: 10.6,
        SEK: 10.7, RUB: 92.5, IDR: 16100, MYR: 4.75, PHP: 56.5, VND: 25400
    };
    if (STATIC_RATES[quote.currency] && STATIC_RATES[base.currency]) {
        state.fxRate = STATIC_RATES[quote.currency] / STATIC_RATES[base.currency];
        state.fxDate = '~' + new Date().toISOString().slice(0, 10);
    }
}

// Reddit JSON 엔드포인트는 CORS 통과 (RSS는 막힘) — 안정적 뉴스 소스로 활용
async function fetchReddit() {
    try {
        // 주요 글로벌 뉴스 subreddit 5개
        const subs = ['worldnews', 'news', 'technology', 'science', 'WorldEvents'];
        const all = [];
        for (const sub of subs) {
            try {
                const data = await fetchJson(`https://www.reddit.com/r/${sub}/hot.json?limit=8`);
                const posts = (data?.data?.children || [])
                    .map(c => c.data)
                    .filter(p => !p.stickied && p.title);
                posts.forEach(p => {
                    // 제목에서 국가 키워드 매칭 → 우측 패널 국가별 뉴스에 잡히게
                    const title = (p.title || '').toLowerCase();
                    let cc = 'GLOBAL';
                    for (const c of COUNTRIES) {
                        if (c.code === 'GLOBAL') continue;
                        if ((c.kw || []).some(k => title.includes(k.toLowerCase()))) {
                            cc = c.code;
                            break;
                        }
                    }
                    all.push({
                        id: 'reddit_' + p.id,
                        source: 'r/' + sub,
                        title: safeText(p.title, 220),
                        summary: safeText(p.selftext || p.title, 200),
                        url: p.url_overridden_by_dest || `https://reddit.com${p.permalink}`,
                        publishedAt: new Date(p.created_utc * 1000).toISOString(),
                        category: sub === 'technology' ? 'tech' : sub === 'science' ? 'science' : 'news',
                        countryCode: cc,
                        score: p.score || 0
                    });
                });
            } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
        }
        return all.slice(0, 30);
    } catch { return []; }
}

async function fetchWikipedia() {
    try {
        const y = new Date(Date.now() - 86400000);
        const ys = y.getUTCFullYear(), ms = String(y.getUTCMonth() + 1).padStart(2, '0'), ds = String(y.getUTCDate()).padStart(2, '0');
        const top = await fetchJson(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${ys}/${ms}/${ds}`);
        const arts = Array.isArray(top.items?.[0]?.articles) ? top.items[0].articles : [];
        const targets = arts.filter(a => a.article && !a.article.startsWith('Special:') && !a.article.includes('Main_Page')).slice(0, 6);
        const detailed = await Promise.allSettled(targets.map(async e => {
            const s = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(e.article)}`);
            return {
                title: safeText(s.title || e.article.replace(/_/g, ' '), 120),
                views: Number(e.views) || 0,
                summary: summarize(s.extract || '', 200),
                url: safeUrl(s.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(e.article)}`)
            };
        }));
        return detailed.filter(x => x.status === 'fulfilled').map(x => x.value);
    } catch { return []; }
}

// ── TOPIC FILTER ────────────────────────────────────────────────────────────
function topicFilterFromPreset(kind) {
    const presets = {
        weather: { label: t('Weather', '날씨'), kw: ['weather', 'storm', 'rain', 'heat', 'climate', 'typhoon', 'cold'] },
        air: { label: t('Air Quality', '대기질'), kw: ['air quality', 'pollution', 'smog', 'pm2', 'dust', 'wildfire smoke'] },
        earthquake: { label: t('Earthquake', '지진'), kw: ['earthquake', 'quake', 'seismic', 'aftershock', 'tremor'] },
        disaster: { label: t('Disaster', '재난'), kw: ['wildfire', 'flood', 'storm', 'hurricane', 'cyclone', 'volcano', 'evacuation'] }
    };
    return presets[kind];
}

function topicFilterFromPhrase(label, keywords) {
    return { label, kw: keywords.filter(Boolean) };
}

function matchesTopic(article, filter) {
    if (!filter || !filter.kw?.length) return true;
    const h = `${article.title} ${article.summary}`.toLowerCase();
    return filter.kw.some(k => h.includes(k.toLowerCase()));
}

function applyTopicFilter(filter) {
    state.topicFilter = filter;
    state.articleIdx = 0;
    renderRightPanel();
    renderCountryModal();
    renderStageHud();
}

function clearTopicFilter() {
    state.topicFilter = null;
    state.articleIdx = 0;
    renderRightPanel();
    renderCountryModal();
    renderStageHud();
}

function getNewsPool() {
    const query = safeText($('searchInput')?.value || '', 80).toLowerCase();
    const base = query || state.topicFilter ? state.allArticles : (state.articlesByCountry[state.country] || []);
    let filtered = base.filter(a => state.category === 'all' || a.category === state.category);
    if (state.topicFilter) filtered = filtered.filter(a => matchesTopic(a, state.topicFilter));
    if (query) filtered = filtered.filter(a => {
        const h = `${a.title} ${a.summary}`.toLowerCase();
        return h.includes(query);
    });
    return filtered.sort((a, b) => scoreArticle(b) - scoreArticle(a) || new Date(b.publishedAt) - new Date(a.publishedAt)).slice(0, 30);
}

// ── UI HELPERS ──────────────────────────────────────────────────────────────
function showToast(message, type = 'ok', dur = 2600) {
    const toast = $('toast');
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.className = `toast toast-${type}`;
    clearNode(toast);
    toast.appendChild(make('span', 'toast-dot'));
    toast.appendChild(make('span', '', safeText(message, 180)));
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
    toastTimer = setTimeout(() => toast.classList.remove('show'), dur);
}

function setStatus(type, label) {
    const dot = $('statusDot'), text = $('feedStatus');
    if (dot) dot.className = `sys-dot ${type}`;
    if (text) text.textContent = label;
}

function setLoadingProgress(pct, status, detail) {
    const bar = $('loadingBar'), s = $('loadingStatus'), d = $('loadingDetail');
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    if (s) s.textContent = status;
    if (d) d.textContent = detail;
}

function hideLoading() {
    const o = $('loadingOverlay');
    if (!o) return;
    o.classList.add('fade-out');
    setTimeout(() => o.remove(), 350);  // perf: 700ms → 350ms
}

function updateClock() {
    const el = $('datetime');
    if (el) el.textContent = nowText();
}

function applyTheme() {
    document.body.classList.remove('theme-default', 'theme-ice', 'theme-forest', 'theme-sunset', 'theme-purple', 'theme-gold');
    document.body.classList.add(`theme-${state.theme}`);
    if (globeInstance) {
        const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#ff5d50';
        globeInstance.atmosphereColor(accent);
    }
    // v587 사용자 '로딩 막대기 흰색' — theme 무관하게 흰색 강제
    const bar = $('loadingBar');
    if (bar) bar.style.background = 'linear-gradient(90deg, transparent, #ffffff)';

    // 로고는 인라인 SVG로 표시됨 — assets/aura-logo.png 404 폐기 (불필요)
}

function syncPanels() {
    document.body.classList.toggle('left-open', state.panels.left);
    document.body.classList.toggle('right-open', state.panels.right);
    document.body.classList.toggle('dock-open', state.panels.dock);
    // 좌/우 drawer 직접 collapsed 클래스 (양방향 토글 보장)
    const left = document.getElementById('leftDrawer');
    const right = document.querySelector('.right-drawer');
    if (left) left.classList.toggle('collapsed', !state.panels.left);
    if (right) right.classList.toggle('collapsed', !state.panels.right);
    // 토글 버튼 텍스트
    const lBtn = document.getElementById('toggleLeftBtn');
    const rBtn = document.getElementById('toggleRightBtn');
    if (lBtn) lBtn.textContent = state.panels.left ? '−' : '+';
    if (rBtn) rBtn.textContent = state.panels.right ? '−' : '+';
}

function togglePanel(name) {
    state.panels[name] = !state.panels[name];
    syncPanels();
    saveSettings();
    // 패널 열림 시 즉시 컨텐츠 갱신 (state.allArticles 가 아직 정착 전이면 재호출)
    if (name === 'left' && state.panels.left && typeof renderLeftNews === 'function') {
        try { renderLeftNews(); } catch (e) { /* */ }
    }
}
// 외부 (mobile-map.js 등) 에서 호출 가능하도록 노출
window.togglePanel = togglePanel;
window.renderLeftNews = function() {
    try { renderLeftNews(); } catch (e) { /* */ }
};

function applyLang() {
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = msg(n.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach(n => { n.placeholder = msg(n.dataset.i18nPh); });
    renderCategorySelect();
    renderCountrySelects();
    renderFxSelects();
}

// ── RENDER: SELECTS ─────────────────────────────────────────────────────────
function renderCategorySelect() {
    const s = $('categorySelect');
    if (!s) return;
    clearNode(s);
    ['all','world','economy','tech','conflict','health','politics','business'].forEach(v => {
        const keys = { all: 'allCat', world: 'world', economy: 'economy', tech: 'tech', conflict: 'conflict', health: 'health', politics: 'politics', business: 'business' };
        const o = document.createElement('option');
        o.value = v;
        o.textContent = msg(keys[v]);
        if (v === state.category) o.selected = true;
        s.appendChild(o);
    });
}

function renderCountrySelects() {
    const main = $('countrySelect');
    if (main) {
        clearNode(main);
        countryStats().filter(c => c.code !== 'GLOBAL').forEach(c => {
            const o = document.createElement('option');
            o.value = c.code;
            o.textContent = `${c.flag} ${countryName(c)}`;
            if (c.code === state.country) o.selected = true;
            main.appendChild(o);
        });
    }
}

function renderFxSelects() {
    [['fxBaseSelect', 'fxBase'], ['fxQuoteSelect', 'fxQuote']].forEach(([id, key]) => {
        const s = $(id);
        if (!s) return;
        clearNode(s);
        COUNTRIES.filter(c => c.code !== 'GLOBAL' && c.currency).forEach(c => {
            const o = document.createElement('option');
            o.value = c.code;
            o.textContent = `${c.flag} ${c.currency}`;
            if (c.code === state[key]) o.selected = true;
            s.appendChild(o);
        });
    });
}

// ── HOT ZONES ───────────────────────────────────────────────────────────────
function renderHotZones() {
    const c = $('hotZonesList');
    if (!c) return;
    clearNode(c);
    countryStats().filter(x => x.code !== 'GLOBAL').slice(0, 10).forEach((country, i) => {
        const row = make('div', `hotzone-row${country.code === state.country ? ' active' : ''}`);
        row.appendChild(make('span', 'hotzone-rank', i + 1));
        const name = make('div', 'hotzone-name');
        name.appendChild(make('span', 'hz-flag', country.flag));
        name.appendChild(make('span', 'hz-label', countryName(country)));
        row.appendChild(name);
        row.appendChild(make('span', `hotzone-count ${scoreClass(country.newsCount)}`, country.newsCount));
        row.addEventListener('click', () => selectCountry(country.code, true));
        c.appendChild(row);
    });
}

// ── LEFT PANEL: 국기 list + 오늘 뉴스 요약 (사용자 v587 spec) ───────────────
// 모바일은 mobile-map.js 의 renderMobileCountryNews 가 처리 (좁은 64px 알약 column).
// 데스크톱: 국기 + 국가명 + 오늘 top 뉴스 요약 + 시그널 카운트 (240px 폭).
function renderLeftNews() {
    const c = document.getElementById('leftNewsList');
    if (!c) return;
    const isMobile = window.innerWidth <= 768;
    if (isMobile && typeof window.renderMobileCountryNews === 'function') {
        try { window.renderMobileCountryNews(); return; } catch (e) {}
    }
    const COUNTRIES = window.AURA_COUNTRIES || [];
    const byCountry = state.articlesByCountry || {};
    clearNode(c);
    // 오늘 뉴스 있는 국가만 + 시그널 많은 순
    let active = COUNTRIES
        .filter(co => co.code !== 'GLOBAL')
        .map(co => {
            const arts = byCountry[co.code] || [];
            return { ...co, count: arts.length, top: arts[0] };
        })
        .filter(co => co.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 18);

    // v589 사용자 '왼쪽 패널 뉴스 아직 없음' fallback — articlesByCountry 비어있으면
    // allArticles 에서 country 추정해서 채움.
    if (!active.length) {
        const all = state.allArticles || [];
        if (all.length) {
            // allArticles 의 source 기반 가짜 grouping (전체 뉴스 표시)
            active = COUNTRIES.filter(co => co.code !== 'GLOBAL').slice(0, 12).map((co, i) => ({
                ...co, count: 0, top: all[i % all.length]
            }));
        }
    }

    if (!active.length) {
        const empty = make('div', 'left-news-empty');
        empty.textContent = (state.lang === 'ko') ? '뉴스 로딩 중...' : 'Loading news…';
        c.appendChild(empty);
        return;
    }
    const isKo = state.lang === 'ko';
    active.forEach(co => {
        const card = make('button', 'left-country-card');
        card.type = 'button';
        card.style.cssText = 'display:flex;align-items:center;gap:8px;padding:9px 10px;background:transparent;border:0.5px solid var(--border-glass);border-radius:var(--radius-sm, 10px);cursor:pointer;width:100%;color:var(--text-primary);transition:background .14s var(--ease-linear),border-color .14s;margin-bottom:6px;text-align:left';
        const flag = document.createElement('span');
        flag.textContent = co.flag || '🏳';
        flag.style.cssText = 'font-size:18px;flex-shrink:0;line-height:1';
        const info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0';
        const name = document.createElement('div');
        name.textContent = isKo ? (co.ko || co.code) : (co.en || co.code);
        name.style.cssText = 'font:600 12px/1.2 var(--font-ui);color:var(--text-primary);letter-spacing:var(--ls-ui)';
        const summary = document.createElement('div');
        summary.textContent = co.top?.titleTranslated || co.top?.title || ((isKo ? '오늘 ' : 'today ') + co.count + (isKo ? '건' : ''));
        summary.style.cssText = 'font:500 10px/1.3 var(--font-ui);color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px';
        const cnt = document.createElement('span');
        cnt.textContent = String(co.count);
        cnt.style.cssText = 'font:600 10px/1 var(--font-mono);color:var(--text-tertiary);background:var(--bg-elevated);padding:3px 7px;border-radius:999px;flex-shrink:0;align-self:flex-start;margin-top:2px';
        info.appendChild(name);
        info.appendChild(summary);
        card.appendChild(flag);
        card.appendChild(info);
        card.appendChild(cnt);
        card.addEventListener('mouseenter', () => { card.style.background = 'var(--bg-elevated)'; });
        card.addEventListener('mouseleave', () => { card.style.background = 'transparent'; });
        card.addEventListener('click', () => {
            if (typeof window.openCountryModal === 'function') {
                window.openCountryModal(co.code);
            }
        });
        c.appendChild(card);
    });
}

// ── TIMELINE CHART ──────────────────────────────────────────────────────────
function renderTimeline(items) {
    const canvas = $('timelineChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(canvas.clientWidth || 320);
    const h = 72;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const buckets = {};
    const now = Date.now();
    for (let i = 0; i < 7; i++) buckets[new Date(now - i * 86400000).toISOString().split('T')[0]] = 0;
    items.forEach(item => {
        const k = new Date(item.publishedAt).toISOString().split('T')[0];
        if (k in buckets) buckets[k]++;
    });
    const data = Object.entries(buckets).reverse().map(([date, count]) => ({ date, count }));
    const max = Math.max(...data.map(d => d.count), 1);
    const gap = 6;
    const barW = Math.max(12, Math.floor((w - gap * (data.length + 1)) / data.length));
    const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#ff5d50';
    data.forEach((d, i) => {
        const bh = Math.max(3, Math.round((d.count / max) * 56));
        const x = gap + i * (barW + gap);
        const y = h - bh - 8;
        const grad = ctx.createLinearGradient(0, y, 0, y + bh);
        grad.addColorStop(0, accent + 'ff');
        grad.addColorStop(1, accent + '22');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW, bh);
    });
}

// ── BRIEFING ────────────────────────────────────────────────────────────────
function renderBriefing() {
    const c = countryByCode(state.country);
    const items = (state.articlesByCountry[state.country] || []).slice(0, 28);
    const cats = {};
    items.forEach(i => { cats[i.category] = (cats[i.category] || 0) + 1; });
    const flows = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k.toUpperCase()}(${v})`).join(' · ');
    const lead = items[0];
    const text = state.lang === 'ko'
        ? `· 최근 7일 기사 ${items.length}건 추적 중\n· 주요 흐름: ${flows || '일반'}\n· 최신: ${lead ? safeText(lead.titleTranslated || lead.title, 86) : '데이터 없음'}`
        : `· Tracking ${items.length} stories in 7 days\n· Dominant: ${flows || 'general'}\n· Latest: ${lead ? safeText(lead.title, 90) : 'No data'}`;
    if ($('briefingText')) $('briefingText').textContent = text;
    const tt = $('themeTags');
    if (tt) {
        clearNode(tt);
        topThemes(items, 5).forEach(theme => {
            const chip = make('button', 'theme-tag', theme);
            chip.type = 'button';
            chip.addEventListener('click', () => applyTopicFilter(topicFilterFromPhrase(theme, normalizeTokens(theme))));
            tt.appendChild(chip);
        });
    }
}

// ── NEWS LIST ───────────────────────────────────────────────────────────────
async function renderNewsList() {
    const c = $('newsList');
    if (!c) return;
    const items = getNewsPool();
    // FIX: 중복 렌더 방지. 번역은 optimize.js의 lazy translator가 처리.
    renderNewsList_internal(items);
}

function renderNewsList_internal(items) {
    const c = $('newsList');
    if (!c) return;
    clearNode(c);
    const meta = $('newsPoolMeta');
    if (meta) meta.textContent = state.topicFilter ? state.topicFilter.label : t('All signals', '전체 시그널');

    // 뉴스 0개일 때 친절한 안내 (사용자: 오른쪽 패널에 뉴스 안 보인다)
    if (!items || items.length === 0) {
        const empty = make('div', 'empty-state');
        empty.style.cssText = 'padding: 32px 20px; text-align: center; color: rgba(255,255,255,.6); line-height: 1.6;';
        const isKo = state.lang === 'ko';
        // 검색어 있으면 "검색 결과 없음" / 없으면 "로딩 중"
        const searchQ = ($('searchInput')?.value || '').trim();
        const hasArticles = (state.allArticles || []).length > 0;
        if (searchQ && hasArticles) {
            empty.innerHTML = isKo
                ? `<div style="font-size:32px;margin-bottom:10px">🔍</div>
                   <div style="font-weight:600;color:#e2e8f0;margin-bottom:6px">"${searchQ.replace(/[<>&"']/g, '')}" 검색 결과 없음</div>
                   <div style="font-size:11px;opacity:.7">다른 키워드 또는 국가를 선택해 보세요</div>`
                : `<div style="font-size:32px;margin-bottom:10px">🔍</div>
                   <div style="font-weight:600;color:#e2e8f0;margin-bottom:6px">No results for "${searchQ.replace(/[<>&"']/g, '')}"</div>
                   <div style="font-size:11px;opacity:.7">Try another keyword or country</div>`;
            c.appendChild(empty);
            return;
        }
        empty.innerHTML = isKo
            ? `<div style="font-size:32px;margin-bottom:10px">📰</div>
               <div style="font-weight:600;color:#e2e8f0;margin-bottom:6px">뉴스 로딩 중</div>
               <div style="font-size:11px;opacity:.7">RSS 피드를 가져오는 중입니다.<br>localhost 에선 CORS로 일부 막힐 수 있어요.<br>상단 새로고침 ↻ 또는 다른 국가 선택</div>`
            : `<div style="font-size:32px;margin-bottom:10px">📰</div>
               <div style="font-weight:600;color:#e2e8f0;margin-bottom:6px">Loading news</div>
               <div style="font-size:11px;opacity:.7">Fetching RSS feeds.<br>Some are CORS-blocked on localhost.<br>Try ↻ refresh or another country</div>`;
        c.appendChild(empty);
        return;
    }

    // PERF: 청크 단위 렌더링 (requestIdleCallback 사용 시)
    const renderItem = (item, idx) => {
        const card = make('div', `news-card${idx === state.articleIdx ? ' active' : ''}`);
        card.dataset.articleIdx = idx;
        card.dataset.articleId = item.id;
        // style-color.css가 data-bias 기반 좌측 색상 밴드 적용
        if (item.bias) card.dataset.bias = item.bias;
        const head = make('div', 'news-head');
        head.appendChild(make('span', 'news-pill', item.category.toUpperCase()));
        head.appendChild(make('span', 'news-pill', item.source));
        // 정치 성향 라벨 (사용자 요청: 신뢰성/편파성 표시)
        if (item.bias && BIAS_LABELS[item.bias]) {
            const b = BIAS_LABELS[item.bias];
            const biasPill = make('span', 'news-bias', b.label);
            biasPill.title = b.title;
            biasPill.style.cssText = `background:${b.color}33;color:${b.color};border:1px solid ${b.color}55;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700;font-family:var(--font-mono);letter-spacing:.05em`;
            head.appendChild(biasPill);
        }
        head.appendChild(make('span', 'news-flag', countryByCode(item.countryCode).flag));
        const star = make('button', `bm-toggle${state.bookmarks.some(b => b.id === item.id) ? ' active' : ''}`, '★');
        star.type = 'button';
        star.title = 'Bookmark';
        star.addEventListener('click', e => {
            e.stopPropagation();
            e.preventDefault();
            toggleBookmark(item);
        });
        head.appendChild(star);
        card.appendChild(head);
        const titleEl = make('div', 'news-title', item.titleTranslated || item.title);
        card.appendChild(titleEl);
        const metaEl = make('div', 'news-meta');
        metaEl.appendChild(make('span', '', `${item.source} · ${relTime(item.publishedAt)}`));
        card.appendChild(metaEl);
        card.addEventListener('click', e => {
            // 별 클릭이 카드까지 버블링된 경우 무시 (defense in depth)
            if (e.target.closest('.bm-toggle')) return;
            state.articleIdx = idx; renderNewsList_internal(items); renderDetail();
        });
        c.appendChild(card);
    };
    
    // 처음 8개는 바로, 나머지는 청크로
    const initial = items.slice(0, 8);
    initial.forEach((item, idx) => renderItem(item, idx));
    
    if (items.length > 8 && window.__renderChunked) {
        const rest = items.slice(8);
        window.__renderChunked(rest, (item, localIdx) => renderItem(item, localIdx + 8), 5);
    } else if (items.length > 8) {
        items.slice(8).forEach((item, localIdx) => renderItem(item, localIdx + 8));
    }
    
    // 번역 트리거 (optimize.js가 있으면)
    if (window.__translateVisibleArticles && state.lang !== 'en') {
        setTimeout(() => window.__translateVisibleArticles(), 100);
    }
}

async function renderDetail() {
    const items = getNewsPool();
    const item = items[state.articleIdx];
    const elements = ['detailTitle', 'detailMeta', 'detailSummary', 'articleNote', 'detailLink'].map($);
    if (!item) {
        if (elements[0]) elements[0].textContent = t('Select a signal above', '시그널을 선택하세요');
        if (elements[1]) elements[1].textContent = '';
        if (elements[2]) elements[2].textContent = '';
        if (elements[3]) elements[3].value = '';
        if (elements[4]) { elements[4].href = '#'; elements[4].textContent = msg('openSource'); }
        return;
    }
    if (state.lang !== 'en') await maybeTranslateArticle(item);
    if (elements[0]) elements[0].textContent = item.titleTranslated || item.title;
    if (elements[1]) elements[1].textContent = `${countryByCode(item.countryCode).flag} ${item.source} · ${relTime(item.publishedAt)}`;
    if (elements[2]) elements[2].textContent = item.summaryTranslated || item.summary;
    if (elements[4]) { elements[4].href = item.url; elements[4].textContent = msg('openSource'); }
    const bm = state.bookmarks.find(b => b.id === item.id);
    if (elements[3]) elements[3].value = bm?.note || '';
}

// ── RIGHT PANEL ─────────────────────────────────────────────────────────────
function renderRightPanel() {
    const c = countryByCode(state.country);
    if ($('countryFlagBadge')) $('countryFlagBadge').textContent = c.flag;
    if ($('countryName')) $('countryName').textContent = countryName(c);
    const count = (state.articlesByCountry[state.country] || []).length;
    // v583 사용자: '오른쪽 창에 날씨/미세먼지 알려줘' — country 헤더 옆에 weather + AQI
    const w = state.weather?.[state.country];
    const air = state.airQuality?.[state.country];
    let extras = `${count} ${t('signals', '시그널')}`;
    if (w && Number.isFinite(w.temp)) extras += ` · ☀️ ${w.temp.toFixed(0)}°`;
    if (air && Number.isFinite(air.aqi)) {
        const aqiCol = air.aqi >= 150 ? '🔴' : air.aqi >= 100 ? '🟠' : air.aqi >= 50 ? '🟡' : '🟢';
        extras += ` · ${aqiCol} AQI ${Math.round(air.aqi)}`;
    }
    if ($('headlineCount')) $('headlineCount').textContent = extras;
    const stat = countryStats().find(x => x.code === state.country);
    if ($('pressureValue')) $('pressureValue').textContent = stat ? stat.newsCount : 0;
    renderBriefing();
    renderTimeline((state.articlesByCountry[state.country] || []).slice(0, 28));
    renderNewsList();
    renderDetail();
}

// ── BOOKMARKS ───────────────────────────────────────────────────────────────
function toggleBookmark(article) {
    const idx = state.bookmarks.findIndex(b => b.id === article.id);
    if (idx >= 0) {
        state.bookmarks.splice(idx, 1);
        showToast(msg('removed'));
    } else {
        state.bookmarks.unshift({ ...article, note: '', savedAt: new Date().toISOString() });
        showToast(msg('bookmarked'));
    }
    saveJson(BOOKMARKS_KEY, state.bookmarks);
    renderNewsList();
    renderBookmarks();
}

function renderBookmarks() {
    const c = $('bookmarksTabContent');
    if (!c) return;
    clearNode(c);
    if (!state.bookmarks.length) {
        const e = make('div', 'empty-state');
        e.appendChild(make('div', 'empty-title', msg('noBookmarks')));
        e.appendChild(make('div', 'empty-hint', msg('noBookmarksHint')));
        c.appendChild(e);
        return;
    }
    state.bookmarks.forEach((bm, i) => {
        const card = make('div', 'bookmark-card');
        const head = make('div', 'news-head');
        head.appendChild(make('span', 'news-pill', `${countryByCode(bm.countryCode).flag} ${bm.source}`));
        head.appendChild(make('span', 'news-pill', relTime(bm.savedAt)));
        const rm = make('button', 'bm-toggle active', '★');
        rm.type = 'button';
        rm.addEventListener('click', () => {
            state.bookmarks.splice(i, 1);
            saveJson(BOOKMARKS_KEY, state.bookmarks);
            renderBookmarks();
            renderNewsList();
        });
        head.appendChild(rm);
        card.appendChild(head);
        card.appendChild(make('div', 'news-title', bm.titleTranslated || bm.title));
        card.appendChild(make('div', 'detail-summary', bm.summaryTranslated || bm.summary));
        const note = document.createElement('textarea');
        note.className = 'bm-note';
        note.value = bm.note || '';
        note.placeholder = msg('notePlaceholder');
        note.addEventListener('blur', () => {
            bm.note = safeText(note.value, 600);
            saveJson(BOOKMARKS_KEY, state.bookmarks);
        });
        card.appendChild(note);
        const link = make('a', 'detail-link');
        link.href = safeUrl(bm.url);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = msg('openSource');
        card.appendChild(link);
        c.appendChild(card);
    });
}

function saveCurrentNote() {
    const n = $('articleNote');
    if (!n) return;
    const item = getNewsPool()[state.articleIdx];
    if (!item) return;
    const trimmed = safeText(n.value, 600);
    let bm = state.bookmarks.find(b => b.id === item.id);
    if (!bm && trimmed) {
        bm = { ...item, note: '', savedAt: new Date().toISOString() };
        state.bookmarks.unshift(bm);
    }
    if (bm) {
        bm.note = trimmed;
        saveJson(BOOKMARKS_KEY, state.bookmarks);
        renderBookmarks();
    }
}

// ── COUNTRY MODAL (COMMAND CENTER) ──────────────────────────────────────────
// 스택 기반 스크롤 잠금 — 여러 모달이 동시 열릴 때 안전 (cost-compare + flight 같은 케이스)
let __scrollLockCount = 0;
let __scrollLockPrevOverflow = '';
function lockBodyScroll() {
    if (__scrollLockCount === 0) {
        __scrollLockPrevOverflow = document.body.style.overflow || '';
        document.body.style.overflow = 'hidden';
    }
    __scrollLockCount++;
}
function unlockBodyScroll() {
    if (__scrollLockCount === 0) return;
    __scrollLockCount--;
    if (__scrollLockCount === 0) {
        document.body.style.overflow = __scrollLockPrevOverflow;
        __scrollLockPrevOverflow = '';
    }
}
// 다른 모달 모듈에서 사용할 수 있게 노출
window.AURA_lockScroll = lockBodyScroll;
window.AURA_unlockScroll = unlockBodyScroll;

function openCountryModal(code) {
    state.countryModalOpen = true;
    state.countryModalCode = code;
    renderCountryModal();
    $('countryModal')?.classList.add('open');
    lockBodyScroll();
}

function closeCountryModal() {
    state.countryModalOpen = false;
    $('countryModal')?.classList.remove('open');
    unlockBodyScroll();
}

function renderCountryModal() {
    const modal = $('countryModal');
    if (!modal || !state.countryModalOpen) return;
    const c = countryByCode(state.countryModalCode);
    const w = state.weather[c.code];
    const air = state.airQuality[c.code];
    const quake = nearestEvent(state.earthquakes, c, 3500);
    const disaster = nearestEvent(state.disasters, c, 4500);

    if ($('cmFlag')) $('cmFlag').textContent = c.flag;
    if ($('cmTitle')) $('cmTitle').textContent = countryName(c);
    if ($('cmSubtitle')) $('cmSubtitle').textContent = `${c.code} · ${msg('cmdCenter')}`;

    // Environmental signals
    const signalsEl = $('cmSignals');
    if (signalsEl) {
        clearNode(signalsEl);
        const signals = [
            { key: 'weather', label: msg('nearWeather'), val: w ? `${w.temp.toFixed(1)}°C` : '--', sub: w ? weatherLabel(w.code) : '--' },
            { key: 'air', label: msg('nearAir'), val: air ? `AQI ${Math.round(air.aqi)}` : '--', sub: air ? aqiLabel(air.aqi) : '--' },
            { key: 'earthquake', label: msg('nearQuake'), val: quake ? `M${quake.magnitude.toFixed(1)}` : '--', sub: quake ? safeText(quake.title, 36) : '--' },
            { key: 'disaster', label: msg('nearDisaster'), val: disaster ? disaster.category : '--', sub: disaster ? safeText(disaster.title, 36) : '--' }
        ];
        signals.forEach(s => {
            const card = make('button', 'cm-signal');
            card.type = 'button';
            card.appendChild(make('div', 'cm-signal-label', s.label));
            card.appendChild(make('div', 'cm-signal-val', s.val));
            card.appendChild(make('div', 'cm-signal-sub', s.sub));
            // 사용자 요청: 날씨/AQI 클릭 → 그 나라 도시별 리스트 모달
            if (s.key === 'weather' || s.key === 'air') {
                card.addEventListener('click', () => openCityMetricsModal(c.code, s.key));
            } else {
                card.addEventListener('click', () => applyTopicFilter(topicFilterFromPreset(s.key)));
            }
            signalsEl.appendChild(card);
        });
    }

    // Related news
    const newsEl = $('cmNewsList');
    if (newsEl) {
        clearNode(newsEl);
        let pool = state.articlesByCountry[c.code] || [];
        if (state.topicFilter) pool = pool.filter(a => matchesTopic(a, state.topicFilter));
        pool.slice(0, 12).forEach(item => {
            const card = make('div', 'cm-news-card');
            card.appendChild(make('div', 'news-meta', `${item.source} · ${relTime(item.publishedAt)}`));
            card.appendChild(make('div', 'news-title', item.titleTranslated || item.title));
            const btn = make('button', 'text-btn', t('VIEW', '보기'));
            btn.type = 'button';
            btn.addEventListener('click', () => {
                // v579 사용자 보고 '뉴스 view 눌러도 웹사이트 이동 안됨' fix —
                // 모바일에선 right-drawer 가 hidden 이라 syncPanels() 후 화면 변화 없음.
                // URL 직접 열기 = 가장 정확한 user intent.
                if (item.url) {
                    try { window.open(item.url, '_blank', 'noopener'); } catch (e) {}
                    return;
                }
                // URL 없으면 (드물게) 데스크톱 right-drawer 동기화 fallback
                state.country = c.code;
                state.articleIdx = 0;
                state.panels.right = true;
                syncPanels();
                renderAll();
                closeCountryModal();
            });
            // 카드 자체 클릭도 동일 (사용자가 'VIEW' 라벨 누가 인식 못 할 수도)
            card.style.cursor = 'pointer';
            card.addEventListener('click', (ev) => {
                if (ev.target === btn || btn.contains(ev.target)) return;
                if (item.url) {
                    try { window.open(item.url, '_blank', 'noopener'); } catch (e) {}
                }
            });
            card.appendChild(btn);
            newsEl.appendChild(card);
        });
    }
}

function weatherLabel(code) {
    const labels = {
        0: t('Clear', '맑음'), 1: t('Mostly Clear', '대체로 맑음'), 2: t('Partly Cloudy', '구름 조금'),
        3: t('Overcast', '흐림'), 45: t('Fog', '안개'), 51: t('Drizzle', '이슬비'),
        61: t('Rain', '비'), 63: t('Rain', '비'), 71: t('Snow', '눈'), 95: t('Thunderstorm', '뇌우')
    };
    return labels[Number(code)] || '--';
}

function aqiLabel(a) {
    const n = Number(a);
    if (!Number.isFinite(n)) return '--';
    if (n <= 50) return t('Good', '좋음');
    if (n <= 100) return t('Moderate', '보통');
    if (n <= 150) return t('Unhealthy', '나쁨');
    return t('Very Unhealthy', '매우 나쁨');
}


// ── STAGE HUD ───────────────────────────────────────────────────────────────
function renderStageHud() {
    const p = $('activeTopicPill');
    const clearBtn = $('clearTopicBtn');
    if (p) {
        if (state.topicFilter) {
            p.textContent = state.topicFilter.label;
            p.classList.add('active');
            p.style.display = '';
            if (clearBtn) clearBtn.style.display = '';
        } else {
            // 사용자 보고: "Weather 그냥 뜨는 오류" → 필터 없으면 pill 자체 숨김
            p.classList.remove('active');
            p.style.display = 'none';
            if (clearBtn) clearBtn.style.display = 'none';
        }
    }
}

// ── LAYER CONTROLS (floating bottom right) ──────────────────────────────────
function renderLayerControls() {
    const c = $('layerControls');
    if (!c) return;
    clearNode(c);
    const allEvents = window.AURA_EVENTS?.state?.all || [];
    const concertCount = allEvents.filter(e => e.type === 'concert').length;
    const sportCount = allEvents.filter(e => e.type === 'sport').length;
    const festCount = allEvents.filter(e => e.type === 'festival').length;
    const entries = [
        { key: 'news',        label: t('News', '뉴스'),       count: countryStats().filter(x => x.newsCount > 0).length },
        { key: 'air',         label: t('Air', '대기질'),       count: Object.keys(state.airQuality).length },
        { key: 'earthquakes', label: t('Quakes', '지진'),      count: state.earthquakes.length },
        { key: 'disasters',   label: t('Disasters', '재난'),    count: state.disasters.length },
        { key: 'weather',     label: t('Weather', '날씨'),     count: Object.keys(state.weather).length },
        { key: 'concerts',    label: t('Concerts', '콘서트'),   count: concertCount },
        { key: 'sports',      label: t('Sports', '스포츠'),     count: sportCount }
    ];
    // layers 객체 호환 (concerts/sports 키 추가)
    if (state.layers.concerts === undefined) state.layers.concerts = true;
    if (state.layers.sports === undefined) state.layers.sports = true;
    entries.forEach(e => {
        const btn = make('button', `layer-chip${state.layers[e.key] ? ' active' : ''}`);
        btn.type = 'button';
        btn.title = (state.lang === 'ko'
            ? '클릭: 정보 보기 · 우측 하단 ⚙ 패널에서 마커 ON/OFF'
            : 'Click: open info · Use bottom-right ⚙ to toggle markers');
        btn.appendChild(make('span', `layer-dot dot-${e.key}`));
        btn.appendChild(make('span', 'layer-name', e.label));
        btn.appendChild(make('span', 'layer-count', compactNum(e.count)));
        // 좌클릭 → 카테고리 정보 (날씨/대기질 → 도시별 리스트)
        btn.addEventListener('click', (ev) => {
            ev.preventDefault();
            openCategoryInfo(e.key);
        });
        // 우클릭 → 토글 (대안)
        btn.addEventListener('contextmenu', (ev) => {
            ev.preventDefault();
            state.layers[e.key] = !state.layers[e.key];
            saveSettings();
            renderLayerControls();
            refreshGlobeMarkers();
            if (window.AURA_MARKER_PANEL?.render) window.AURA_MARKER_PANEL.render();
        });
        c.appendChild(btn);
    });
}

// ── CATEGORY INFO MODAL ─────────────────────────────────────────────────────
function openCategoryInfo(key) {
    const isKo = state.lang === 'ko';
    const cur = countryByCode(state.country);
    const titles = {
        news:        { ko: `📰 ${cur.ko} 주요 뉴스`,  en: `📰 ${cur.en} News` },
        air:         { ko: '🌫️ 대기질 정보',         en: '🌫️ Air Quality' },
        earthquakes: { ko: '🌍 최근 지진',           en: '🌍 Recent Earthquakes' },
        disasters:   { ko: '⚠️ 진행 중 재난',         en: '⚠️ Active Disasters' },
        weather:     { ko: '🌤️ 도시별 날씨',          en: '🌤️ City Weather' },
        concerts:    { ko: '🎤 콘서트 일정',          en: '🎤 Concerts' },
        sports:      { ko: '🏆 스포츠 경기',          en: '🏆 Sports' },
        festivals:   { ko: '🎪 축제 일정',            en: '🎪 Festivals' },
        hotspots:    { ko: '🔥 지금 가장 뜨거운 곳',    en: '🔥 Hottest Regions Now' },
        top5:        { ko: '⚡ 오늘의 TOP 5 사건',     en: '⚡ Today\'s TOP 5 Events' },
        travel:      { ko: '✈️ 우리가 추천하는 여행지 (나라별)', en: '✈️ Our Travel Picks (by Country)' },
        movies:      { ko: `🎬 ${cur.ko} 박스오피스`,    en: `🎬 ${cur.en} Box Office` },
        games:       { ko: '🎮 글로벌 게임',             en: '🎮 Global Games' }
    };

    const items = collectCategoryItems(key);
    const title = titles[key]?.[isKo ? 'ko' : 'en'] || key;

    // GA 이벤트
    if (window.AURA_GA) {
        if (key === 'weather') window.AURA_GA.track('weather_view', { country: state.country });
        else if (key === 'air') window.AURA_GA.track('air_quality_view', { country: state.country });
        else window.AURA_GA.track('category_open', { category: key, country: state.country });
    }

    if (window.__showCategoryModal) {
        window.__showCategoryModal(key, title, items);
    }
}

function collectCategoryItems(key) {
    const isKo = state.lang === 'ko';
    const items = [];

    if (key === 'news') {
        // 현재 선택 국가 뉴스 Top 8
        const arts = (state.articlesByCountry?.[state.country] || []).slice(0, 8);
        arts.forEach(a => {
            items.push({
                title: a.titleTranslated || a.title || '',
                meta: `${a.source || ''} · ${formatRelTime(a.publishedAt, isKo)}`,
                url: a.url
            });
        });
    } else if (key === 'air') {
        // 모든 도시 AQI
        Object.keys(state.airQuality || {}).forEach(code => {
            const aq = state.airQuality[code];
            const c = countryByCode(code);
            const cat = window.AURA_CITIES?.aqiCategory(aq.aqi);
            items.push({
                title: `${c.flag || ''} ${isKo ? c.ko : c.en}`,
                meta: `AQI ${Math.round(aq.aqi)} · ${cat ? (isKo ? cat.labelKo : cat.labelEn) : '-'}`,
                color: cat?.color
            });
        });
    } else if (key === 'earthquakes') {
        (state.earthquakes || []).slice(0, 12).forEach(eq => {
            items.push({
                title: `M ${eq.magnitude.toFixed(1)} · ${eq.location || '-'}`,
                meta: `${formatRelTime(eq.time, isKo)} · ${isKo ? '깊이' : 'Depth'} ${eq.depth || '?'}km`,
                url: eq.url
            });
        });
    } else if (key === 'disasters') {
        (state.disasters || []).slice(0, 12).forEach(d => {
            items.push({
                title: `${d.category || ''} · ${d.title || d.location || '-'}`,
                meta: d.location || '-',
                url: d.url
            });
        });
    } else if (key === 'weather') {
        Object.keys(state.weather || {}).forEach(code => {
            const w = state.weather[code];
            const c = countryByCode(code);
            items.push({
                title: `${c.flag || ''} ${isKo ? c.ko : c.en}`,
                meta: `${Math.round(w.temp)}°C · ${w.condition || ''}`
            });
        });
    } else if (key === 'concerts') {
        const allEv = window.AURA_EVENTS?.state?.all || [];
        const concerts = allEv.filter(e => e.type === 'concert')
            .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
            .slice(0, 12);
        concerts.forEach(ev => {
            const status = window.AURA_EVENTS?.getEventStatus?.(ev);
            items.push({
                title: `🎤 ${(isKo && ev.titleKo) ? ev.titleKo : ev.title}`,
                meta: `${ev.city || ''} · ${formatEventDates(ev, isKo)}${status ? ' · ' + status.label : ''}`,
                url: ev.url
            });
        });
    } else if (key === 'sports') {
        const allEv = window.AURA_EVENTS?.state?.all || [];
        const sports = allEv.filter(e => e.type === 'sport')
            .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
            .slice(0, 12);
        sports.forEach(ev => {
            const status = window.AURA_EVENTS?.getEventStatus?.(ev);
            items.push({
                title: `🏆 ${(isKo && ev.titleKo) ? ev.titleKo : ev.title}`,
                meta: `${ev.city || ''} · ${formatEventDates(ev, isKo)}${status ? ' · ' + status.label : ''}`,
                url: ev.url
            });
        });
    } else if (key === 'festivals') {
        const allEv = window.AURA_EVENTS?.state?.all || [];
        const fests = allEv.filter(e => e.type === 'festival')
            .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
            .slice(0, 12);
        fests.forEach(ev => {
            const status = window.AURA_EVENTS?.getEventStatus?.(ev);
            items.push({
                title: `🎪 ${(isKo && ev.titleKo) ? ev.titleKo : ev.title}`,
                meta: `${ev.city || ''} · ${formatEventDates(ev, isKo)}${status ? ' · ' + status.label : ''}`,
                url: ev.url
            });
        });
    } else if (key === 'hotspots') {
        // 지역 순위: 뉴스 + 지진 + 재난 가중치로 점수 계산
        const stats = countryStats();
        const ranked = stats
            .filter(c => (c.newsCount || 0) > 0 || (c.earthquakes || 0) > 0 || (c.disasters || 0) > 0)
            .map(c => ({
                code: c.code,
                name: isKo ? c.ko : c.en,
                flag: c.flag || '',
                score: (c.newsCount || 0) + (c.earthquakes || 0) * 3 + (c.disasters || 0) * 5,
                news: c.newsCount || 0,
                quakes: c.earthquakes || 0,
                disasters: c.disasters || 0
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 15);

        ranked.forEach((c, idx) => {
            const rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
            const parts = [];
            if (c.news) parts.push(isKo ? `뉴스 ${c.news}` : `${c.news} news`);
            if (c.quakes) parts.push(isKo ? `지진 ${c.quakes}` : `${c.quakes} quakes`);
            if (c.disasters) parts.push(isKo ? `재난 ${c.disasters}` : `${c.disasters} disasters`);
            items.push({
                title: `${rankIcon} ${c.flag} ${c.name}`,
                meta: parts.join(' · ') || (isKo ? '활동 없음' : 'No activity'),
                countryCode: c.code  // 클릭 시 지구 회전 + 중앙 모달용
            });
        });
        if (items.length === 0) {
            items.push({
                title: isKo ? '아직 데이터 수집 중' : 'Collecting data...',
                meta: isKo ? '잠시 후 다시 확인하세요' : 'Please check again shortly'
            });
        }
    } else if (key === 'top5') {
        // 오늘의 TOP 5: 가장 큰 지진 + 활성 재난 + 최신 주요 뉴스 통합
        const big = [];

        // 큰 지진 (M5.0 이상)
        (state.earthquakes || [])
            .filter(eq => eq.magnitude >= 5.0)
            .slice(0, 3)
            .forEach(eq => {
                big.push({
                    score: eq.magnitude * 10,
                    title: `🌍 M${eq.magnitude.toFixed(1)} · ${eq.location || '-'}`,
                    meta: `${formatRelTime(eq.time, isKo)} · ${isKo ? '깊이' : 'Depth'} ${eq.depth || '?'}km`,
                    url: eq.url
                });
            });

        // 활성 재난
        (state.disasters || []).slice(0, 3).forEach(d => {
            big.push({
                score: 40,
                title: `⚠️ ${d.title || d.category || '-'}`,
                meta: `${d.category || ''} · ${d.location || '-'}`,
                url: d.url
            });
        });

        // 최근 24시간 내 최다 인용된 뉴스 Top
        const recent = (state.allArticles || [])
            .filter(a => {
                const t = new Date(a.publishedAt).getTime();
                return Number.isFinite(t) && (Date.now() - t) < 24 * 3600 * 1000;
            })
            .slice(0, 5);
        recent.forEach((a, i) => {
            big.push({
                score: 30 - i,
                title: `📰 ${a.titleTranslated || a.title || ''}`,
                meta: `${a.source || ''} · ${formatRelTime(a.publishedAt, isKo)}`,
                url: a.url
            });
        });

        // 점수 정렬 후 상위 5개
        big.sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .forEach((it, idx) => {
                const rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                items.push({
                    title: `${rankIcon} ${it.title}`,
                    meta: it.meta,
                    url: it.url
                });
            });

        if (items.length === 0) {
            items.push({
                title: isKo ? '오늘 큰 사건이 없습니다' : 'No major events today',
                meta: isKo ? '평화로운 하루입니다 ✨' : 'A peaceful day ✨'
            });
        }
    } else if (key === 'travel') {
        // 우리가 추천하는 여행지 — 나라별로 그룹핑 (사용자 요청)
        const dests = window.AURA_TRAVEL?.getTopDestinations?.(20) || [];
        const byCountry = new Map();
        dests.forEach(d => {
            const k = d.countryCode || d.country;
            if (!byCountry.has(k)) byCountry.set(k, { country: d.country, code: d.countryCode, cities: [] });
            byCountry.get(k).cities.push(d);
        });

        const groups = Array.from(byCountry.values()).sort((a, b) => {
            const sa = a.cities.reduce((s, c) => s + (c.score || 0), 0) / a.cities.length;
            const sb = b.cities.reduce((s, c) => s + (c.score || 0), 0) / b.cities.length;
            return sb - sa;
        });

        groups.forEach(g => {
            const flag = countryByCode(g.code)?.flag || '🌍';
            const cityCount = g.cities.length;
            items.push({
                title: `${flag} ${g.country}`,
                meta: isKo ? `추천 도시 ${cityCount}곳` : `${cityCount} pick${cityCount > 1 ? 's' : ''}`,
                divider: true
            });
            g.cities
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .forEach(d => {
                    const tag = isKo ? d.tagKo : d.tagEn;
                    const reason = isKo ? d.reason : d.reasonEn;
                    items.push({
                        title: `${flag} ${d.city}`,
                        meta: `${tag} · ${reason}`
                    });
                });
        });

        if (items.length === 0) {
            items.push({ title: isKo ? '여행 데이터 로딩 중' : 'Loading travel data...', meta: '' });
        }
    } else if (key === 'weather') {
        // 현재 국가의 도시별 날씨 (cities-data.js의 CITIES_BY_COUNTRY)
        const cities = window.AURA_CITIES?.CITIES_BY_COUNTRY?.[state.country] || [];
        if (cities.length === 0) {
            items.push({
                title: isKo ? '도시 데이터 없음' : 'No city data',
                meta: isKo ? '국가를 변경해보세요' : 'Try another country'
            });
        } else {
            // 데이터 없으면 즉시 fetch 트리거
            if (!state.cityWeather || Object.keys(state.cityWeather).length === 0) {
                if (typeof fetchCountryEnv === 'function') fetchCountryEnv(state.country);
            }
            cities.forEach(city => {
                const w = state.cityWeather?.[`${city.lat},${city.lng}`];
                const cityName = isKo ? city.nameKo : city.name;
                if (w && Number.isFinite(w.temp)) {
                    const condIcon = (w.code >= 95) ? '⛈️' : (w.code >= 80) ? '🌧️' : (w.code >= 71) ? '🌨️' : (w.code >= 61) ? '🌦️' : (w.code >= 45) ? '🌫️' : (w.code >= 2) ? '⛅' : '☀️';
                    items.push({
                        title: `${condIcon} ${cityName}`,
                        meta: `${Math.round(w.temp)}°C · ${isKo ? '체감' : 'feels'} ${Math.round(w.feels || w.temp)}°C${w.humidity ? ' · ' + (isKo ? '습도' : 'humidity') + ' ' + Math.round(w.humidity) + '%' : ''}`,
                        cityName: city.name
                    });
                } else {
                    items.push({
                        title: `🌤️ ${cityName}`,
                        meta: isKo ? '데이터 수집 중...' : 'Loading...',
                        cityName: city.name
                    });
                }
            });
        }
    } else if (key === 'air') {
        const cities = window.AURA_CITIES?.CITIES_BY_COUNTRY?.[state.country] || [];
        if (cities.length === 0) {
            items.push({
                title: isKo ? '도시 데이터 없음' : 'No city data',
                meta: ''
            });
        } else {
            if (!state.cityAir || Object.keys(state.cityAir).length === 0) {
                if (typeof fetchCountryEnv === 'function') fetchCountryEnv(state.country);
            }
            cities.forEach(city => {
                const a = state.cityAir?.[`${city.lat},${city.lng}`];
                const cityName = isKo ? city.nameKo : city.name;
                if (a && Number.isFinite(a.aqi)) {
                    const cat = window.AURA_CITIES?.aqiCategory?.(a.aqi);
                    const label = cat ? (isKo ? cat.labelKo : cat.labelEn) : '-';
                    const dot = cat ? cat.color : '#888';
                    items.push({
                        title: `🌫️ ${cityName}`,
                        meta: `AQI ${Math.round(a.aqi)} · ${label}${a.pm25 ? ' · PM2.5 ' + Math.round(a.pm25) : ''}`,
                        color: dot,
                        cityName: city.name
                    });
                } else {
                    items.push({
                        title: `🌫️ ${cityName}`,
                        meta: isKo ? '데이터 수집 중...' : 'Loading...',
                        cityName: city.name
                    });
                }
            });
        }
    }
    return items;
}

function formatRelTime(iso, isKo) {
    if (!iso) return '-';
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return '-';
    const diff = Date.now() - t;
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return isKo ? '방금' : 'now';
    if (mins < 60) return isKo ? `${mins}분 전` : `${mins}m ago`;
    if (hrs < 24) return isKo ? `${hrs}시간 전` : `${hrs}h ago`;
    return isKo ? `${Math.floor(hrs / 24)}일 전` : `${Math.floor(hrs / 24)}d ago`;
}

function formatEventDates(event, isKo) {
    if (!event) return '';
    try {
        const s = new Date(event.startDate);
        const e = new Date(event.endDate);
        const locale = isKo ? 'ko-KR' : 'en-US';
        const opts = { month: 'short', day: 'numeric' };
        return `${s.toLocaleDateString(locale, opts)} – ${e.toLocaleDateString(locale, opts)}`;
    } catch { return ''; }
}

// ── FX PANEL ────────────────────────────────────────────────────────────────
function renderFxPanel() {
    const base = countryByCode(state.fxBase), quote = countryByCode(state.fxQuote);
    if ($('fxRateValue')) $('fxRateValue').textContent = state.fxRate !== null ? Number(state.fxRate).toFixed(4) : '--';
    if ($('fxRateLabel')) $('fxRateLabel').textContent = `${base.currency} → ${quote.currency}`;
    if ($('fxSummary')) $('fxSummary').textContent = state.fxRate !== null
        ? t(`1 ${base.currency} = ${Number(state.fxRate).toFixed(4)} ${quote.currency}${state.fxDate ? ' · ' + state.fxDate : ''}`,
            `${base.currency} 1 = ${quote.currency} ${Number(state.fxRate).toFixed(4)}${state.fxDate ? ' · ' + state.fxDate : ''}`)
        : t('FX feed unavailable', '환율 데이터 없음');
}

// ── BOTTOM STATS ────────────────────────────────────────────────────────────
function renderBottomStats() {
    const stats = countryStats();
    const avg = stats.length ? (stats.reduce((s, c) => s + c.score, 0) / stats.length).toFixed(1) : '0.0';
    if ($('riskScore')) $('riskScore').textContent = avg;
    if ($('articleCount')) $('articleCount').textContent = compactNum(state.allArticles.length);
    if ($('aircraftCount')) {
        const evCount = (window.AURA_EVENTS?.state?.all || []).length;
        $('aircraftCount').textContent = compactNum(evCount);
    }
    if ($('quakeCount')) $('quakeCount').textContent = compactNum(state.earthquakes.length);
    if ($('disasterCount')) $('disasterCount').textContent = compactNum(state.disasters.length);
    if ($('feedsLive')) $('feedsLive').textContent = `${state.feedsLoaded}/${state.feedsTotal}`;
    const hotZones = countryStats().filter(c => c.code !== 'GLOBAL' && c.newsCount >= HOT_THRESHOLD).length;
    if ($('hotCountValue')) $('hotCountValue').textContent = hotZones;
    if ($('breakingCountValue')) $('breakingCountValue').textContent = buildBreaking().length;
}

function buildBreaking() {
    const recent = state.allArticles.filter(a => Date.now() - new Date(a.publishedAt).getTime() < 180 * 60000);
    const phrases = collectPhrases(recent.slice(0, 80).map(a => ({ title: a.title, weight: 1 })));
    return phrases.slice(0, 6).map(([p, s]) => ({ label: titleCase(p), score: s }));
}

// ── LEFT PANEL ──────────────────────────────────────────────────────────────
function renderLeftPanel() {
    const c = countryByCode(state.country);
    if ($('leftCountryFlag')) $('leftCountryFlag').textContent = c.flag;
    if ($('leftCountryName')) $('leftCountryName').textContent = countryName(c);
    const count = (state.articlesByCountry[state.country] || []).length;
    if ($('leftCountryMeta')) $('leftCountryMeta').textContent = t(`${count} stories`, `${count}개 기사`);
    
    // Environment cards
    const env = $('leftEnvGrid');
    if (env) {
        clearNode(env);
        const w = state.weather[state.country];
        const air = state.airQuality[state.country];
        const items = [
            { label: msg('nearWeather'), val: w ? `${w.temp.toFixed(1)}°` : '--', key: 'weather' },
            { label: msg('nearAir'), val: air ? `AQI ${Math.round(air.aqi)}` : '--', key: 'air' }
        ];
        items.forEach(i => {
            const card = make('button', 'env-card');
            card.type = 'button';
            card.appendChild(make('div', 'env-label', i.label));
            card.appendChild(make('div', 'env-val', i.val));
            card.addEventListener('click', () => applyTopicFilter(topicFilterFromPreset(i.key)));
            env.appendChild(card);
        });
    }
    renderHotZones();
    renderLeftNews();  // 좌측 패널 간략 뉴스 업데이트
}

// ── GLOBE ───────────────────────────────────────────────────────────────────
function projectAircraft(craft) {
    const elapsed = Math.min(60, Math.max(0, (Date.now() - (craft.seenAt || Date.now())) / 1000));
    const distKm = (craft.velocity || 0) * elapsed / 1000;
    const h = ((craft.heading || 0) * Math.PI) / 180;
    const north = Math.cos(h) * distKm;
    const east = Math.sin(h) * distKm;
    const lat = craft.lat + north / 111;
    const lng = craft.lng + east / Math.max(15, 111 * Math.cos((craft.lat * Math.PI) / 180));
    return {
        lat: Math.max(-89.9, Math.min(89.9, lat)),
        lng: ((lng + 540) % 360) - 180
    };
}

function buildGlobeMarkers() {
    const markers = [];
    if (state.layers.news) {
        countryStats().filter(c => c.code !== 'GLOBAL' && c.newsCount > 0).slice(0, 14).forEach(c => {
            markers.push({
                kind: 'news', lat: c.lat, lng: c.lng,
                flag: c.flag, code: c.code, count: c.newsCount,
                label: `${c.flag} ${countryName(c)}`,
                hot: c.newsCount >= HOT_THRESHOLD
            });
        });
    }
    // Aircraft layer removed — no meaningful path data
    if (state.layers.earthquakes) {
        state.earthquakes.slice(0, 18).forEach(q => {
            markers.push({
                kind: 'earthquake', lat: q.lat, lng: q.lng,
                magnitude: q.magnitude, title: q.title,
                location: q.place || q.title,
                time: q.time || q.publishedAt,
                label: `M${q.magnitude.toFixed(1)} · ${q.title}`,
                topic: topicFilterFromPreset('earthquake')
            });
        });
    }
    if (state.layers.disasters) {
        state.disasters.slice(0, 18).forEach(e => {
            markers.push({
                kind: 'disaster', lat: e.lat, lng: e.lng,
                category: e.category, title: e.title,
                location: e.title,
                url: e.link || e.url,
                label: `${e.category}: ${e.title}`,
                topic: topicFilterFromPreset('disaster')
            });
        });
    }
    // FIX: weather layer - show weather markers for countries we have data for
    if (state.layers.weather) {
        for (const [code, w] of Object.entries(state.weather)) {
            const c = countryByCode(code);
            if (!c || code === 'GLOBAL' || !w || !Number.isFinite(w.temp)) continue;
            markers.push({
                kind: 'weather', lat: c.lat, lng: c.lng,
                temp: w.temp, weatherCode: w.code,
                label: `${c.flag} ${w.temp.toFixed(1)}°C · ${weatherLabel(w.code)}`,
                topic: topicFilterFromPreset('weather')
            });
        }
    }
    // FIX: air quality layer
    if (state.layers.air) {
        for (const [code, a] of Object.entries(state.airQuality)) {
            const c = countryByCode(code);
            if (!c || code === 'GLOBAL' || !a || !Number.isFinite(a.aqi)) continue;
            markers.push({
                kind: 'air', lat: c.lat, lng: c.lng,
                aqi: a.aqi,
                label: `${c.flag} AQI ${Math.round(a.aqi)} · ${aqiLabel(a.aqi)}`,
                topic: topicFilterFromPreset('air')
            });
        }
    }
    // Events 분리: 콘서트 / 스포츠 / 축제 레이어 개별
    if (window.AURA_EVENTS?.getEventsForGlobe) {
        const events = window.AURA_EVENTS.getEventsForGlobe();
        events.forEach(ev => {
            // 레이어 필터링
            if (ev.type === 'concert' && state.layers.concerts === false) return;
            if (ev.type === 'sport' && state.layers.sports === false) return;
            if (ev.type === 'festival' && state.layers.festivals === false) return;
            const status = window.AURA_EVENTS.getEventStatus(ev);
            markers.push({
                kind: 'event',
                lat: ev.lat, lng: ev.lng,
                emoji: ev.emoji,
                eventType: ev.type,
                event: ev,
                status: status.status,
                label: `${ev.title}`
            });
        });
    }
    // Startup 광고 마커는 지구본에서 제거 (메인 화면 절제)
    return markers;
}

// rAF 기반 디바운스 + 마커 수 제한 + 동일 데이터 스킵
let __markerRAF = null;
const MAX_MARKERS = 60;  // 80 → 60 (사용자 요청: 더 가볍게)

// hash 변수를 window 에 노출 — mobile-map.js 등 외부에서 강제 리프레시 가능
let __lastMarkerHash = '';
let __lastLabelsHash = '';
window.__resetMarkerCaches = function() {
    __lastMarkerHash = '';
    __lastLabelsHash = '';
};

function refreshGlobeMarkers() {
    if (!globeInstance) return;
    if (__markerRAF) cancelAnimationFrame(__markerRAF);
    __markerRAF = requestAnimationFrame(() => {
        __markerRAF = null;
        let markers = buildGlobeMarkers();

        // 줌 거리 기반 임계값
        let threshold = 2.5;
        try {
            const dist = globeInstance.controls()._spherical?.radius || 250;
            if (dist > 300) threshold = 5.0;
            else if (dist < 150) threshold = 1.2;
        } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
        if (window.AURA_MARKERS?.clusterMarkers) {
            markers = window.AURA_MARKERS.clusterMarkers(markers, { threshold });
        }

        // 사용자 요청: 빨간 country 마커 → labelsData 로 옮김 (자동 카메라 facing, 안 뒤집힘)
        // news 종류는 htmlElementsData 에서 빼고, refreshGlobeLabels 가 처리
        const newsMarkers = markers.filter(m => m.kind === 'news' || m.kind === 'country');
        const otherMarkers = markers.filter(m => m.kind !== 'news' && m.kind !== 'country');

        // 우선순위 정렬 후 상위 N개만
        otherMarkers.sort((a, b) => {
            const pa = a.kind === 'earthquake' ? 10 : a.kind === 'disaster' ? 9 :
                      a.kind === 'event' ? 5 : 1;
            const pb = b.kind === 'earthquake' ? 10 : b.kind === 'disaster' ? 9 :
                      b.kind === 'event' ? 5 : 1;
            return pb - pa;
        });
        const finalOther = otherMarkers.length > MAX_MARKERS ? otherMarkers.slice(0, MAX_MARKERS) : otherMarkers;

        // 동일 마커 셋이면 스킵 (성능)
        const hash = finalOther.length + ':' + finalOther.slice(0, 10).map(m => `${m.kind}${m.lat?.toFixed?.(1)}${m.lng?.toFixed?.(1)}`).join('|');
        if (hash !== __lastMarkerHash) {
            __lastMarkerHash = hash;
            globeInstance.htmlElementsData(finalOther);
        }

        // country 마커는 labels 레이어로 → 도시 라벨과 함께 그려짐
        __lastNewsMarkers = newsMarkers;
        refreshGlobeLabels();
    });
}

let __lastNewsMarkers = [];
// 도시(노란) + country news(빨간) 합쳐서 labelsData 단일 레이어로
function refreshGlobeLabels() {
    if (!globeInstance) return;
    const cities = window.AURA_CITY_VIDEOS?.getCityList?.() || [];
    const isKo = state.lang === 'ko';

    const cityLabels = cities.map(c => ({
        type: 'city',
        lat: c.lat,
        lng: c.lng,
        name: c.name,
        text: isKo ? (c.ko || c.name) : c.name
    }));

    const newsLabels = (__lastNewsMarkers || []).map(m => ({
        type: 'news',
        lat: m.lat,
        lng: m.lng,
        code: m.code,
        count: m.count,
        flag: m.flag,
        text: `${m.flag || ''} ${m.code} ${m.count >= 1000 ? Math.round(m.count/1000) + 'k' : m.count}`
    }));

    const all = cityLabels.concat(newsLabels);
    const hash = all.length + ':' + all.slice(0, 10).map(d => `${d.type}${d.text}`).join('|');
    if (hash === __lastLabelsHash) return;
    __lastLabelsHash = hash;

    try {
        globeInstance
            .labelsData(all)
            .labelLat('lat')
            .labelLng('lng')
            .labelText('text')
            // 사용자: '도시 라벨 가독성 — 콘트라스트 +30%'.
            // 도시 라벨 색을 더 밝은 amber-white 로, 사이즈 +20% 키워 대비 확보.
            // (globe.gl 라벨은 SVG 3D mesh 라 text-shadow 직접 불가 — 색/크기/dotRadius 로 보강)
            .labelColor(d => d.type === 'news'
                ? (d.count >= HOT_THRESHOLD ? 'rgba(255, 105, 92, 1.0)' : 'rgba(255, 175, 168, 0.98)')
                : 'rgba(255, 240, 195, 1.0)')
            .labelSize(d => d.type === 'news' ? 0.62 : 0.55)
            .labelDotRadius(d => d.type === 'news' ? 0.85 : 0.6)
            .labelDotOrientation(() => 'bottom')
            .labelResolution(2)
            .labelAltitude(d => d.type === 'news' ? 0.022 : 0.018)
            .onLabelClick(d => {
                if (d.type === 'news') {
                    if (typeof selectCountry === 'function') selectCountry(d.code, true);
                } else {
                    if (window.AURA_AMBIENT?.openCity) window.AURA_AMBIENT.openCity(d.name);
                }
            })
            .onLabelHover(d => {
                document.body.style.cursor = d ? 'pointer' : 'default';
            });
    } catch (e) { window.AURA?.dbgWarn?.('refreshGlobeLabels', e); }
}
window.refreshGlobeLabels = refreshGlobeLabels;

function initGlobe() {
    // 모바일 2D 모드 — Leaflet 이 globeInstance shim 으로 이미 작동 중. globe.gl skip.
    if (window.AURA_USE_2D_MAP) {
        if (window.__DEBUG) console.log('[GLOBE] 2D mobile mode — skipping globe.gl init');
        // 그래도 후속 모듈이 globeInstance 를 쓰니까 이미 shim 으로 채워져 있음
        try { applyTheme(); } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
        try { renderAll(); } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
        return;
    }
    if (typeof Globe === 'undefined') {
        console.error('[GLOBE] Globe.gl 라이브러리 미로드');
        if (!initGlobe._retries) initGlobe._retries = 0;
        if (initGlobe._retries++ < 10) {
            console.log(`[GLOBE] CDN 대기 중... ${initGlobe._retries}/10`);
            setTimeout(initGlobe, 1000);
            return;
        }
        const el = $('globe');
        if (el) {
            el.innerHTML = '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:#fff;font-family:sans-serif;padding:40px;max-width:500px"><h2 style="font-size:24px">⚠️ 지구본 로드 실패</h2><p style="opacity:.8;margin-top:14px;line-height:1.6">three.js / globe.gl CDN 라이브러리를 가져오지 못했습니다.</p><p style="opacity:.5;font-size:13px;margin-top:14px">콘솔에서 <code style="background:#222;padding:2px 6px;border-radius:4px">AURA_DIAG()</code> 실행해서 원인 확인<br>또는 <code style="background:#222;padding:2px 6px;border-radius:4px">npm start</code>로 Electron 앱 실행</p></div>';
        }
        setStatus('error', t('GLOBE FAILED', '지구본 오류 - F5'));
        return;
    }
    const el = $('globe');
    if (!el) {
        console.error('[GLOBE] #globe div 못 찾음');
        return;
    }
    console.log('[GLOBE] Initializing 3D globe...');
    const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#ff5d50';

    try {
        // 기본 globe.gl 셋업 (사용자: "지구본 안 떠" 보고 → rendererConfig 제거,
        // 기본 antialias + power-preference 사용. v504의 perf 옵션이 일부 환경에서
        // texture 로딩 깨뜨렸음.)
        globeInstance = Globe()(el)
            .backgroundColor('rgba(0,0,0,0)')
            .backgroundImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png')
            .globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg')
            .bumpImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png')
            .showAtmosphere(true)
            .atmosphereColor(accent)
            .atmosphereAltitude(0.25);

        // perf: DPR cap (4K/Retina에서 GPU 부담 줄임) — 안전한 후처리
        try {
            const renderer = globeInstance.renderer && globeInstance.renderer();
            if (renderer && renderer.setPixelRatio) {
                // v582 데스크톱 발열 — Retina (DPR 2-3) → 1.0 강제. GPU 부하 75% ↓.
                // 시각 차이 최소 (지구본은 텍스처 위주, 점/라벨은 Vector).
                renderer.setPixelRatio(1);
            }
        } catch (e) { window.AURA?.dbgWarn?.("silent",e); }

        // 기본 조명 보강 — globe.gl이 bundle한 THREE 사용 (window.THREE 없음)
        // globeInstance.scene().add() 로 자식 추가, light 클래스는 scene.children 의 prototype 통해
        try {
            const scene = globeInstance.scene && globeInstance.scene();
            if (scene && !scene.children.some(c => c.userData?._aura_basic_light)) {
                // globe.gl 0.20+ : scene().traverse 또는 globe-internals 통해 THREE 접근
                // 가장 안전: globe.gl 의 자체 lights 그대로 두고 globeMaterial emissive 살짝 추가
                const mat = globeInstance.globeMaterial && globeInstance.globeMaterial();
                if (mat) {
                    // emissive 톤 다운으로 globe sphere 살짝 자체 발광 (검정 안 보이게)
                    if (mat.emissive && typeof mat.emissive.setHex === 'function') {
                        mat.emissive.setHex(0x222244);
                    }
                    if ('emissiveIntensity' in mat) mat.emissiveIntensity = 0.15;
                    mat.userData = mat.userData || {};
                    mat.userData._aura_basic_light = true;
                }
            }
        } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
    } catch (e) {
        console.error('[GLOBE] Init failed:', e);
        el.innerHTML = '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:#fff;font-family:sans-serif;padding:40px"><h2>⚠️ 3D 가속 비활성화?</h2><p style="opacity:.7;margin-top:14px">Chrome 설정 → 시스템 → 하드웨어 가속 ON 후 재시작</p><p style="opacity:.5;font-size:11px;margin-top:14px">Error: ' + e.message + '</p></div>';
        return;
    }

    // 캔버스 생성 확인
    setTimeout(() => {
        const canvas = el.querySelector('canvas');
        if (!canvas) {
            console.error('[GLOBE] Canvas 생성 안 됨 - WebGL 비활성?');
        } else {
            console.log('[GLOBE] ✓ Canvas 생성됨', canvas.width + 'x' + canvas.height);
        }
    }, 1500);

    globeInstance
        .htmlElementsData([])
        .htmlLat(m => m.lat)
        .htmlLng(m => m.lng)
        .htmlAltitude(m => {
            // 표면에 평면 부착 — 사용자 요청 "노란 마커처럼 지구에 붙어있게".
            // 펄스/halo 도 제거됐으므로 모든 카테고리 동일 0.005 (살짝만 위, 표면 안 묻힘)
            // 라벨 있는 마커(news/country) 만 살짝 더 위로 띄워서 라벨이 지면 안 가리도록.
            return (m.kind === 'news' || m.kind === 'country') ? 0.008 : 0.005;
            // (구버전 switch case 제거)
            switch (m.kind) {
                case 'earthquake': return 0.012;
                case 'disaster':   return 0.012;
                case 'event':      return 0.010;
                case 'news':       return 0.014;
                case 'weather':    return 0.010;
                case 'air':        return 0.010;
                default:           return 0.010;
            }
        })
        .htmlElement(m => {
            // 새 시스템: 벡터 마커
            let wrap;
            if (window.AURA_MARKERS && window.AURA_MARKERS.createMarker) {
                wrap = window.AURA_MARKERS.createMarker(m);
                wrap.title = m.label || '';
            } else {
                // fallback (모듈 로드 전)
                wrap = make('div', `gm gm-${m.kind}`);
                wrap.title = m.label || '';
            }
            wrap.addEventListener('click', e => {
                e.stopPropagation();
                e.preventDefault();
                if (window.__DEBUG) console.log('[MARKER CLICK]', m.kind, m);
                if (globeInstance) {
                    globeInstance.controls().autoRotate = false;
                    globeInstance.pointOfView({ lat: m.lat, lng: m.lng, altitude: 1.6 }, 800);
                }
                // popup 함수 존재 확인 후 호출
                const popup = window.__showMarkerPopup;
                if (typeof popup !== 'function') {
                    // ux-v2.js 아직 로드 안됐으면 fallback
                    if (m.kind === 'news' && window.openCountryModal) {
                        window.openCountryModal(m.code);
                    } else {
                        alert((m.label || m.title || '마커') + '\n\n정보 패널이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
                    }
                    return;
                }
                // Marker popup
                if (m.kind === 'news' || m.kind === 'country') {
                    popup({
                        kind: 'country',
                        code: m.code,
                        title: (state.lang === 'ko' ? countryByCode(m.code).ko : countryByCode(m.code).en) || m.code,
                        subtitle: `${m.count || 0} ${state.lang === 'ko' ? '개 기사' : 'articles'} · ${m.flag || ''}`,
                        icon: m.flag,
                        lat: m.lat, lng: m.lng
                    });
                } else if (m.kind === 'earthquake') {
                    popup({
                        kind: 'earthquake',
                        title: `M${(m.magnitude || 0).toFixed(1)}`,
                        subtitle: state.lang === 'ko' ? '지진 발생' : 'EARTHQUAKE',
                        icon: '🌍',
                        magnitude: m.magnitude,
                        location: m.location,
                        time: m.time
                    });
                } else if (m.kind === 'disaster') {
                    popup({
                        kind: 'disaster',
                        title: m.title || (state.lang === 'ko' ? '재난' : 'Disaster'),
                        subtitle: m.category || '',
                        icon: '⚠️',
                        category: m.category,
                        location: m.location,
                        url: m.url
                    });
                } else if (m.kind === 'event') {
                    const isKo = state.lang === 'ko';
                    popup({
                        kind: 'event',
                        title: (isKo && m.event?.titleKo) ? m.event.titleKo : (m.event?.title || m.label || ''),
                        subtitle: (m.event?.type || '').toUpperCase() + ' · ' + (m.event?.city || ''),
                        icon: m.emoji,
                        event: m.event
                    });
                } else if (m.kind === 'weather') {
                    popup({
                        kind: 'weather',
                        title: state.lang === 'ko' ? '날씨' : 'Weather',
                        subtitle: m.city || '',
                        icon: '🌤️',
                        temp: m.temp,
                        condition: m.condition
                    });
                } else if (m.kind === 'air') {
                    popup({
                        kind: 'air',
                        title: state.lang === 'ko' ? '대기질' : 'Air Quality',
                        subtitle: m.city || '',
                        icon: '🌫️',
                        aqi: m.aqi
                    });
                } else if (m.topic) {
                    applyTopicFilter(m.topic);
                } else {
                    // 그 외 모든 마커도 일단 popup 띄움
                    popup({
                        kind: m.kind,
                        title: m.label || m.title || '',
                        subtitle: m.subtitle || '',
                        icon: m.emoji || m.flag || '📍'
                    });
                }
            });
            return wrap;
        });

    const ctrl = globeInstance.controls();
    ctrl.autoRotate = false;        // 마커 안 움직이게 (요청)
    ctrl.enablePan = false;
    ctrl.minDistance = 110;
    ctrl.maxDistance = 380;
    ctrl.enableDamping = true;
    ctrl.dampingFactor = 0.08;
    ctrl.rotateSpeed = 0.6;
    // 한 화면에 globe 통째로 들어오게 (사용자 요청) — altitude 1.8 → 2.4
    setTimeout(() => { if (globeInstance) globeInstance.pointOfView({ lat: 20, lng: 15, altitude: 2.4 }, 0); }, 50);
    window.globeInstance = globeInstance;

    // 사용자 요청: 지구본 디자인 초기화 — 추가 테마/스킨 적용 안 함, 기본 globe.gl 모양 그대로
    // (이전엔 'realistic' 등 후처리 light/material 적용했지만 마커 위치 어긋나는 부작용)
}

function selectCountry(code, openModal = false) {
    state.country = code;
    state.articleIdx = 0;
    saveSettings();
    const c = countryByCode(code);
    if (globeInstance && code !== 'GLOBAL') {
        // 더 가깝게 + 부드럽게 (1.4초)
        globeInstance.pointOfView({ lat: c.lat, lng: c.lng, altitude: 1.4 }, 1400);
        globeInstance.controls().autoRotate = false;
        state.globeLocked = true;
        if ($('lockIndicator')) {
            $('lockIndicator').classList.remove('hidden');
            $('lockLabel').textContent = `${c.flag} ${countryName(c)}`;
        }
    }
    fetchCountryEnv(code).finally(() => {
        saveIntel();
        renderAll();
        // 모바일 우상단 weather/AQI 알약 갱신 (사용자: '날씨/미세먼지 옆에 조그만하게')
        try {
            const w = state.weather?.[code];
            const a = state.airQuality?.[code];
            const cName = (state.lang === 'ko' ? c.ko : c.en) || c.code;
            window.AURA_AQI?.update?.(a?.aqi, cName, w?.temp);
        } catch (e) { window.AURA?.dbgWarn?.("caught", e); }
    });
    renderAll();
    if (openModal) openCountryModal(code);
}

function releaseGlobe() {
    if (!globeInstance) return;
    state.globeLocked = false;
    globeInstance.controls().autoRotate = true;
    $('lockIndicator')?.classList.add('hidden');
    showToast(msg('released'));
}

function switchStage(stage) {
    // 소셜 탭 제거됨 - 항상 globe만
    state.stage = 'globe';
    document.querySelectorAll('.stage-view').forEach(n => n.classList.toggle('active', n.dataset.stage === 'globe'));
    document.querySelectorAll('.stage-btn').forEach(n => n.classList.toggle('active', n.dataset.stage === 'globe'));
}

// ── SHARE CARD ──────────────────────────────────────────────────────────────
function generateShareCard() {
    const item = getNewsPool()[state.articleIdx];
    if (!item) return;
    const c = countryByCode(item.countryCode);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1200;
    canvas.height = 630;
    const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#ff5d50';

    const bg = ctx.createLinearGradient(0, 0, 1200, 630);
    bg.addColorStop(0, '#08090f');
    bg.addColorStop(1, '#1a1d2a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1200, 630);

    // === AURA Ω + Saturn logo (top right) ===
    ctx.save();
    ctx.translate(990, 120);
    ctx.scale(0.9, 0.9);
    
    // Omega outer shape (simplified)
    ctx.fillStyle = accent;
    ctx.beginPath();
    // Top circle (outer)
    ctx.arc(0, 0, 80, Math.PI * 1.05, Math.PI * 1.95, false);
    // Left foot
    ctx.lineTo(-35, 68);
    ctx.lineTo(-72, 68);
    ctx.lineTo(-72, 78);
    ctx.lineTo(-10, 78);
    // Inner arc (bottom hollow)
    ctx.arc(0, 0, 50, Math.PI * 0.8, Math.PI * 0.2, true);
    ctx.lineTo(10, 78);
    ctx.lineTo(72, 78);
    ctx.lineTo(72, 68);
    ctx.lineTo(35, 68);
    ctx.closePath();
    ctx.fill();
    
    // Saturn planet (black filled center)
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, -5, 16, 0, Math.PI * 2);
    ctx.fill();
    
    // Saturn ring
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, -2, 32, 9, -0.2, 0, Math.PI * 2);
    ctx.stroke();
    
    // Stars
    ctx.fillStyle = accent;
    [[-22, -28, 2.5], [18, -32, 2], [25, 18, 2], [-18, 22, 1.6], [-28, -10, 1.2]].forEach(([x, y, r]) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();

    // Outer border
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(28, 28, 1144, 574);

    // Brand text
    ctx.fillStyle = '#fff';
    ctx.font = '700 32px Sora, sans-serif';
    ctx.letterSpacing = '4px';
    ctx.fillText('A U R A', 64, 98);
    
    ctx.fillStyle = accent;
    ctx.font = '500 14px JetBrains Mono, monospace';
    ctx.fillText('WORLD PULSE · OBSERVE THE WORLD', 64, 124);

    // Country flag + name
    ctx.fillStyle = accent;
    ctx.font = '700 42px Sora, sans-serif';
    ctx.fillText(`${c.flag} ${countryName(c)}`, 64, 200);

    // Article title
    ctx.fillStyle = '#fff';
    ctx.font = '700 46px Sora, sans-serif';
    wrapText(ctx, safeText(item.titleTranslated || item.title, 120), 64, 280, 1020, 56);

    // Summary
    ctx.fillStyle = '#d5d9e3';
    ctx.font = '22px Space Mono, monospace';
    wrapText(ctx, summarize(item.summaryTranslated || item.summary, 180), 64, 440, 1020, 34);

    // Meta
    ctx.fillStyle = '#91a0b5';
    ctx.font = '16px Space Mono, monospace';
    ctx.fillText(`${item.source} · ${relTime(item.publishedAt)} · ${item.category.toUpperCase()}`, 64, 558);
    
    // Heartbeat divider line
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(64, 578);
    ctx.lineTo(300, 578);
    // Pulse waveform
    ctx.lineTo(310, 570);
    ctx.lineTo(320, 588);
    ctx.lineTo(330, 566);
    ctx.lineTo(340, 582);
    ctx.lineTo(350, 578);
    ctx.lineTo(600, 578);
    ctx.stroke();

    canvas.toBlob(b => {
        if (!b) return;
        const url = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aura-${item.id}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(msg('cardDownloaded'));
    });
}

function wrapText(ctx, text, x, y, maxW, lh) {
    const words = String(text || '').split(' ');
    let line = '', cy = y;
    words.forEach((w, i) => {
        const test = `${line}${w} `;
        if (ctx.measureText(test).width > maxW && i > 0) {
            ctx.fillText(line, x, cy);
            line = `${w} `;
            cy += lh;
        } else line = test;
    });
    ctx.fillText(line, x, cy);
}

// ── RENDER ALL ──────────────────────────────────────────────────────────────
function renderAll() {
    applyLang();
    applyTheme();
    syncPanels();
    renderLeftPanel();
    renderRightPanel();
    renderBookmarks();
    renderLayerControls();
    renderFxPanel();
    renderBottomStats();
    renderStageHud();
    renderCountryModal();
    refreshGlobeMarkers();
    // v588 사용자 '모바일 공기질/날씨 안 뜸' — renderAll 마다 weather/AQI 알약 갱신
    try {
        const c = countryByCode(state.country);
        const w = state.weather?.[state.country];
        const air = state.airQuality?.[state.country];
        const cName = c ? ((state.lang === 'ko' ? c.ko : c.en) || c.code) : state.country;
        if (window.AURA_AQI?.update) window.AURA_AQI.update(air?.aqi, cName, w?.temp);
    } catch (e) {}
}

// ── DATA REFRESH ────────────────────────────────────────────────────────────
async function refreshNews(initial = false) {
    // RSS 비활성화 옵션 (window.AURA_NO_RSS = true 설정 시)
    if (window.AURA_NO_RSS) {
        console.log('[AURA] RSS disabled via window.AURA_NO_RSS');
        if (initial) setStatus('warn', t('RSS DISABLED', 'RSS 비활성'));
        return;
    }
    if (!initial) {
        setStatus('warn', t('SYNCING...', '동기화 중...'));
        $('spinIcon')?.classList.add('spinning');
    }
    const stored = loadStoredArticles();
    let fetched = [];
    let fetchError = null;
    try {
        // PERF: optimize.js의 fast fetcher 사용 (직접 fetch → 프록시 fallback)
        const fetcher = window.__fastFetchAllFeeds || fetchAllFeeds;
        fetched = await fetcher((loaded, total, src) => {
            if (initial) setLoadingProgress(40 + Math.round((loaded / total) * 40), `FETCHING ${Math.round((loaded/total)*100)}%`, src);
        });
    } catch (e) {
        fetchError = e;
        window.AURA?.dbgWarn?.('refreshNews fetch', e);
    }

    let merged = stored;
    if (!fetched.length && !stored.length) {
        setStatus('error', t('OFFLINE', '오프라인'));
        // 사용자에게 명시 — 이전엔 침묵 후 빈 화면
        if (!initial) showToast('📡 ' + t('No news fetched — check connection', '뉴스를 가져오지 못했어요 — 연결 확인'), 'warn', 4000);
    } else if (!fetched.length) {
        setStatus('warn', t('CACHED', '캐시 데이터'));
        if (fetchError && !initial) showToast('⚠️ ' + t('Live fetch failed — showing cache', '라이브 실패 — 캐시 표시'), 'warn', 3000);
    }
    else {
        merged = mergeArticles(stored, fetched);
        setStatus('live', t(`LIVE · ${fetched.length}`, `라이브 · ${fetched.length}`));
    }
    merged = cleanOld(merged);
    state.allArticles = merged;
    state.articlesByCountry = aggregateByCountry(merged);
    state.countryStatsCache = null;
    state.lastNewsUpdate = new Date().toISOString();
    saveStoredArticles(merged);
    state.trendClusters = buildTrendClusters();
    renderAll();
    $('spinIcon')?.classList.remove('spinning');
    state.lastNewsRefresh = Date.now();
    if (window.AURA_FRESH) window.AURA_FRESH.update('news');
}

async function refreshAux(initial = false) {
    const tasks = await Promise.allSettled([
        fetchEarthquakes(),
        fetchDisasters(),
        fetchCountryEnv(state.country),
        fetchFx(state.fxBase, state.fxQuote),
        fetchReddit(),
        fetchWikipedia()
    ]);
    if (tasks[0].status === 'fulfilled') state.earthquakes = tasks[0].value;
    if (tasks[1].status === 'fulfilled') state.disasters = tasks[1].value;
    if (tasks[4].status === 'fulfilled') {
        state.reddit = tasks[4].value;
        // Reddit를 main news pool에도 합침 — RSS가 CORS 막혀도 우측 패널이 비어있지 않게
        if (state.reddit && state.reddit.length) {
            state.allArticles = mergeArticles(state.allArticles || [], state.reddit);
            state.articlesByCountry = aggregateByCountry(state.allArticles);
        }
    }
    if (tasks[5].status === 'fulfilled') {
        state.wikipedia = tasks[5].value;
        // Wikipedia 인기 페이지도 main pool에 — 우측 패널 비어있지 않게
        if (state.wikipedia && state.wikipedia.length) {
            const now = new Date().toISOString();
            const wikiArticles = state.wikipedia.map((w, i) => ({
                id: 'wiki_' + (w.url || w.title || i).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 50),
                source: 'Wikipedia',
                title: w.title || 'Untitled',
                summary: w.summary || '',
                url: w.url || '#',
                publishedAt: now,
                category: 'science',
                countryCode: 'GLOBAL',
                bias: 'center'
            }));
            state.allArticles = mergeArticles(state.allArticles || [], wikiArticles);
            state.articlesByCountry = aggregateByCountry(state.allArticles);
        }
    }
    state.lastAuxRefresh = Date.now();
    if (window.AURA_FRESH) window.AURA_FRESH.update('aux');
    state.trendClusters = buildTrendClusters();
    state.lastAuxUpdate = new Date().toISOString();
    saveIntel();
    renderAll();
    // 우상단 mini 알약 — 현재 country 의 weather/AQI 표시
    try {
        const code = state.country;
        const c = countryByCode(code);
        if (c) {
            const w = state.weather?.[code];
            const a = state.airQuality?.[code];
            const cName = (state.lang === 'ko' ? c.ko : c.en) || c.code;
            window.AURA_AQI?.update?.(a?.aqi, cName, w?.temp);
        }
    } catch (e) { window.AURA?.dbgWarn?.("caught", e); }
}

// ── COUNTDOWN ───────────────────────────────────────────────────────────────
function initCountdown() {
    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        state.refreshSec--;
        if (state.refreshSec <= 0) {
            state.refreshSec = REFRESH_INTERVAL / 1000;
            refreshNews();
        }
        const mm = String(Math.floor(state.refreshSec / 60)).padStart(2, '0');
        const ss = String(state.refreshSec % 60).padStart(2, '0');
        if ($('countdown')) $('countdown').textContent = `${mm}:${ss}`;
        if ($('nextSync')) $('nextSync').textContent = `${mm}:${ss}`;
    }, 1000);
}

// ── EVENTS ──────────────────────────────────────────────────────────────────
function initEvents() {
    // 중복 boot 방지 — 핸들러 이미 부착됐으면 skip
    if (window.__auraEventsBound) return;
    window.__auraEventsBound = true;

    $('languageSelect')?.addEventListener('change', e => {
        state.lang = e.target.value;
        saveSettings();
        state.translateCache = {}; // Clear cache on lang change
        renderAll();
        // v580 사용자 보고 '모바일 번역 안됨' fix — 모바일 country picker /
        // modal / drawer 도 강제 re-render (renderAll 이 mobile-map shim 까지
        // 도달 안 함).
        try {
            if (typeof window.openCountryModal === 'function'
                && document.getElementById('countryModal')?.classList.contains('open')) {
                window.openCountryModal(state.country);
            }
            // mobile drawer flag picker 갱신
            const mb = window.AURA_MOBILE_MAP;
            if (mb?.directPush) mb.directPush();
            if (typeof window.renderMobileCountryNews === 'function') {
                window.renderMobileCountryNews();
            }
        } catch (err) {}
    });

    $('categorySelect')?.addEventListener('change', e => {
        state.category = e.target.value;
        state.articleIdx = 0;
        renderRightPanel();
    });

    $('countrySelect')?.addEventListener('change', e => selectCountry(e.target.value, true));

    initCountryPicker();
    initNewsTopToggle();
    initCategoriesSettings();
    initMobileGestures();
    initNetworkStatus();
    renderPersonalization();
    document.getElementById('resetPersonalizationBtn')?.addEventListener('click', () => {
        try { localStorage.removeItem(PERSONALIZATION_KEY); } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
        renderPersonalization();
    });

    $('fxBaseSelect')?.addEventListener('change', async e => {
        state.fxBase = e.target.value;
        saveSettings();
        await fetchFx(state.fxBase, state.fxQuote);
        renderFxPanel();
    });

    $('fxQuoteSelect')?.addEventListener('change', async e => {
        state.fxQuote = e.target.value;
        saveSettings();
        await fetchFx(state.fxBase, state.fxQuote);
        renderFxPanel();
    });

    $('searchInput')?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.articleIdx = 0;
            renderRightPanel();
            renderGlobalSearchSuggestions();   // 도시/카테고리도 같이 검색
        }, 200);
    });
    $('searchInput')?.addEventListener('focus', renderGlobalSearchSuggestions);
    $('searchInput')?.addEventListener('blur', () => setTimeout(hideGlobalSearchSuggestions, 200));

    $('refreshBtn')?.addEventListener('click', () => {
        state.refreshSec = REFRESH_INTERVAL / 1000;
        refreshNews();
        refreshAux();
    });

    // 톱니바퀴 버튼 → 설정 모달 직접 (카테고리 퀵 패널 제거됨)
    $('settingsBtn')?.addEventListener('click', e => {
        e.stopPropagation();
        openSettingsModal();
    });
    $('bookmarksBtn')?.addEventListener('click', () => { if (window.AURA_BOOKMARKS?.open) window.AURA_BOOKMARKS.open(); });
    // v580 — focus-moon (달) 모듈 삭제됨. focusEarthBtn HTML 도 제거. 핸들러 dead.
    $('globeSkinBtn')?.addEventListener('click', () => {
        closeSettingsModal();
        if (window.AURA_SKIN?.open) window.AURA_SKIN.open();
    });
    $('closeSettingsBtn')?.addEventListener('click', closeSettingsModal);
    $('settingsModal')?.addEventListener('click', e => { if (e.target.id === 'settingsModal') closeSettingsModal(); });

    $('themeSelect')?.addEventListener('change', e => {
        state.theme = e.target.value;
        saveSettings();
        applyTheme();
        refreshGlobeMarkers();
        renderAll();
    });

    $('notificationsToggle')?.addEventListener('change', e => {
        state.notifications = e.target.checked;
        saveSettings();
    });

    // Map mode (2D/3D) — 변경 시 reload 로 적용 (mobile-map.js 의 detectMobile() 가 localStorage 읽음)
    {
        const sel = $('mapModeSelect');
        if (sel) {
            try {
                const cur = localStorage.getItem('aura_map_pref');
                sel.value = (cur === '2d' || cur === '3d') ? cur : 'auto';
            } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
            sel.addEventListener('change', e => {
                const v = e.target.value;
                try {
                    if (v === 'auto') localStorage.removeItem('aura_map_pref');
                    else localStorage.setItem('aura_map_pref', v);
                } catch (err) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', err); }
                if (window.showToast) window.showToast('🔄 Map mode changed — reloading…', 'ok', 1200);
                setTimeout(() => location.reload(), 600);
            });
        }
    }

    $('toggleLeftBtn')?.addEventListener('click', () => togglePanel('left'));
    $('toggleLeftBtnTop')?.addEventListener('click', () => togglePanel('left'));  // 외부 토글 (패널 닫혔을 때도 보임)
    $('toggleRightBtn')?.addEventListener('click', () => togglePanel('right'));
    $('toggleDockBtn')?.addEventListener('click', () => togglePanel('dock'));
    // 도크 내부 inner 핸들 (인라인 onclick 제거 — CSP 호환)
    $('toggleDockBtnInner')?.addEventListener('click', () => togglePanel('dock'));

    document.querySelectorAll('.stage-btn').forEach(b => b.addEventListener('click', () => switchStage(b.dataset.stage)));
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
        state.activeTab = b.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(n => n.classList.toggle('active', n.dataset.tab === state.activeTab));
        document.querySelectorAll('.tab-panel').forEach(n => n.classList.toggle('active', n.dataset.tab === state.activeTab));
    }));

    $('shareArticleBtn')?.addEventListener('click', generateShareCard);
    $('articleNote')?.addEventListener('blur', saveCurrentNote);
    $('clearTopicBtn')?.addEventListener('click', clearTopicFilter);
    $('activeTopicPill')?.addEventListener('click', () => { if (state.topicFilter) clearTopicFilter(); });
    $('closeCountryModalBtn')?.addEventListener('click', closeCountryModal);
    $('lockRelease')?.addEventListener('click', releaseGlobe);
    $('countryModal')?.addEventListener('click', e => { if (e.target.id === 'countryModal') closeCountryModal(); });

    $('signalHeatInfo')?.addEventListener('click', () => showToast(msg('heatExplain'), 'ok', 6000));
    $('feedsLiveInfo')?.addEventListener('click', () => showToast(msg('feedsExplain'), 'ok', 4500));
    $('hotZonesInfo')?.addEventListener('click', () => showToast(msg('hotZonesExplain'), 'ok', 4500));
    $('breakingInfo')?.addEventListener('click', () => showToast(msg('breakingExplain'), 'ok', 4500));
    $('cacheInfo')?.addEventListener('click', () => showToast(msg('cacheHelp'), 'ok', 4500));

    $('layersAllOnBtn')?.addEventListener('click', () => {
        Object.keys(state.layers).forEach(k => state.layers[k] = true);
        saveSettings(); renderLayerControls(); refreshGlobeMarkers();
    });
    $('layersAllOffBtn')?.addEventListener('click', () => {
        Object.keys(state.layers).forEach(k => state.layers[k] = false);
        saveSettings(); renderLayerControls(); refreshGlobeMarkers();
    });

    window.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (state.countryModalOpen) { closeCountryModal(); return; }
            if (state.settingsOpen) { closeSettingsModal(); return; }
            if (state.globeLocked) releaseGlobe();
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'r') { e.preventDefault(); $('refreshBtn')?.click(); }

        // ─── 키보드 카메라 컨트롤 (사용자 요청) ───
        // 방향키: 카메라 회전 / Shift+방향키: 더 빠른 회전 / +,-,= : 줌 / Space: 자동회전 토글
        // input/select에 포커스 있을 땐 무시 (타이핑 방해 X)
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        if (state.countryModalOpen || state.settingsOpen) return;
        if (!window.globeInstance) return;

        try {
            const g = window.globeInstance;
            const pov = g.pointOfView();   // { lat, lng, altitude }
            const step = e.shiftKey ? 25 : 10;   // shift = 큰 step
            const altStep = e.shiftKey ? 0.6 : 0.25;
            let handled = true;
            switch (e.key) {
                case 'ArrowLeft':  g.pointOfView({ lng: pov.lng - step }, 300); break;
                case 'ArrowRight': g.pointOfView({ lng: pov.lng + step }, 300); break;
                case 'ArrowUp':    g.pointOfView({ lat: Math.min(85, pov.lat + step) }, 300); break;
                case 'ArrowDown':  g.pointOfView({ lat: Math.max(-85, pov.lat - step) }, 300); break;
                case '+':
                case '=':          g.pointOfView({ altitude: Math.max(0.5, pov.altitude - altStep) }, 300); break;
                case '-':
                case '_':          g.pointOfView({ altitude: Math.min(4, pov.altitude + altStep) }, 300); break;
                case ' ':          // Space → 자동회전 토글
                    e.preventDefault();
                    g.controls().autoRotate = !g.controls().autoRotate;
                    break;
                case 'Home':       // Home → 초기 위치로
                    g.pointOfView({ lat: 20, lng: 15, altitude: 1.8 }, 800);
                    break;
                default: handled = false;
            }
            if (handled && e.key.startsWith('Arrow')) e.preventDefault();
        } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
    });

    // Music control은 부가 기능 — 절대로 부트 흐름을 막지 않도록 격리
    try { initMusicControl(); } catch (err) { console.error('[AURA] initMusicControl failed (ignored):', err); }
}

// ── SETTINGS MODAL OPEN/CLOSE (aria + focus 관리 일관성) ────────────────────
let __lastFocusBeforeModal = null;
function openSettingsModal() {
    const m = $('settingsModal');
    if (!m) return;
    __lastFocusBeforeModal = document.activeElement;
    state.settingsOpen = true;
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
    setTimeout(() => $('closeSettingsBtn')?.focus(), 50);
}
function closeSettingsModal() {
    const m = $('settingsModal');
    if (!m) return;
    state.settingsOpen = false;
    m.classList.remove('open');
    m.setAttribute('aria-hidden', 'true');
    unlockBodyScroll();
    if (__lastFocusBeforeModal && typeof __lastFocusBeforeModal.focus === 'function') {
        try { __lastFocusBeforeModal.focus(); } catch (e) { window.AURA?.dbgWarn?.('restore focus', e); }
    }
}

// ── NETWORK STATUS (사용자 보고: 외부 API 단일점 실패) ──────────────────────
// online/offline 이벤트로 사용자에게 명시적 피드백 + 오프라인일 땐 fetch 시도 줄임
function initNetworkStatus() {
    let lastState = navigator.onLine;
    function paint(online) {
        const dot = document.getElementById('statusDot');
        const lbl = document.getElementById('feedStatus');
        if (lbl) lbl.textContent = online ? 'ONLINE' : 'OFFLINE';
        if (dot) dot.style.background = online ? '#34d399' : '#fca5a5';
        document.body.classList.toggle('aura-offline', !online);
    }
    paint(lastState);
    window.addEventListener('online', () => {
        if (!lastState) showToast('🌐 ' + (state.lang === 'ko' ? '온라인 — 다시 동기화' : 'Online — re-syncing'), 'ok', 2500);
        lastState = true;
        paint(true);
        try { refreshNews?.(); } catch (e) { window.AURA?.dbgWarn?.('online refresh', e); }
    });
    window.addEventListener('offline', () => {
        lastState = false;
        paint(false);
        showToast('📡 ' + (state.lang === 'ko' ? '오프라인 — 캐시만 사용' : 'Offline — cache only'), 'warn', 3000);
    });
}

// ── MOBILE GESTURES (좌측 drawer 스와이프 / 뉴스 패널 위→아래 스와이프) ──────
// 사용자 보고: 모바일 미흡 → 터치 제스처 추가
function initMobileGestures() {
    let startX = 0, startY = 0, startT = 0, dx = 0, dy = 0, tracking = false;
    document.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        startX = t.clientX; startY = t.clientY; startT = Date.now();
        dx = 0; dy = 0; tracking = true;
    }, { passive: true });
    document.addEventListener('touchmove', e => {
        if (!tracking || e.touches.length !== 1) return;
        const t = e.touches[0];
        dx = t.clientX - startX; dy = t.clientY - startY;
    }, { passive: true });
    document.addEventListener('touchend', () => {
        if (!tracking) return;
        tracking = false;
        const dt = Date.now() - startT;
        if (dt > 700) return;                       // 너무 느린 건 무시
        const ax = Math.abs(dx), ay = Math.abs(dy);
        // 가로 스와이프 (좌→우): 좌측 drawer 토글
        if (ax > 60 && ax > ay * 1.5 && startX < 60 && dx > 0) {
            try {
                state.panels.left = true;
                document.body.classList.add('left-open');
                saveSettings();
            } catch (e) { window.AURA?.dbgWarn?.('swipe left-open', e); }
            return;
        }
        // 좌측에서 우→좌로: 좌측 drawer 닫기
        if (ax > 60 && ax > ay * 1.5 && dx < 0 && document.body.classList.contains('left-open')) {
            try {
                state.panels.left = false;
                document.body.classList.remove('left-open');
                saveSettings();
            } catch (e) { window.AURA?.dbgWarn?.('swipe left-close', e); }
            return;
        }
        // 화면 위쪽에서 아래로 스와이프: 뉴스 패널 펼치기
        if (ay > 80 && ay > ax * 1.5 && dy > 0 && startY < 80) {
            const btn = document.getElementById('newsTopToggle');
            if (btn && !document.body.classList.contains('news-top-open')) btn.click();
        }
        // 뉴스 패널 안에서 위로 스와이프: 닫기
        if (ay > 80 && ay > ax * 1.5 && dy < 0 && document.body.classList.contains('news-top-open')) {
            const btn = document.getElementById('newsTopToggle');
            if (btn) btn.click();
        }
    });
}

// ── GLOBAL SEARCH (도시 + 카테고리 + 뉴스 — 사용자 보고: 검색 약함) ──────────
function ensureGlobalSearchDropdown() {
    let d = document.getElementById('globalSearchDropdown');
    if (d) return d;
    d = document.createElement('div');
    d.id = 'globalSearchDropdown';
    d.style.cssText = 'position:fixed;background:rgba(8,10,18,.97);border:1px solid rgba(255,255,255,.14);border-radius:10px;backdrop-filter:blur(12px);box-shadow:0 14px 36px rgba(0,0,0,.55);z-index:9100;max-height:60vh;overflow-y:auto;display:none;padding:6px';
    document.body.appendChild(d);
    return d;
}
function hideGlobalSearchSuggestions() {
    const d = document.getElementById('globalSearchDropdown');
    if (d) d.style.display = 'none';
}
function renderGlobalSearchSuggestions() {
    const input = $('searchInput');
    if (!input) return;
    const q = (input.value || '').trim().toLowerCase();
    const d = ensureGlobalSearchDropdown();
    if (!q || q.length < 1) { d.style.display = 'none'; return; }

    // 위치 매칭
    const rect = input.getBoundingClientRect();
    d.style.left = rect.left + 'px';
    d.style.top = (rect.bottom + 6) + 'px';
    d.style.width = rect.width + 'px';

    while (d.firstChild) d.removeChild(d.firstChild);

    const isKo = state.lang === 'ko';
    const sections = [];

    // 1) 도시
    const cities = (window.AURA_CITY_VIDEOS?.getCityList?.() || [])
        .filter(c => (c.name || '').toLowerCase().includes(q) || (c.ko || '').includes(q))
        .slice(0, 5);
    if (cities.length) sections.push({ title: isKo ? '도시' : 'Cities', items: cities.map(c => ({
        icon: '🌍',
        label: isKo ? (c.ko || c.name) : c.name,
        action: () => { window.AURA_AMBIENT?.openCity?.(c.name); hideGlobalSearchSuggestions(); }
    })) });

    // 2) 카테고리
    const cats = Object.entries(CATEGORY_LABELS)
        .filter(([k, v]) => k.includes(q) || v.label.toLowerCase().includes(q))
        .slice(0, 5);
    if (cats.length) sections.push({ title: isKo ? '카테고리' : 'Categories', items: cats.map(([k, v]) => ({
        icon: v.icon,
        label: v.label,
        action: () => { dispatchCategoryClick(k); hideGlobalSearchSuggestions(); }
    })) });

    // 3) 나라
    const countries = (typeof COUNTRIES !== 'undefined' ? COUNTRIES : [])
        .filter(c => c.code !== 'GLOBAL')
        .filter(c => (c.en || '').toLowerCase().includes(q) || (c.ko || '').includes(q) || c.code.toLowerCase().includes(q))
        .slice(0, 5);
    if (countries.length) sections.push({ title: isKo ? '나라' : 'Countries', items: countries.map(c => ({
        icon: c.flag || '🏳️',
        label: isKo ? c.ko : c.en,
        action: () => { selectCountry(c.code, false); hideGlobalSearchSuggestions(); }
    })) });

    if (sections.length === 0) { d.style.display = 'none'; return; }

    sections.forEach(sec => {
        const head = make('div', '', sec.title);
        head.style.cssText = 'font-family:ui-monospace,monospace;font-size:9px;color:rgba(255,255,255,.45);padding:6px 10px 4px;letter-spacing:.1em';
        d.appendChild(head);
        sec.items.forEach(it => {
            const btn = make('button', '');
            btn.type = 'button';
            btn.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;background:transparent;border:1px solid transparent;border-radius:6px;color:#e2e8f0;font-size:12px;text-align:left;cursor:pointer;transition:background .12s';
            btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(255,255,255,.07)');
            btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
            btn.appendChild(make('span', '', it.icon));
            btn.appendChild(make('span', '', it.label));
            btn.addEventListener('mousedown', e => { e.preventDefault(); it.action(); });
            d.appendChild(btn);
        });
    });
    d.style.display = 'block';
}

// ── CATEGORIES QUICK PANEL (톱니바퀴 클릭 시 토글) ───────────────────────────
// 사용자 요청: "오른쪽 설정모양 버튼 누르면 카테고리창 나오고 다시 누르면 사라지고"
const CATEGORY_LABELS = {
    travel:    { icon: '✈️', label: 'TRAVEL' },
    flights:   { icon: '🛫', label: 'BOOK' },
    cost:      { icon: '💰', label: 'COST' },
    festivals: { icon: '🎪', label: 'FESTIVALS' },
    concerts:  { icon: '🎤', label: 'CONCERTS' },
    movies:    { icon: '🎬', label: 'MOVIES' },
    games:     { icon: '🎮', label: 'GAMES' },
    charts:    { icon: '♫',  label: 'MUSIC' },
    hotspots:  { icon: '🔥', label: 'NEWS' },
    fx:        { icon: '💱', label: 'FX' }
};

function dispatchCategoryClick(cat) {
    trackCategoryClick(cat);
    // 도크 버튼과 동일 라우팅 (dock-buttons.js 의 handleClick 과 같은 로직)
    if (cat === 'fx')      { window.AURA_FX?.open?.();      return; }
    if (cat === 'cost')    { window.AURA_COST?.open?.();    return; }
    if (cat === 'flights') { window.AURA_FLIGHTS?.open?.(); return; }
    if (window.openCategoryInfo) window.openCategoryInfo(cat);
}

// 사용자 보고: "Reading signals are learning your interests..." 텍스트만 있고 실제로 학습 X
// → 카테고리 클릭을 localStorage 에 누적하고, 설정에서 상위 카테고리 보여줌
const PERSONALIZATION_KEY = 'aura_cat_clicks_v1';
function loadCatClicks() {
    try { return JSON.parse(localStorage.getItem(PERSONALIZATION_KEY) || '{}'); }
    catch { return {}; }
}
function saveCatClicks(map) {
    if (window.AURA?.safeStorageSetGuarded) {
        window.AURA.safeStorageSetGuarded(PERSONALIZATION_KEY, map);
    } else {
        try { localStorage.setItem(PERSONALIZATION_KEY, JSON.stringify(map)); } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
    }
}
function trackCategoryClick(cat) {
    if (!cat) return;
    const m = loadCatClicks();
    m[cat] = (m[cat] || 0) + 1;
    m.__updated = Date.now();
    saveCatClicks(m);
    renderPersonalization();
}
function renderPersonalization() {
    const el = document.getElementById('personalizationBody');
    if (!el) return;
    const m = loadCatClicks();
    const entries = Object.entries(m)
        .filter(([k]) => k !== '__updated')
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    if (entries.length === 0) {
        el.textContent = state.lang === 'ko'
            ? '카테고리 클릭이 누적되면 자주 쓰는 항목이 여기 보여요.'
            : 'Click a category and we\'ll start learning what you use most.';
        return;
    }
    while (el.firstChild) el.removeChild(el.firstChild);
    const head = document.createElement('div');
    head.style.cssText = 'margin-bottom:8px;color:var(--text-dim);font-size:11px';
    head.textContent = state.lang === 'ko' ? '자주 쓰는 카테고리:' : 'Most used:';
    el.appendChild(head);
    entries.forEach(([cat, n]) => {
        const info = CATEGORY_LABELS[cat] || { icon: '•', label: cat };
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;padding:4px 0;font-size:12px';
        const left = document.createElement('span');
        left.textContent = `${info.icon} ${info.label}`;
        const right = document.createElement('span');
        right.style.cssText = 'color:rgba(255,255,255,.4);font-family:ui-monospace,monospace';
        right.textContent = `${n}`;
        row.appendChild(left);
        row.appendChild(right);
        el.appendChild(row);
    });
}

// 카테고리 퀵 패널 제거 — 톱니바퀴는 설정 모달만 열음 (사용자 요청)
function initCategoriesSettings() { /* no-op (퀵 패널 폐기) */ }

// ── NEWS TOP-DOWN TOGGLE (사용자 요청: 우측 대신 위에서 내려오는 패널) ───────
function initNewsTopToggle() {
    document.body.classList.add('news-top-mode');
    const btn = $('newsTopToggle');
    if (!btn) return;
    // v567 발열: 모바일 자동 펼침 OFF — 50+ 뉴스 카드 동시 렌더 = CPU/GPU 부하.
    // 사용자가 NEWS 토글 tap 시에만 펼침. (이전 v558 의 자동 펼침은 발열 누적 원인)
    document.body.classList.remove('news-top-open');
    btn.setAttribute('aria-expanded', 'false');

    function toggle() {
        const open = !document.body.classList.contains('news-top-open');
        document.body.classList.toggle('news-top-open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        // 우측 토글 버튼/state.panels.right와 동기화 (기존 로직 호환)
        try { state.panels.right = open; saveSettings(); } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
    }
    btn.addEventListener('click', toggle);

    // ESC로 닫기
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && document.body.classList.contains('news-top-open')) {
            document.body.classList.remove('news-top-open');
            btn.setAttribute('aria-expanded', 'false');
        }
    });
}

// ── COUNTRY PICKER (right drawer dropdown) ─────────────────────────────────
// 우측 뉴스 패널 헤더 클릭 → 위에서 아래로 펼쳐지는 나라 선택 panel.
// 선택하면 selectCountry(code) 호출 → 그 나라 뉴스만 표시.
function initCountryPicker() {
    const btn = $('countryPickerBtn');
    const panel = $('countryPickerPanel');
    const list = $('countryPickerList');
    const search = $('countryPickerSearch');
    if (!btn || !panel || !list) return;

    const isKo = () => state.lang === 'ko';

    function renderList(filter = '') {
        clearNode(list);
        const term = filter.trim().toLowerCase();
        const stats = countryStats();              // 뉴스 카운트 포함 통계
        const countByCode = Object.fromEntries(stats.map(s => [s.code, s.newsCount || 0]));

        const items = COUNTRIES
            .filter(c => c.code !== 'GLOBAL')
            .filter(c => {
                if (!term) return true;
                const ko = (c.ko || '').toLowerCase();
                const en = (c.en || '').toLowerCase();
                return ko.includes(term) || en.includes(term) || c.code.toLowerCase().includes(term);
            })
            // 뉴스 많은 순 + 알파벳
            .sort((a, b) => {
                const ca = countByCode[a.code] || 0;
                const cb = countByCode[b.code] || 0;
                if (cb !== ca) return cb - ca;
                return countryName(a).localeCompare(countryName(b));
            });

        if (items.length === 0) {
            const empty = make('div', 'country-picker-empty', isKo() ? '검색 결과 없음' : 'No matches');
            list.appendChild(empty);
            return;
        }

        items.forEach(c => {
            const row = make('button', 'country-picker-item' + (c.code === state.country ? ' active' : ''));
            row.type = 'button';
            row.dataset.code = c.code;
            row.appendChild(make('span', 'country-picker-flag', c.flag || '🌍'));
            row.appendChild(make('span', 'country-picker-name', countryName(c)));
            const cnt = countByCode[c.code] || 0;
            row.appendChild(make('span', 'country-picker-count', cnt > 0 ? `${cnt}` : '·'));
            row.addEventListener('click', () => {
                selectCountry(c.code, false);
                close();
            });
            list.appendChild(row);
        });
    }

    function open() {
        panel.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        renderList(search?.value || '');
        setTimeout(() => search?.focus(), 50);
    }
    function close() {
        panel.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        if (search) search.value = '';
    }
    function toggle() {
        if (panel.hidden) open(); else close();
    }

    btn.addEventListener('click', e => {
        e.stopPropagation();
        toggle();
    });
    search?.addEventListener('input', e => renderList(e.target.value));
    search?.addEventListener('keydown', e => {
        if (e.key === 'Escape') { close(); btn.focus(); }
        if (e.key === 'Enter') {
            const first = list.querySelector('.country-picker-item');
            if (first) first.click();
        }
    });

    // 바깥 클릭 → 닫기
    document.addEventListener('click', e => {
        if (panel.hidden) return;
        if (panel.contains(e.target) || btn.contains(e.target)) return;
        close();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !panel.hidden) close();
    });
}

// ── MUSIC CONTROL PANEL ─────────────────────────────────────────────────────
// v596 — play/pause 버튼 아이콘 (unicode → SVG): 사용자 '재생/멈춤 버튼 변경' 요청.
// 두 SVG 정의 — innerHTML 로 쓰지 않고 path 직접 교체.
const _MC_ICON_PLAY  = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const _MC_ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
function setPlayBtnIcon(btn, playing) {
    if (!btn) return;
    btn.innerHTML = playing ? _MC_ICON_PAUSE : _MC_ICON_PLAY;
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
}

// 좌하단 음악 컨트롤(#musicControl) 핸들러: 장르/볼륨/재생/펙셀스 키
function initMusicControl() {
    const vol = $('mcVolume');
    const volNum = $('mcVolumeNum');
    const toggleBtn = $('mcToggle');
    const genreSel = $('mcGenre');

    // ─── 음악 컨트롤 — 데스크톱: 마우스 드래그 / 모바일: 동그란 토글 + 터치 드래그 + 좌측 dismiss ───
    const panel = $('musicControl');
    const isMobileMC = () => window.innerWidth <= 768;

    if (panel) {
        // 데스크톱 위치 저장만 복원 (모바일에선 좌하단 dock 위에 고정)
        if (!isMobileMC()) {
            try {
                const saved = JSON.parse(localStorage.getItem('aura_music_pos') || 'null');
                if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
                    panel.style.left = saved.left + 'px';
                    panel.style.top = saved.top + 'px';
                    panel.style.right = 'auto';
                    panel.style.bottom = 'auto';
                }
            } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
        } else {
            // 모바일 — 이전에 dismiss 했으면 복원 안 함, 저장된 위치 있으면 복원 (v596)
            try {
                if (localStorage.getItem('aura_mc_hidden') === '1') {
                    document.body.classList.add('mc-hidden');
                }
                const savedM = JSON.parse(localStorage.getItem('aura_music_pos_m') || 'null');
                if (savedM && Number.isFinite(savedM.left) && Number.isFinite(savedM.top)) {
                    panel.style.left = savedM.left + 'px';
                    panel.style.top = savedM.top + 'px';
                    panel.style.right = 'auto';
                    panel.style.bottom = 'auto';
                }
            } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
            // 모바일 복원 FAB 인젝트 (dismiss 후 다시 부르기용)
            if (!document.getElementById('mcRestoreFab')) {
                const fab = document.createElement('button');
                fab.id = 'mcRestoreFab';
                fab.type = 'button';
                fab.className = 'mc-restore-fab';
                fab.setAttribute('aria-label', 'Restore music control');
                fab.textContent = '🎵';
                fab.addEventListener('click', () => {
                    document.body.classList.remove('mc-hidden');
                    try { localStorage.removeItem('aura_mc_hidden'); } catch (e) { /* */ }
                });
                document.body.appendChild(fab);
            }
        }

        // ─── 드래그 + 탭 토글 (pointer events: 마우스/터치 통합) ───
        let dragging = false, moved = false;
        let startX = 0, startY = 0, startLeft = 0, startTop = 0;
        const DRAG_THRESHOLD = 5;

        function isInteractive(el) {
            if (!el) return false;
            const tag = (el.tagName || '').toLowerCase();
            return ['input', 'select', 'button', 'option'].includes(tag) ||
                   el.closest('button, select, input');
        }

        panel.addEventListener('pointerdown', (e) => {
            // 인터랙티브 요소 (장르 select, 재생 버튼) 는 드래그/토글 X
            if (isInteractive(e.target)) return;
            const rect = panel.getBoundingClientRect();
            dragging = true; moved = false;
            startX = e.clientX; startY = e.clientY;
            startLeft = rect.left; startTop = rect.top;
            try { panel.setPointerCapture(e.pointerId); } catch (err) { /* */ }
            panel.classList.add('dragging');
        });
        panel.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - startX, dy = e.clientY - startY;
            if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) moved = true;
            if (!moved) return;
            const newLeft = startLeft + dx;
            const maxTop = window.innerHeight - panel.offsetHeight - 4;
            const newTop = Math.max(4, Math.min(maxTop, startTop + dy));
            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        });
        panel.addEventListener('pointerup', (e) => {
            if (!dragging) return;
            dragging = false;
            panel.classList.remove('dragging');
            try { panel.releasePointerCapture(e.pointerId); } catch (err) { /* */ }

            if (!moved) {
                // 단순 탭 — 모바일에선 collapsed/expanded 토글
                if (isMobileMC()) {
                    document.body.classList.toggle('mc-expanded');
                    try { if (navigator.vibrate) navigator.vibrate(8); } catch (err) { /* */ }
                }
                return;
            }
            // 드래그 종료 — 모바일에서 좌측 화면 밖으로 끌었으면 dismiss
            const rect = panel.getBoundingClientRect();
            if (isMobileMC() && rect.right < 28) {
                document.body.classList.add('mc-hidden');
                document.body.classList.remove('mc-expanded');
                try { localStorage.setItem('aura_mc_hidden', '1'); } catch (err) { /* */ }
                return;
            }
            // v596 — 데스크톱·모바일 모두 위치 저장 (사용자: '모바일도 자유 이동').
            if (isMobileMC()) {
                // 화면 안으로 살짝 들이밀어 보이게
                const safeLeft = Math.max(4, Math.min(window.innerWidth - panel.offsetWidth - 4, rect.left));
                const safeTop  = Math.max(4, Math.min(window.innerHeight - panel.offsetHeight - 4, rect.top));
                panel.style.left = safeLeft + 'px';
                panel.style.top = safeTop + 'px';
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
                try { localStorage.setItem('aura_music_pos_m', JSON.stringify({ left: safeLeft, top: safeTop })); }
                catch (err) { /* */ }
            } else {
                try { localStorage.setItem('aura_music_pos', JSON.stringify({ left: rect.left, top: rect.top })); }
                catch (err) { /* */ }
            }
        });
    }

    // 저장된 볼륨 복원 (0..1 단위)
    try {
        const savedVol = parseFloat(localStorage.getItem('aura_volume'));
        if (!Number.isNaN(savedVol) && vol) {
            vol.value = String(Math.round(savedVol * 100));
            if (volNum) volNum.textContent = vol.value;
        }
    } catch (e) { window.AURA?.dbgWarn?.("silent",e); }

    // 볼륨 변경 → SomaFM <audio> + 도시 SoundCloud + YouTube 모두 동기화
    function applyVolume(pct) {
        const clamped = Math.max(0, Math.min(100, Math.round(pct)));
        const ratio = clamped / 100;
        try {
            localStorage.setItem('aura_volume', String(ratio));
            localStorage.setItem('aura_volume_pct', String(clamped));
        } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
        if (volNum) volNum.textContent = String(clamped);
        // SomaFM <audio>
        if (mcAudio) mcAudio.volume = ratio;
        // YouTube iframe (도시 모드 ambient)
        try {
            const yf = document.getElementById('ambSoundFrame');
            yf?.contentWindow?.postMessage(
                JSON.stringify({ event: 'command', func: 'setVolume', args: [clamped] }),
                '*'
            );
        } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
        // 도시용 SoundCloud Widget
        document.querySelectorAll('#scPlayerContainer iframe').forEach(sc => {
            try {
                if (window.SC?.Widget) window.SC.Widget(sc).setVolume(clamped);
            } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
        });
    }

    vol?.addEventListener('input', e => applyVolume(parseFloat(e.target.value)));

    // 사용자 보고: "Piano Cafe인데 신스팝 나옴" → SomaFM 채널 정확 매칭으로 재정비.
    // SomaFM이 못 커버하는 장르 (kpop/classical/latin/rock/piano)는 RadioBrowser API 로 보충.
    // 채널 검증: https://somafm.com/listen/ 에서 각 채널 실제 분위기 확인 후 매칭.
    const SF = (slug) => `https://ice1.somafm.com/${slug}-128-mp3`;
    const SF2 = (slug) => `https://ice2.somafm.com/${slug}-128-mp3`;
    const SF_HD = (slug) => `https://ice1.somafm.com/${slug}-256-mp3`;

    const GENRE_AUDIO = {
        // ─── SomaFM 정확 매칭 ───
        lofi:      [SF('groovesalad'), SF_HD('groovesalad'), SF('groovesaladclassic'), SF('beatblender'), SF('cliqhop')],
        study:     [SF('groovesalad'), SF('cliqhop'), SF('beatblender'), SF('dronezone'), SF('lush')],
        chill:     [SF('groovesalad'), SF('lush'), SF('illstreet'), SF('beatblender'), SF('cliqhop')],
        ambient:   [SF('dronezone'), SF('deepspaceone'), SF('spacestation'), SF('missioncontrol'), SF('secretofthemoss')],
        jazz:      [SF2('secretagent'), SF('sonicuniverse'), SF('illstreet'), SF('jollysoul')],
        bossa:     [SF('illstreet'), SF2('secretagent')],         // thistle(folk) 빠짐
        coffee:    [SF2('secretagent'), SF('illstreet'), SF('lush'), SF('jollysoul')],
        synthwave: [SF('defcon'), SF('u80s'), SF('digitalis'), SF('illstreet')],
        hiphop:    [SF('beatblender'), SF('groovesalad'), SF('cliqhop')],
        nature:    [SF('dronezone'), SF('deepspaceone'), SF('secretofthemoss')],
        folk:      [SF('folkfwd'), SF('thistle'), SF('jollysoul')],
        metal:     [SF('metal'), SF('doomed'), SF('darkindustrial')],
        '70s':     [SF('seventies'), SF('jollysoul'), SF('left_coast_70s')],
        '80s':     [SF('u80s'), SF('digitalis')],
        indie:     [SF('indiepop'), SF('poptron'), SF('thetrip')],
        reggae:    [SF('reggae')],
        cityPop:   [SF('u80s'), SF('poptron'), SF('thetrip')],
        // ─── RadioBrowser API (장르 정확 채널 — SomaFM에 없는 것들) ───
        // 빈 배열 = playGenreAudio 가 RadioBrowser로 자동 폴백
        piano:     [],   // SomaFM에 piano 없음 → RadioBrowser로
        kpop:      [],   // K-pop도 RadioBrowser
        latin:     [],
        classical: [],
        rock:      []
    };
    const GENRE_AUDIO_DEFAULT_LIST = GENRE_AUDIO.lofi;
    // RadioBrowser 검색 태그 (위 빈 배열인 장르 + 백업)
    const GENRE_TAGS = {
        piano:     'piano',
        kpop:      'kpop',
        latin:     'latin',
        classical: 'classical',
        rock:      'rock',
        bossa:     'bossanova',
        synthwave: 'synthwave',
        cityPop:   'citypop',
        jazz:      'jazz',
        chill:     'chill',
        coffee:    'lounge',
        ambient:   'ambient',
        '70s':     '70s',
        '80s':     '80s',
        folk:      'folk',
        metal:     'metal',
        indie:     'indie',
        reggae:    'reggae',
        hiphop:    'hiphop',
        nature:    'nature',
        lofi:      'lofi',
        study:     'study'
    };

    // RadioBrowser API — 무료, 키 없음, 전세계 라디오 스테이션
    // CORS 허용 + click counter 제공해서 인기순 정렬
    const RB_CACHE_KEY = 'aura_radiobrowser_v1';
    const RB_TTL = 7 * 24 * 60 * 60 * 1000;   // 7일
    function loadRbCache() {
        try { return JSON.parse(localStorage.getItem(RB_CACHE_KEY) || '{}'); }
        catch { return {}; }
    }
    function saveRbCache(c) {
        if (window.AURA?.safeStorageSetGuarded) window.AURA.safeStorageSetGuarded(RB_CACHE_KEY, c);
        else { try { localStorage.setItem(RB_CACHE_KEY, JSON.stringify(c)); } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); } }
    }
    async function fetchRadioBrowser(tag) {
        const cache = loadRbCache();
        if (cache[tag] && (Date.now() - cache[tag].ts) < RB_TTL && cache[tag].urls?.length) {
            return cache[tag].urls;
        }
        try {
            // 미러 서버 3개 → 첫 응답 사용
            const mirrors = ['de1.api.radio-browser.info', 'fi1.api.radio-browser.info', 'at1.api.radio-browser.info'];
            const mirror = mirrors[Math.floor(Math.random() * mirrors.length)];
            const url = `https://${mirror}/json/stations/search?tag=${encodeURIComponent(tag)}&order=clickcount&reverse=true&limit=15&hidebroken=true&codec=mp3`;
            const r = await fetch(url, { headers: { 'User-Agent': 'AURA-WorldPulse/1.0' } });
            if (!r.ok) return [];
            const data = await r.json();
            const urls = (data || [])
                .filter(s => s.url_resolved && /^https?:\/\//i.test(s.url_resolved) && !/listen\.pls$/i.test(s.url_resolved))
                .map(s => s.url_resolved);
            if (urls.length) {
                cache[tag] = { urls, ts: Date.now() };
                saveRbCache(cache);
            }
            return urls;
        } catch (e) {
            window.AURA?.dbgWarn?.('radiobrowser ' + tag, e);
            return [];
        }
    }

    async function pickGenreStream(genreKey, lastSrc) {
        const list = GENRE_AUDIO[genreKey] || GENRE_AUDIO_DEFAULT_LIST;
        let pool = list;
        // SomaFM이 비어있는 장르는 RadioBrowser로 채움
        if (pool.length === 0 && GENRE_TAGS[genreKey]) {
            pool = await fetchRadioBrowser(GENRE_TAGS[genreKey]);
            if (pool.length === 0) pool = GENRE_AUDIO_DEFAULT_LIST;   // 그래도 없으면 lofi
        }
        if (pool.length === 1) return pool[0];
        const candidates = pool.filter(u => u !== lastSrc);
        const finalPool = candidates.length ? candidates : pool;
        return finalPool[Math.floor(Math.random() * finalPool.length)];
    }

    let mcAudio = null;
    function getMcAudio() {
        if (mcAudio) return mcAudio;
        mcAudio = document.createElement('audio');
        mcAudio.id = 'mcAudio';
        mcAudio.preload = 'none';
        // 라이브 스트림 끊기면 자동 다음 채널로
        mcAudio.addEventListener('error', async () => {
            console.warn('[MUSIC] 스트림 에러 → 다음 채널');
            const g = ($('mcGenre')?.value) || 'lofi';
            const next = await pickGenreStream(g, mcAudio.src);
            if (next && next !== mcAudio.src) {
                mcAudio.src = next;
                mcAudio.play().catch(() => {});
            }
        });
        mcAudio.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
        document.body.appendChild(mcAudio);
        return mcAudio;
    }

    async function playGenreAudio(genreKey, lastSrc = null) {
        const src = await pickGenreStream(genreKey, lastSrc || (mcAudio?.src || ''));
        const a = getMcAudio();
        if (a.src !== src) a.src = src;
        const v = parseInt(localStorage.getItem('aura_volume_pct') || '50', 10);
        a.volume = Math.max(0, Math.min(100, v)) / 100;
        try {
            await a.play();
        } catch (err) {
            console.warn('[MUSIC] play 실패:', err);
            showToast('🎵 재생 실패 — 한 번 더 클릭해 보세요', 'warn', 3000);
        }
    }

    function stopGenreAudio() {
        if (mcAudio) { try { mcAudio.pause(); } catch (e) { window.AURA?.dbgWarn?.("silent",e); } }
    }

    // 사용자 요청: 한 채널만 듣지 말고 다른 채널로 넘기는 "다음" 버튼
    function nextGenreStream() {
        const g = ($('mcGenre')?.value) || 'lofi';
        const last = mcAudio?.src || '';
        playGenreAudio(g, last);
    }
    window.AURA_MUSIC_NEXT = nextGenreStream;

    // 재생/일시정지 — 도시 선택돼 있으면 AURA_AMBIENT 위임, 아니면 SomaFM 스트림 직접 재생
    let mcPlaying = false;
    toggleBtn?.addEventListener('click', () => {
        const ambState = window.AURA_AMBIENT?.getState?.();
        const hasCity = !!ambState?.currentCity;
        if (hasCity) {
            if (window.AURA_AMBIENT?.toggleSound) window.AURA_AMBIENT.toggleSound();
            mcPlaying = !ambState?.soundOn;
        } else {
            mcPlaying = !mcPlaying;
            if (mcPlaying) {
                const g = genreSel?.value || 'lofi';
                playGenreAudio(g);
            } else {
                stopGenreAudio();
            }
        }
        setPlayBtnIcon(toggleBtn, mcPlaying);
        toggleBtn.classList.toggle('on', mcPlaying);
        toggleBtn.classList.toggle('playing', mcPlaying);
    });

    genreSel?.addEventListener('change', e => {
        const g = e.target.value;
        try { localStorage.setItem('aura_music_genre', g); } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
        if (mcPlaying) {
            const ambState = window.AURA_AMBIENT?.getState?.();
            if (ambState?.currentCity && window.AURA_AMBIENT?.openCity) {
                window.AURA_AMBIENT.openCity(ambState.currentCity);
            } else {
                playGenreAudio(g);
            }
        }
    });

    // ⏭ 다음 채널 — 같은 장르 안에서 다른 채널로 전환 (사용자 요청: "한가지만 안 보게")
    $('mcNext')?.addEventListener('click', () => {
        if (!mcPlaying) {
            mcPlaying = true;
            setPlayBtnIcon(toggleBtn, true);
            toggleBtn.classList.add('on');
            toggleBtn.classList.add('playing');
        }
        nextGenreStream();
    });

    // 저장된 장르 복원
    try {
        const savedGenre = localStorage.getItem('aura_music_genre');
        if (savedGenre && genreSel) genreSel.value = savedGenre;
    } catch (e) { window.AURA?.dbgWarn?.("silent",e); }

    // Pexels 키 UI 제거됨 (사용자가 aura-secrets.js 또는 Worker 환경변수로 직접 설정)
}

// ── BOOT ────────────────────────────────────────────────────────────────────
async function boot() {
    loadSettings();

    // file:// 프로토콜 감지 → 사용자에게 경고
    if (location.protocol === 'file:') {
        console.warn('[AURA] Running on file:// — Most RSS will fail. Use a local server: python -m http.server 8000');
        setTimeout(() => {
            const isKo = state.lang === 'ko';
            showToast(isKo
                ? '⚠️ file://에서 실행 중 — RSS 거의 다 차단됨. 로컬 서버 추천: python -m http.server 8000'
                : '⚠️ Running on file:// — RSS will fail. Use: python -m http.server 8000', 8000);
        }, 3000);
    }

    state.bookmarks = readJson(BOOKMARKS_KEY, []);
    state.translateCache = readJson(TRANSLATE_KEY, {});
    loadIntel();
    state.allArticles = loadStoredArticles();
    state.articlesByCountry = aggregateByCountry(state.allArticles);

    syncPanels();
    applyLang();
    applyTheme();

    setLoadingProgress(8, 'BOOT SEQUENCE...', 'Restoring state');
    updateClock();
    setInterval(updateClock, 30000);

    if ($('themeSelect')) $('themeSelect').value = state.theme;
    if ($('notificationsToggle')) $('notificationsToggle').checked = state.notifications;
    if ($('languageSelect')) $('languageSelect').value = state.lang;

    setLoadingProgress(22, 'RENDERING SHELL...', 'Building panels');
    initEvents();
    renderAll();

    setLoadingProgress(36, 'LOADING GLOBE...', 'Starting 3D world');
    initGlobe();
    refreshGlobeMarkers();

    // Aircraft layer DISABLED in v5.1 — replaced with events layer
    // (Aircraft tick/fetch code removed for performance)

    setLoadingProgress(55, 'LOADING WORLD DATA...', 'Quakes · Disasters · Weather');

    setLoadingProgress(60, 'CONNECTING FEEDS...', `${RSS_FEEDS.length} sources`);
    initCountdown();

    // UI 먼저 표시 — perf: 1.2s → 0.5s
    setLoadingProgress(70, 'Loading...', 'Almost ready');
    setTimeout(() => {
        setLoadingProgress(100, `WORLD PULSE ONLINE · v${VERSION}`, 'Observe the world');
        hideLoading();
        document.dispatchEvent(new CustomEvent('aura:ready', { detail: { state } }));
    }, 500);

    // 데이터는 백그라운드에서 로드 (UI 막지 않음)
    Promise.allSettled([refreshNews(true), refreshAux(true)]).then(() => {
        if (window.refreshGlobeMarkers) window.refreshGlobeMarkers();
        showToast(t(`${state.feedsLoaded}/${state.feedsTotal} feeds connected`, `${state.feedsLoaded}/${state.feedsTotal} 피드 연결`));
    });

    clearInterval(auxInterval);
    auxInterval = setInterval(() => refreshAux(), AUX_REFRESH);

    // ─── perf: 탭이 백그라운드일 때 polling 일시정지 (사용자 요청: 렉 안 걸리게) ───
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // 탭 가려졌을 때 — 모든 polling 정지
            clearInterval(countdownInterval);
            clearInterval(auxInterval);
            countdownInterval = null;
            auxInterval = null;
            // 지구본 자동회전도 정지 (CPU 절감)
            try { if (window.globeInstance) window.globeInstance.controls().autoRotate = false; } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
        } else {
            // 탭 다시 보임 — 재개
            if (!countdownInterval) initCountdown();
            if (!auxInterval) auxInterval = setInterval(() => refreshAux(), AUX_REFRESH);
            // 한번 즉시 갱신
            try { refreshAux(); } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
        }
    });
}

window.addEventListener('DOMContentLoaded', boot);

// ── EXPOSE FOR INTEL ENGINE + OPTIMIZATION + UX v2 ──────────────────────────
// 다른 모듈이 접근할 수 있도록 주요 객체/함수를 window에 노출
window.state = state;
window.COUNTRIES = COUNTRIES;
window.RSS_FEEDS = RSS_FEEDS;
window.STOPWORDS = STOPWORDS;
window.$ = $;
window.make = make;
window.safeText = safeText;
window.showToast = showToast;
window.selectCountry = selectCountry;
window.syncPanels = syncPanels;
window.collectPhrases = collectPhrases;
window.titleCase = titleCase;
window.getNewsPool = getNewsPool;
window.renderAll = renderAll;
window.renderRightPanel = renderRightPanel;
window.scoreArticle = scoreArticle;
window.toggleBookmark = toggleBookmark;
window.saveJson = saveJson;
window.relTime = relTime;

// ── 진단 도구 (콘솔에서 AURA_DIAG() 호출) ───────────────────────────────────
window.AURA_DIAG = function() {
    const r = {
        '1. CDN Ready':       window.__CDN_READY === true ? '✓' : '✗',
        '2. THREE loaded':    typeof window.THREE !== 'undefined' ? '✓' : '✗',
        '3. Globe loaded':    typeof window.Globe !== 'undefined' ? '✓' : '✗',
        '4. globeInstance':   window.globeInstance ? '✓' : '✗',
        '5. globe div':       document.getElementById('globe') ? '✓' : '✗',
        '6. globe canvas':    document.querySelector('#globe canvas') ? '✓' : '✗',
        '7. AURA_AMBIENT':    window.AURA_AMBIENT ? '✓' : '✗',
        '8. AURA_CITY_VIDEOS': window.AURA_CITY_VIDEOS ? '✓' : '✗',
        '9. AURA_CAFE':       window.AURA_CAFE ? '✓' : '✗',
        '10. Stage':          state.stage,
        '11. Active stage view': document.querySelector('.stage-view.active')?.dataset?.stage || 'NONE',
        '12. Articles loaded': state.allArticles?.length || 0,
        '13. Loading overlay': document.getElementById('loadingOverlay') ? 'STILL VISIBLE' : '✓ removed'
    };
    console.table(r);
    if (!window.__CDN_READY) console.error('❌ CDN 라이브러리 로드 실패. 인터넷 또는 방화벽 확인.');
    if (!window.globeInstance) console.error('❌ 지구본 초기화 실패. F5로 재시도.');
    return r;
};
window.applyTopicFilter = applyTopicFilter;
window.buildGlobeMarkers = buildGlobeMarkers;
window.refreshGlobeMarkers = refreshGlobeMarkers;
// COUNTRIES + selectCountry 노출 — mobile-map.js 의 국가 picker 에서 사용
window.AURA_COUNTRIES = COUNTRIES;
window.selectCountry = selectCountry;
window.openCountryModal = openCountryModal;
window.countryByCode = countryByCode;
window.nearestCountryByLatLng = nearestCountryByLatLng;
window.weatherLabel = weatherLabel;
window.aqiLabel = aqiLabel;
window.openCountryModal = openCountryModal;
window.closeCountryModal = closeCountryModal;
window.__isValidRss = isValidRss;
window.__parseRss = parseRss;

// 전역 노출 (dock-buttons.js에서 호출)
window.openCategoryInfo = openCategoryInfo;

// 전역 노출 (marker-panel.js)
window.saveSettings = saveSettings;
window.renderLayerControls = renderLayerControls;
