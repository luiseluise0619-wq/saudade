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

    const VOICE = {
        en: { mastTagline: mastTagline.en },
        ko: { mastTagline: mastTagline.ko },
        ja: { mastTagline: mastTagline.ja },
        pt: { mastTagline: mastTagline.pt },
        es: { mastTagline: mastTagline.es }
    };

    function get(key, ed) {
        const lang = (VOICE[ed] && VOICE[ed][key] != null) ? ed : 'en';
        return VOICE[lang][key];
    }

    window.SAUDADE_VOICE = { get, langs: Object.keys(VOICE) };
})();
