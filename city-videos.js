// AURA — City Vibes v7 (도시 60+, Pexels 영상 자동 fetch + 그라디언트 폴백)
'use strict';
(function() {

    // 60+ 도시 (사용자 요청: 도시 많이 늘려줘)
    // 영상 URL은 Pexels API에서 자동 fetch (city-videos.js에 hardcode 안 함)
    // customQueries: Pexels에서 도시명만으론 4K 결과가 적은 도시용 큐레이션 쿼리.
    //   - 한·아시아 일부 도시는 'Seoul'만으론 결과가 적거나 화질 낮음.
    //   - 영문 키워드(landmark/region)로 풍부한 4K 풀 확보.
    const CITY_VIDEOS = {
        // ─── East Asia ───────────────────────────────────────────────
        'Seoul':        { lat: 37.5665,  lng: 126.978,   ko: '서울',         tag: 'kpop',       status: { ko: '서울의 밤',     en: 'Seoul night' },
                          customQueries: ['Seoul night aerial 4k', 'Han River Seoul drone', 'Gangnam Seoul timelapse', 'Namsan tower Seoul', 'Korea Seoul cityscape 4k', 'Seoul skyline night'] },
        'Busan':        { lat: 35.1796,  lng: 129.0756,  ko: '부산',         tag: 'chill',      status: { ko: '부산 해운대',   en: 'Busan beach' },
                          customQueries: ['Haeundae beach Busan 4k', 'Busan harbor drone', 'Gwangalli bridge Busan night', 'Korea coast aerial 4k', 'Busan skyline timelapse', 'South Korea beach drone'] },
        'Tokyo':        { lat: 35.6762,  lng: 139.6503,  ko: '도쿄',         tag: 'lofi',       status: { ko: '도쿄 시부야',   en: 'Tokyo Shibuya' },
                          customQueries: ['Tokyo Shibuya crossing 4k', 'Tokyo night drone', 'Tokyo street rain', 'Shinjuku neon timelapse', 'Japan Tokyo cinematic', 'Tokyo subway aerial', 'Tokyo cherry blossom 4k', 'Akihabara Tokyo'] },
        'Osaka':        { lat: 34.6937,  lng: 135.5023,  ko: '오사카',       tag: 'lofi',       status: { ko: '오사카 야경',   en: 'Osaka night' },
                          customQueries: ['Osaka Dotonbori 4k', 'Osaka night drone', 'Osaka castle aerial', 'Japan Osaka street', 'Osaka neon timelapse', 'Osaka skyline'] },
        'Kyoto':        { lat: 35.0116,  lng: 135.7681,  ko: '교토',         tag: 'jazz',       status: { ko: '교토 사찰',     en: 'Kyoto temple' },
                          customQueries: ['Kyoto temple 4k', 'Kyoto bamboo forest', 'Fushimi Inari Kyoto', 'Japan Kyoto traditional', 'Kyoto cherry blossom', 'Kyoto pagoda drone'] },
        'Beijing':      { lat: 39.9042,  lng: 116.4074,  ko: '베이징',       tag: 'cinematic',  status: { ko: '베이징',        en: 'Beijing' },
                          customQueries: ['Beijing Forbidden City 4k', 'Great Wall China drone', 'Beijing skyline night', 'China Beijing aerial', 'Tiananmen Beijing', 'Beijing temple'] },
        'Shanghai':     { lat: 31.2304,  lng: 121.4737,  ko: '상하이',       tag: 'electronic', status: { ko: '상하이 야경',   en: 'Shanghai skyline' },
                          customQueries: ['Shanghai Bund night 4k', 'Shanghai skyline drone', 'Pudong Shanghai aerial', 'China Shanghai timelapse', 'Shanghai neon', 'Shanghai river'] },
        'Hong Kong':    { lat: 22.3193,  lng: 114.1694,  ko: '홍콩',         tag: 'electronic', status: { ko: '홍콩 야경',     en: 'HK neon' },
                          customQueries: ['Hong Kong skyline 4k', 'Hong Kong harbor drone', 'Hong Kong neon street', 'HK Victoria Peak', 'Hong Kong night timelapse', 'Hong Kong tram'] },
        'Taipei':       { lat: 25.0330,  lng: 121.5654,  ko: '타이베이',     tag: 'lofi',       status: { ko: '타이베이',      en: 'Taipei' },
                          customQueries: ['Taipei 101 4k', 'Taipei night market', 'Taiwan Taipei drone', 'Taipei skyline timelapse', 'Taipei street rain', 'Taipei aerial'] },

        // ─── SE Asia ─────────────────────────────────────────────────
        'Singapore':    { lat: 1.3521,   lng: 103.8198,  ko: '싱가포르',     tag: 'chill',      status: { ko: '싱가포르',      en: 'Singapore' },
                          customQueries: ['Singapore Marina Bay 4k', 'Singapore skyline drone', 'Gardens by the Bay', 'Singapore night timelapse', 'Singapore aerial', 'Singapore Sentosa'] },
        'Bangkok':      { lat: 13.7563,  lng: 100.5018,  ko: '방콕',         tag: 'thai-pop',   status: { ko: '방콕 거리',     en: 'Bangkok' },
                          customQueries: ['Bangkok temple 4k', 'Bangkok night market', 'Thailand Bangkok aerial', 'Bangkok tuk tuk', 'Bangkok skyline drone', 'Bangkok river floating'] },
        'Kuala Lumpur': { lat: 3.139,    lng: 101.6869,  ko: '쿠알라룸푸르', tag: 'tropical',   status: { ko: '쿠알라룸푸르',  en: 'Kuala Lumpur' } },
        'Jakarta':      { lat: -6.2088,  lng: 106.8456,  ko: '자카르타',     tag: 'tropical',   status: { ko: '자카르타',      en: 'Jakarta' } },
        'Manila':       { lat: 14.5995,  lng: 120.9842,  ko: '마닐라',       tag: 'tropical',   status: { ko: '마닐라',        en: 'Manila' } },
        'Hanoi':        { lat: 21.0285,  lng: 105.8542,  ko: '하노이',       tag: 'cinematic',  status: { ko: '하노이',        en: 'Hanoi' } },
        'Ho Chi Minh':  { lat: 10.8231,  lng: 106.6297,  ko: '호치민',       tag: 'tropical',   status: { ko: '호치민',        en: 'Saigon' } },
        'Bali':         { lat: -8.4095,  lng: 115.1889,  ko: '발리',         tag: 'tropical',   status: { ko: '발리 해변',     en: 'Bali' },
                          customQueries: ['Bali beach 4k', 'Bali rice terrace drone', 'Ubud Bali aerial', 'Bali waterfall', 'Bali sunset', 'Indonesia Bali tropical'] },

        // ─── South Asia ──────────────────────────────────────────────
        'Mumbai':       { lat: 19.076,   lng: 72.8777,   ko: '뭄바이',       tag: 'bollywood',  status: { ko: '뭄바이',        en: 'Mumbai' },
                          customQueries: ['Mumbai street 4k', 'Mumbai Marine Drive drone', 'India Mumbai aerial', 'Mumbai monsoon rain', 'Gateway of India', 'Mumbai market'] },
        'Delhi':        { lat: 28.7041,  lng: 77.1025,   ko: '델리',         tag: 'bollywood',  status: { ko: '델리',          en: 'Delhi' },
                          customQueries: ['Delhi India Gate 4k', 'Old Delhi street', 'Red Fort Delhi aerial', 'India Delhi market', 'Delhi monument', 'Delhi Connaught Place'] },
        'Bangalore':    { lat: 12.9716,  lng: 77.5946,   ko: '벵갈루루',     tag: 'electronic', status: { ko: '벵갈루루',      en: 'Bangalore' } },

        // ─── Middle East ─────────────────────────────────────────────
        'Dubai':        { lat: 25.2048,  lng: 55.2708,   ko: '두바이',       tag: 'electronic', status: { ko: '두바이',        en: 'Dubai' },
                          customQueries: ['Dubai Burj Khalifa 4k', 'Dubai skyline drone', 'Dubai desert aerial', 'Dubai Marina night', 'UAE Dubai timelapse', 'Dubai fountain', 'Dubai Palm Jumeirah'] },
        'Tel Aviv':     { lat: 32.0853,  lng: 34.7818,   ko: '텔아비브',     tag: 'electronic', status: { ko: '텔아비브',      en: 'Tel Aviv' } },
        'Istanbul':     { lat: 41.0082,  lng: 28.9784,   ko: '이스탄불',     tag: 'cinematic',  status: { ko: '이스탄불',      en: 'Istanbul' },
                          customQueries: ['Istanbul Bosphorus 4k', 'Hagia Sophia Istanbul', 'Blue Mosque Istanbul', 'Istanbul drone aerial', 'Turkey Istanbul timelapse', 'Istanbul bazaar'] },
        'Cairo':        { lat: 30.0444,  lng: 31.2357,   ko: '카이로',       tag: 'cinematic',  status: { ko: '카이로 피라미드', en: 'Cairo' },
                          customQueries: ['Cairo pyramids 4k', 'Egypt Sphinx aerial', 'Nile river Cairo', 'Cairo bazaar street', 'Cairo desert sunset', 'Egypt Cairo drone'] },
        'Marrakesh':    { lat: 31.6295,  lng: -7.9811,   ko: '마라케시',     tag: 'ambient',    status: { ko: '마라케시',      en: 'Marrakesh' },
                          customQueries: ['Marrakesh souk 4k', 'Morocco Marrakesh medina', 'Marrakesh Atlas mountains', 'Morocco market street', 'Marrakesh palace', 'Sahara desert Morocco'] },

        // ─── Europe ──────────────────────────────────────────────────
        'London':       { lat: 51.5074,  lng: -0.1278,   ko: '런던',         tag: 'jazz',       status: { ko: '런던 거리',     en: 'London' },
                          customQueries: ['London Tower Bridge 4k', 'London Eye aerial', 'Big Ben London', 'London street rain', 'UK London drone', 'London tube underground', 'London skyline night'] },
        'Paris':        { lat: 48.8566,  lng: 2.3522,    ko: '파리',         tag: 'jazz',       status: { ko: '파리 카페',     en: 'Paris' },
                          customQueries: ['Eiffel Tower 4k', 'Paris Seine river', 'Paris cafe street', 'Champs Elysees Paris', 'Paris Louvre aerial', 'Paris night drone', 'Paris rain'] },
        'Berlin':       { lat: 52.52,    lng: 13.405,    ko: '베를린',       tag: 'electronic', status: { ko: '베를린',        en: 'Berlin' },
                          customQueries: ['Berlin Brandenburg Gate 4k', 'Berlin street art', 'Berlin Wall', 'Germany Berlin aerial', 'Berlin night clubs', 'Berlin tram'] },
        'Rome':         { lat: 41.9028,  lng: 12.4964,   ko: '로마',         tag: 'cinematic',  status: { ko: '로마 광장',     en: 'Rome' },
                          customQueries: ['Rome Colosseum 4k', 'Vatican Rome aerial', 'Rome Trevi fountain', 'Italy Rome timelapse', 'Rome ancient ruins', 'Rome street'] },
        'Madrid':       { lat: 40.4168,  lng: -3.7038,   ko: '마드리드',     tag: 'latin',      status: { ko: '마드리드',      en: 'Madrid' },
                          customQueries: ['Madrid Plaza Mayor 4k', 'Madrid skyline drone', 'Madrid street tapas', 'Spain Madrid aerial', 'Madrid Royal Palace', 'Madrid night'] },
        'Barcelona':    { lat: 41.3851,  lng: 2.1734,    ko: '바르셀로나',   tag: 'latin',      status: { ko: '바르셀로나',    en: 'Barcelona' },
                          customQueries: ['Barcelona Sagrada Familia 4k', 'Barcelona beach drone', 'Park Guell Barcelona', 'Barcelona Las Ramblas', 'Spain Barcelona aerial', 'Barcelona Gothic'] },
        'Lisbon':       { lat: 38.7223,  lng: -9.1393,   ko: '리스본',       tag: 'jazz',       status: { ko: '리스본',        en: 'Lisbon' },
                          customQueries: ['Lisbon tram 4k', 'Lisbon street tile', 'Portugal Lisbon aerial', 'Lisbon viewpoint sunset', 'Lisbon Belem tower', 'Lisbon hills'] },
        'Amsterdam':    { lat: 52.3676,  lng: 4.9041,    ko: '암스테르담',   tag: 'electronic', status: { ko: '암스테르담',    en: 'Amsterdam' },
                          customQueries: ['Amsterdam canal 4k', 'Amsterdam bicycle street', 'Netherlands Amsterdam aerial', 'Amsterdam tulip', 'Amsterdam houseboat', 'Amsterdam night'] },
        'Vienna':       { lat: 48.2082,  lng: 16.3738,   ko: '비엔나',       tag: 'classical',  status: { ko: '비엔나',        en: 'Vienna' },
                          customQueries: ['Vienna palace 4k', 'Vienna Schonbrunn drone', 'Austria Vienna aerial', 'Vienna opera house', 'Vienna Christmas market', 'Vienna street'] },
        'Prague':       { lat: 50.0755,  lng: 14.4378,   ko: '프라하',       tag: 'classical',  status: { ko: '프라하',        en: 'Prague' },
                          customQueries: ['Prague castle 4k', 'Charles Bridge Prague', 'Czech Prague aerial', 'Prague old town', 'Prague astronomical clock', 'Prague Vltava river'] },
        'Athens':       { lat: 37.9838,  lng: 23.7275,   ko: '아테네',       tag: 'cinematic',  status: { ko: '아테네',        en: 'Athens' },
                          customQueries: ['Athens Acropolis 4k', 'Parthenon Athens drone', 'Greece Athens aerial', 'Santorini Greece', 'Athens ancient ruins', 'Greek island'] },
        'Stockholm':    { lat: 59.3293,  lng: 18.0686,   ko: '스톡홀름',     tag: 'ambient',    status: { ko: '스톡홀름',      en: 'Stockholm' } },
        'Copenhagen':   { lat: 55.6761,  lng: 12.5683,   ko: '코펜하겐',     tag: 'ambient',    status: { ko: '코펜하겐',      en: 'Copenhagen' } },
        'Oslo':         { lat: 59.9139,  lng: 10.7522,   ko: '오슬로',       tag: 'ambient',    status: { ko: '오슬로',        en: 'Oslo' } },
        'Reykjavik':    { lat: 64.1466,  lng: -21.9426,  ko: '레이캬비크',   tag: 'ambient',    status: { ko: '레이캬비크',    en: 'Reykjavik' } },
        'Dublin':       { lat: 53.3498,  lng: -6.2603,   ko: '더블린',       tag: 'jazz',       status: { ko: '더블린',        en: 'Dublin' } },
        'Edinburgh':    { lat: 55.9533,  lng: -3.1883,   ko: '에든버러',     tag: 'cinematic',  status: { ko: '에든버러',      en: 'Edinburgh' } },
        'Zurich':       { lat: 47.3769,  lng: 8.5417,    ko: '취리히',       tag: 'classical',  status: { ko: '취리히',        en: 'Zurich' } },

        // ─── North America ──────────────────────────────────────────
        'New York':     { lat: 40.7128,  lng: -74.006,   ko: '뉴욕',         tag: 'hiphop',     status: { ko: '뉴욕 거리',     en: 'NYC streets' },
                          customQueries: ['New York Times Square 4k', 'NYC Manhattan drone', 'Brooklyn Bridge aerial', 'NYC subway', 'New York Central Park', 'NYC street rain', 'New York skyline night', 'NYC taxi'] },
        'Los Angeles':  { lat: 34.0522,  lng: -118.2437, ko: '로스앤젤레스', tag: 'hiphop',     status: { ko: 'LA 일몰',       en: 'LA' },
                          customQueries: ['Los Angeles sunset 4k', 'LA Hollywood drone', 'Santa Monica beach', 'LA highway aerial', 'Venice Beach LA', 'LA palm trees', 'Los Angeles downtown'] },
        'San Francisco':{ lat: 37.7749,  lng: -122.4194, ko: '샌프란시스코', tag: 'lofi',       status: { ko: 'SF 안개',       en: 'SF' },
                          customQueries: ['Golden Gate Bridge 4k', 'San Francisco fog aerial', 'SF cable car', 'San Francisco bay drone', 'Lombard Street SF', 'SF Painted Ladies'] },
        'Chicago':      { lat: 41.8781,  lng: -87.6298,  ko: '시카고',       tag: 'jazz',       status: { ko: '시카고',        en: 'Chicago' },
                          customQueries: ['Chicago skyline 4k', 'Chicago river drone', 'Cloud Gate Chicago', 'Chicago L train', 'Chicago lakefront aerial', 'Chicago Millennium Park'] },
        'Miami':        { lat: 25.7617,  lng: -80.1918,  ko: '마이애미',     tag: 'latin',      status: { ko: '마이애미 비치', en: 'Miami beach' },
                          customQueries: ['Miami Beach 4k', 'South Beach Miami drone', 'Miami palm tree sunset', 'Miami art deco', 'Miami yacht aerial', 'Miami nightlife'] },
        'Las Vegas':    { lat: 36.1699,  lng: -115.1398, ko: '라스베이거스', tag: 'electronic', status: { ko: '라스베이거스',  en: 'Vegas neon' },
                          customQueries: ['Las Vegas Strip 4k', 'Vegas neon night', 'Vegas Bellagio fountain', 'Las Vegas drone aerial', 'Vegas casino', 'Vegas timelapse'] },
        'Boston':       { lat: 42.3601,  lng: -71.0589,  ko: '보스턴',       tag: 'classical',  status: { ko: '보스턴',        en: 'Boston' } },
        'Seattle':      { lat: 47.6062,  lng: -122.3321, ko: '시애틀',       tag: 'lofi',       status: { ko: '시애틀',        en: 'Seattle' } },
        'Austin':       { lat: 30.2672,  lng: -97.7431,  ko: '오스틴',       tag: 'lofi',       status: { ko: '오스틴',        en: 'Austin' } },
        'Toronto':      { lat: 43.6532,  lng: -79.3832,  ko: '토론토',       tag: 'lofi',       status: { ko: '토론토',        en: 'Toronto' } },
        'Vancouver':    { lat: 49.2827,  lng: -123.1207, ko: '밴쿠버',       tag: 'lofi',       status: { ko: '밴쿠버',        en: 'Vancouver' } },
        'Mexico City':  { lat: 19.4326,  lng: -99.1332,  ko: '멕시코시티',   tag: 'latin',      status: { ko: '멕시코시티',    en: 'Mexico City' } },

        // ─── South America ───────────────────────────────────────────
        'Rio de Janeiro':{ lat: -22.9068,lng: -43.1729,  ko: '리우',         tag: 'samba',      status: { ko: '리우 해변',     en: 'Rio' },
                          customQueries: ['Rio Christ Redeemer 4k', 'Copacabana beach drone', 'Sugarloaf Rio aerial', 'Rio Carnival', 'Brazil Rio favela', 'Ipanema beach Rio'] },
        'São Paulo':    { lat: -23.5505, lng: -46.6333,  ko: '상파울루',     tag: 'samba',      status: { ko: '상파울루',      en: 'São Paulo' } },
        'Buenos Aires': { lat: -34.6037, lng: -58.3816,  ko: '부에노스아이레스', tag: 'tango', status: { ko: '부에노스아이레스', en: 'Buenos Aires' } },
        'Lima':         { lat: -12.0464, lng: -77.0428,  ko: '리마',         tag: 'latin',      status: { ko: '리마',          en: 'Lima' } },
        'Bogota':       { lat: 4.711,    lng: -74.0721,  ko: '보고타',       tag: 'latin',      status: { ko: '보고타',        en: 'Bogota' } },
        'Santiago':     { lat: -33.4489, lng: -70.6693,  ko: '산티아고',     tag: 'latin',      status: { ko: '산티아고',      en: 'Santiago' } },

        // ─── Africa ──────────────────────────────────────────────────
        'Cape Town':    { lat: -33.9249, lng: 18.4241,   ko: '케이프타운',   tag: 'ambient',    status: { ko: '케이프타운',    en: 'Cape Town' },
                          customQueries: ['Cape Town Table Mountain 4k', 'South Africa Cape Town drone', 'Cape Town beach aerial', 'Cape Town safari', 'Cape Point lighthouse', 'Cape Town vineyard'] },
        'Lagos':        { lat: 6.5244,   lng: 3.3792,    ko: '라고스',       tag: 'tropical',   status: { ko: '라고스',        en: 'Lagos' } },
        'Nairobi':      { lat: -1.2921,  lng: 36.8219,   ko: '나이로비',     tag: 'tropical',   status: { ko: '나이로비',      en: 'Nairobi' } },

        // ─── Oceania ─────────────────────────────────────────────────
        'Sydney':       { lat: -33.8688, lng: 151.2093,  ko: '시드니',       tag: 'tropical',   status: { ko: '시드니 항구',   en: 'Sydney' },
                          customQueries: ['Sydney Opera House 4k', 'Sydney Harbour Bridge drone', 'Bondi Beach Sydney', 'Australia Sydney aerial', 'Sydney skyline night', 'Sydney ferry'] },
        'Melbourne':    { lat: -37.8136, lng: 144.9631,  ko: '멜버른',       tag: 'jazz',       status: { ko: '멜버른',        en: 'Melbourne' } },
        'Brisbane':     { lat: -27.4698, lng: 153.0251,  ko: '브리즈번',     tag: 'tropical',   status: { ko: '브리즈번',      en: 'Brisbane' } },
        'Auckland':     { lat: -36.8485, lng: 174.7633,  ko: '오클랜드',     tag: 'ambient',    status: { ko: '오클랜드',      en: 'Auckland' } },
        'Perth':        { lat: -31.9505, lng: 115.8605,  ko: '퍼스',         tag: 'tropical',   status: { ko: '퍼스',          en: 'Perth' } },

        // ─── 추가 도시 (사용자 요청: 도시 더 늘려) ──────────────────
        'Jeju':         { lat: 33.4996,  lng: 126.5312,  ko: '제주',         tag: 'ambient',    status: { ko: '제주 바다',     en: 'Jeju island' },
                          customQueries: ['Jeju island Korea 4k', 'Jeju coast drone', 'Korea volcanic island aerial', 'Jeju beach timelapse', 'tropical island 4k Asia', 'Jeju waterfall drone'] },
        'Fukuoka':      { lat: 33.5904,  lng: 130.4017,  ko: '후쿠오카',     tag: 'cityPop',    status: { ko: '후쿠오카',      en: 'Fukuoka' } },
        'Sapporo':      { lat: 43.0618,  lng: 141.3545,  ko: '삿포로',       tag: 'ambient',    status: { ko: '삿포로 눈',     en: 'Sapporo snow' } },
        'Nagoya':       { lat: 35.1815,  lng: 136.9066,  ko: '나고야',       tag: 'lofi',       status: { ko: '나고야',        en: 'Nagoya' } },
        'Chengdu':      { lat: 30.5728,  lng: 104.0668,  ko: '청두',         tag: 'cinematic',  status: { ko: '청두',          en: 'Chengdu' } },
        'Xian':         { lat: 34.3416,  lng: 108.9398,  ko: '시안',         tag: 'cinematic',  status: { ko: '시안',          en: 'Xian' } },
        'Da Nang':      { lat: 16.0544,  lng: 108.2022,  ko: '다낭',         tag: 'tropical',   status: { ko: '다낭 해변',     en: 'Da Nang' } },
        'Siem Reap':    { lat: 13.3633,  lng: 103.8564,  ko: '시엠립',       tag: 'cinematic',  status: { ko: '시엠립 앙코르', en: 'Angkor Wat' } },
        'Phuket':       { lat: 7.8804,   lng: 98.3923,   ko: '푸켓',         tag: 'tropical',   status: { ko: '푸켓 해변',     en: 'Phuket' } },
        'Doha':         { lat: 25.2854,  lng: 51.531,    ko: '도하',         tag: 'electronic', status: { ko: '도하',          en: 'Doha' } },
        'Budapest':     { lat: 47.4979,  lng: 19.0402,   ko: '부다페스트',   tag: 'classical',  status: { ko: '부다페스트',    en: 'Budapest' } },
        'Warsaw':       { lat: 52.2297,  lng: 21.0122,   ko: '바르샤바',     tag: 'classical',  status: { ko: '바르샤바',      en: 'Warsaw' } },
        'Venice':       { lat: 45.4408,  lng: 12.3155,   ko: '베니스',       tag: 'cinematic',  status: { ko: '베니스 운하',   en: 'Venice canals' },
                          customQueries: ['Venice canal gondola 4k', 'Venice Italy aerial drone', 'St Marks Venice', 'Venice Rialto bridge', 'Venice masquerade', 'Italy Venice timelapse'] },
        'Florence':     { lat: 43.7696,  lng: 11.2558,   ko: '피렌체',       tag: 'classical',  status: { ko: '피렌체',        en: 'Florence' },
                          customQueries: ['Florence Duomo 4k', 'Italy Florence aerial', 'Ponte Vecchio Florence', 'Florence Tuscany', 'Uffizi Florence', 'Florence Renaissance'] },
        'Helsinki':     { lat: 60.1699,  lng: 24.9384,   ko: '헬싱키',       tag: 'ambient',    status: { ko: '헬싱키',        en: 'Helsinki' } },
        'Valencia':     { lat: 39.4699,  lng: -0.3763,   ko: '발렌시아',     tag: 'latin',      status: { ko: '발렌시아',      en: 'Valencia' } },
        'Porto':        { lat: 41.1579,  lng: -8.6291,   ko: '포르투',       tag: 'jazz',       status: { ko: '포르투',        en: 'Porto' } },
        'Washington':   { lat: 38.9072,  lng: -77.0369,  ko: '워싱턴 DC',    tag: 'classical',  status: { ko: '워싱턴 DC',     en: 'Washington DC' } },
        'Philadelphia': { lat: 39.9526,  lng: -75.1652,  ko: '필라델피아',   tag: 'jazz',       status: { ko: '필라델피아',    en: 'Philadelphia' } },
        'Montreal':     { lat: 45.5017,  lng: -73.5673,  ko: '몬트리올',     tag: 'jazz',       status: { ko: '몬트리올',      en: 'Montreal' } },
        'Calgary':      { lat: 51.0447,  lng: -114.0719, ko: '캘거리',       tag: 'ambient',    status: { ko: '캘거리',        en: 'Calgary' } },
        'Cancun':       { lat: 21.1619,  lng: -86.8515,  ko: '칸쿤',         tag: 'tropical',   status: { ko: '칸쿤 해변',     en: 'Cancun beach' } },
        'Cartagena':    { lat: 10.391,   lng: -75.4794,  ko: '카르타헤나',   tag: 'latin',      status: { ko: '카르타헤나',    en: 'Cartagena' } }
    };

    function getCity(name) { return CITY_VIDEOS[name]; }
    function getCityList() {
        return Object.entries(CITY_VIDEOS).map(([name, d]) => ({
            name, lat: d.lat, lng: d.lng, ko: d.ko, tag: d.tag
        }));
    }

    window.AURA_CITY_VIDEOS = { CITY_VIDEOS, getCity, getCityList };
})();
