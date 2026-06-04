/*
 * saudade-voice.js — per-edition voice strings.
 *
 * Strings below are NOT translations of each other. Each language block
 * was composed natively from a short brief (in the JSDoc comment above
 * the key), in that edition's newspaper voice. Different syntax, different
 * length, different idiom is correct — that's the point.
 *
 * If you find yourself "translating from English," stop. Read the brief,
 * then write what a masthead in that language would actually print.
 *
 * Brief format:
 *   // brief: <what the line is doing on screen, what register>
 *   <key>: { en: '…', ko: '…', ja: '…', pt: '…', es: '…' }
 *
 * Template tokens:
 *   $editorCity — the city the edition is filed from (already in the
 *                 reader's language; see cityIn() in saudade.editorial.js)
 *
 * Pillar-title pairs (head + italic) are rendered as two stacked lines
 * — a roman label on top, an italic phrase under it. Compose the pair
 * together so it scans as one sentence on the page.
 */
(function () {
    if (window.SAUDADE_VOICE) return;

    /* brief: sits under the masthead on the cover. Tells the reader the
       paper publishes three cities each day, edited from a single place.
       Newspaper register; terse; no marketing tone. */
    const mastTagline = {
        en: 'Three cities, filed daily. Edited from $editorCity.',
        ko: '$editorCity 발신, 매일 세 도시.',
        ja: '$editorCity発、毎朝の三都市。',
        pt: 'Três cidades, manhã após manhã. Redação em $editorCity.',
        es: 'Tres ciudades, cada amanecer. Redacción en $editorCity.'
    };

    /* brief: pillar title for the listening room (ambient audio + city
       photographs). Roman head + italic phrase, two lines, poetic. */
    const listeningHead   = { en: 'The',  ko: '듣는', ja: '聴く', pt: 'A',  es: 'La' };
    const listeningItalic = {
        en: 'listening room.',
        ko: '방.',
        ja: '部屋。',
        pt: 'sala de escuta.',
        es: 'sala de escucha.'
    };

    /* brief: pillar title for the atlas of cafés. The editor only lists
       what they've physically sat in (or carefully read). Roman head +
       italic phrase. PT/ES use "visited" rather than "verified" because
       that's the actual editorial bar in the constitution. */
    const atlasHead   = { en: 'Cafés',     ko: '카페,',     ja: 'カフェ、', pt: 'Cafés',       es: 'Cafés'       };
    const atlasItalic = {
        en: 'verified.',
        ko: '들른 곳.',
        ja: '訪れた場所。',
        pt: 'visitados.',
        es: 'visitados.'
    };

    /* brief: pillar title for the ledger — schengen / tax / pension /
       insurance counters. The line should read like a sigh. */
    const ledgerHead   = {
        en: 'How many days',
        ko: '며칠이',
        ja: 'のこるは',
        pt: 'Quantos dias',
        es: 'Cuántos días'
    };
    const ledgerItalic = {
        en: 'remain.',
        ko: '남았는가.',
        ja: '幾日。',
        pt: 'restam.',
        es: 'quedan.'
    };

    /* brief: pillar title for dispatches — the wire-service news, rewritten.
       Three states: head + edited (six-day default) + resting (Sunday silence
       per the constitution §9.1). */
    const dispatchesHead    = {
        en: 'The wires,',
        ko: '통신,',
        ja: '通信、',
        pt: 'Os despachos,',
        es: 'Los despachos,'
    };
    const dispatchesEdited  = {
        en: 'edited.',
        ko: '편집된.',
        ja: '編集ずみ。',
        pt: 'editados.',
        es: 'editados.'
    };
    const dispatchesResting = {
        en: 'resting.',
        ko: '휴간.',
        ja: '休刊。',
        pt: 'em pausa.',
        es: 'en pausa.'
    };

    /* brief: the welcome card — first thing a new reader sees, after the
       splash. One eyebrow + one italic headline + one paragraph. Each
       language section was authored from the brief, not translated. KO
       uses 어서 오라 (archaic literary "come in") on purpose. */
    const welcomeEyebrow = {
        en: 'WELCOME.',
        ko: '어서 오라.',
        ja: 'ようこそ。',
        pt: 'BEM-VINDO.',
        es: 'BIENVENIDO.'
    };
    const welcomeHeadline = {
        en: 'A slow newspaper. Three cities, filed daily.',
        ko: '느린 신문. 매일, 세 도시.',
        ja: 'ゆるやかな新聞。毎朝、三都市。',
        pt: 'Um jornal lento. Três cidades, todas as manhãs.',
        es: 'Un periódico lento. Tres ciudades, cada mañana.'
    };
    /* The body paragraph keeps <em>saudade</em> as inline HTML — it is
       rendered with innerHTML, not textContent. */
    const welcomeBody = {
        en: '<em>saudade</em> is Portuguese for the longing you carry for places you cannot return to. We file three city items, six days a week. Sunday is silence — by design. Read on, or sign in to track the days you have left.',
        ko: '<em>saudade</em> — 돌아갈 수 없는 곳을 향한 그리움. 포르투갈어. 엿새 동안 도시마다 세 기사, 일요일은 침묵 — 의도된 것이다. 그냥 읽어도 좋고, 로그인하면 남은 일수를 헤아려준다.',
        ja: '<em>saudade</em> は戻れない場所への切なさを意味するポルトガル語。週六日、都市ごとに三本。日曜は沈黙 — 意図されたもの。そのまま読むも良し、サインインすれば残り日数を数える。',
        pt: '<em>saudade</em> em português é a ausência de algo a que não se pode regressar. Três notas por cidade, seis dias por semana. Domingo é silêncio — propositado. Continue a ler, ou entre para contar os dias.',
        es: '<em>saudade</em> en portugués es la añoranza por los lugares a los que no se puede volver. Tres notas por ciudad, seis días por semana. El domingo es silencio — intencionado. Siga leyendo, o entre para contar los días.'
    };

    /* brief: the supplement (quarterly) — gathers three pieces per city
       across the quarter. Sub-tagline under "The wires, edited." */
    const quarterlySubtitle = {
        en: 'Three from each city.',
        ko: '도시마다 셋.',
        ja: '都市ごとに三つ。',
        pt: 'Três por cidade.',
        es: 'Tres por ciudad.'
    };

    const KEYS = {
        mastTagline,
        listeningHead, listeningItalic,
        atlasHead, atlasItalic,
        ledgerHead, ledgerItalic,
        dispatchesHead, dispatchesEdited, dispatchesResting,
        welcomeEyebrow, welcomeHeadline, welcomeBody,
        quarterlySubtitle
    };

    const VOICE = { en: {}, ko: {}, ja: {}, pt: {}, es: {} };
    Object.keys(KEYS).forEach(k => {
        Object.keys(VOICE).forEach(lang => {
            VOICE[lang][k] = KEYS[k][lang];
        });
    });

    function get(key, ed) {
        const lang = (VOICE[ed] && VOICE[ed][key] != null) ? ed : 'en';
        return VOICE[lang][key];
    }

    window.SAUDADE_VOICE = { get, langs: Object.keys(VOICE) };
})();
