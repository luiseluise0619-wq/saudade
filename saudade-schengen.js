// saudade · Schengen 90/180 rolling calculator
//
// The Schengen short-stay rule: in any rolling 180-day window, you may not
// spend more than 90 days inside Schengen. Days are counted **including**
// the day of entry and the day of exit (Reg. (EU) 610/2013, Art.6(1)).
//
// This module does pure math. No advice. The output is a calendar.
//
// API:
//   window.SAUDADE_SCHENGEN.calc({ stays, ref })
//     stays = [{ in: 'YYYY-MM-DD', out?: 'YYYY-MM-DD' (open if missing), country?: 'PT' }]
//     ref   = 'YYYY-MM-DD' (defaults to today UTC)
//   →  {
//        ref, used_in_window, remaining, max,
//        window_start, window_end, currently_inside,
//        days_until_full_reset,   // when used_in_window will reach 0 again
//        next_safe_entry_after,   // earliest ref date you could enter and still have ≥1 day
//        timeline: [ { date, used } ... 181 entries ]
//      }
//
//   window.SAUDADE_SCHENGEN.render(container, { stays, ref, lang })
//     Paints a compact panel into `container`.
'use strict';

(function() {
    if (window.SAUDADE_SCHENGEN) return;

    const MAX = 90;
    const WINDOW = 180;
    const MS_DAY = 86400000;

    function L(strings, lang) {
        const ed = lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    function toUTCDate(s) {
        if (!s) return null;
        if (s instanceof Date) return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
        if (!m) return null;
        const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
        return isNaN(d.getTime()) ? null : d;
    }
    function fmt(d) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    function addDays(d, n) { return new Date(d.getTime() + n * MS_DAY); }
    function diffDays(a, b) { return Math.round((a.getTime() - b.getTime()) / MS_DAY); }

    // Build a per-day Set of dates the traveller was inside Schengen.
    // Open stays (no `out`) end at `ref` if `in <= ref`.
    function expandStays(stays, ref) {
        const set = new Set();
        for (const s of (stays || [])) {
            const a = toUTCDate(s.in);
            if (!a) continue;
            const b = toUTCDate(s.out) || ref;
            if (b < a) continue;
            // Include both endpoints.
            for (let d = new Date(a); d <= b; d = addDays(d, 1)) {
                set.add(fmt(d));
            }
        }
        return set;
    }

    function calc(opts) {
        opts = opts || {};
        const ref = toUTCDate(opts.ref) || (function () {
            const now = new Date();
            return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        })();
        const stays = Array.isArray(opts.stays) ? opts.stays : [];
        const set = expandStays(stays, ref);

        // Window is the 180 days ending on ref (inclusive). EU practice: ref counts.
        const start = addDays(ref, -(WINDOW - 1));
        let used = 0;
        const timeline = [];
        for (let i = 0; i < WINDOW; i++) {
            const d = addDays(start, i);
            const inside = set.has(fmt(d));
            if (inside) used++;
            timeline.push({ date: fmt(d), inside });
        }
        const remaining = Math.max(0, MAX - used);
        const todayInside = set.has(fmt(ref));

        // Roll forward to find when used drops to 0 (full reset) and the next safe-entry date.
        // Optimisation cap: don't roll more than 365 days.
        let nextSafeEntry = null;
        let fullReset = null;
        let cur = used;
        const insideByDay = new Map();
        for (let i = 0; i < WINDOW; i++) {
            insideByDay.set(fmt(addDays(start, i)), set.has(fmt(addDays(start, i))) ? 1 : 0);
        }
        for (let off = 1; off <= 365; off++) {
            const dropDate = addDays(start, off - 1);
            const addDate  = addDays(ref,   off);
            const dropping = insideByDay.get(fmt(dropDate)) || 0;
            const adding = set.has(fmt(addDate)) ? 1 : 0;   // future stays user may have entered
            cur = cur - dropping + adding;
            insideByDay.set(fmt(addDate), adding);
            if (cur < MAX && nextSafeEntry === null) {
                nextSafeEntry = fmt(addDate);
            }
            if (cur === 0 && fullReset === null) {
                fullReset = fmt(addDate);
                break;
            }
        }

        return {
            ref: fmt(ref),
            window_start: fmt(start),
            window_end: fmt(ref),
            max: MAX,
            window_days: WINDOW,
            used_in_window: used,
            remaining,
            currently_inside: todayInside,
            days_until_full_reset: fullReset ? diffDays(toUTCDate(fullReset), ref) : null,
            next_safe_entry_after: nextSafeEntry,
            timeline
        };
    }

    function copy(lang) {
        return {
            title:   L({ en: 'Schengen 90/180.', ko: '솅겐 90/180.', ja: 'シェンゲン 90/180。', pt: 'Schengen 90/180.', es: 'Schengen 90/180.' }, lang),
            usedLab: L({ en: 'DAYS USED',    ko: '사용 일수',  ja: '使用日数',    pt: 'DIAS USADOS',  es: 'DÍAS USADOS' }, lang),
            remLab:  L({ en: 'DAYS REMAINING', ko: '남은 일수', ja: '残り日数',   pt: 'DIAS RESTANTES', es: 'DÍAS RESTANTES' }, lang),
            window:  L({ en: 'IN THE 180 DAYS ENDING', ko: '기준일 직전 180일', ja: '基準日までの180日間', pt: 'NOS 180 DIAS ATÉ', es: 'EN LOS 180 DÍAS HASTA' }, lang),
            insideY: L({ en: 'You are inside Schengen on the reference date.', ko: '기준일 현재 솅겐 안에 있다.', ja: '基準日現在シェンゲン圏内にいる。', pt: 'Está dentro de Schengen na data de referência.', es: 'Está dentro de Schengen en la fecha de referencia.' }, lang),
            insideN: L({ en: 'You are outside Schengen on the reference date.', ko: '기준일 현재 솅겐 밖에 있다.', ja: '基準日現在シェンゲン圏外にいる。', pt: 'Está fora de Schengen na data de referência.', es: 'Está fuera de Schengen en la fecha de referencia.' }, lang),
            full:    L({ en: 'WINDOW FULLY RESETS', ko: '윈도우 완전 초기화', ja: 'ウィンドウ完全リセット', pt: 'JANELA REINICIA POR COMPLETO', es: 'VENTANA SE REINICIA POR COMPLETO' }, lang),
            safe:    L({ en: 'NEXT SAFE ENTRY ≥ 1 DAY', ko: '다음 입국 가능 (≥1일)', ja: '次に入国可能 (≥1日)', pt: 'PRÓXIMA ENTRADA SEGURA (≥1 DIA)', es: 'PRÓXIMA ENTRADA SEGURA (≥1 DÍA)' }, lang),
            note:    L({ en: 'A calendar, not advice. Verify with your consulate.', ko: '계산기가 아니라 달력. 영사관에 확인하라.', ja: 'これは計算機ではなく暦。領事館に確認を。', pt: 'Um calendário, não um conselho. Confirme com o seu consulado.', es: 'Un calendario, no un consejo. Confirme con su consulado.' }, lang),
            empty:   L({ en: 'Add at least one Schengen entry above.', ko: '솅겐 입국 기록을 하나 이상 추가하라.', ja: '少なくとも一回のシェンゲン入国を追加してください。', pt: 'Adicione pelo menos uma entrada Schengen acima.', es: 'Añada al menos una entrada Schengen arriba.' }, lang)
        };
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    function render(root, opts) {
        if (!root) return;
        const stays = (opts && opts.stays) || [];
        const lang  = opts && opts.lang;
        if (!stays.length) {
            root.innerHTML = `<p class="sdd-sch-empty">${escapeHtml(copy(lang).empty)}</p>`;
            return;
        }
        const r = calc({ stays, ref: opts && opts.ref });
        const c = copy(lang);
        const danger = r.used_in_window >= MAX;
        const warn   = r.used_in_window >= 75 && !danger;
        const cls = danger ? 'danger' : warn ? 'warn' : 'ok';

        root.innerHTML = `
            <section class="sdd-sch-panel ${escapeHtml(cls)}">
                <h3 class="sdd-sch-h">${escapeHtml(c.title)}</h3>
                <div class="sdd-sch-grid">
                    <div class="sdd-sch-cell">
                        <p class="sdd-sch-label">${escapeHtml(c.usedLab)}</p>
                        <p class="sdd-sch-num">${Math.min(r.used_in_window, r.max)}<span class="sdd-sch-of"> / ${r.max}</span>${r.used_in_window > r.max ? `<span class="sdd-sch-over"> · +${r.used_in_window - r.max} OVER</span>` : ''}</p>
                    </div>
                    <div class="sdd-sch-cell">
                        <p class="sdd-sch-label">${escapeHtml(c.remLab)}</p>
                        <p class="sdd-sch-num">${r.remaining}</p>
                    </div>
                </div>
                <p class="sdd-sch-window">${escapeHtml(c.window)} ${escapeHtml(r.window_end)}</p>
                <p class="sdd-sch-status">${escapeHtml(r.currently_inside ? c.insideY : c.insideN)}</p>
                <dl class="sdd-sch-meta">
                    ${r.next_safe_entry_after ? `<dt>${escapeHtml(c.safe)}</dt><dd>${escapeHtml(r.next_safe_entry_after)}</dd>` : ''}
                    ${r.days_until_full_reset !== null ? `<dt>${escapeHtml(c.full)}</dt><dd>${escapeHtml(String(r.days_until_full_reset))} d</dd>` : ''}
                </dl>
                <p class="sdd-sch-note">${escapeHtml(c.note)}</p>
            </section>
        `;
    }

    function injectStyles() {
        if (document.getElementById('sddSchStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddSchStyles';
        s.textContent = `
.sdd-sch-panel {
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
    padding: clamp(20px, 3vw, 32px) 0;
    margin: clamp(16px, 3vw, 28px) 0;
}
.sdd-sch-panel.warn  { background: linear-gradient(transparent 60%, rgba(178,103,46,.06)); }
.sdd-sch-panel.danger { background: linear-gradient(transparent 60%, rgba(178,53,40,.10)); }
.sdd-sch-h {
    font-family: var(--mono); font-weight: 500; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--rust); margin: 0 0 16px;
}
.sdd-sch-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: clamp(16px, 4vw, 48px);
    align-items: end;
}
.sdd-sch-label {
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); margin: 0 0 6px;
}
.sdd-sch-num {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: clamp(56px, 9vw, 110px); line-height: 1;
    color: var(--ink); margin: 0;
}
.sdd-sch-panel.danger .sdd-sch-num { color: var(--rust); }
.sdd-sch-of {
    font-size: 0.35em; color: var(--bone-d);
    font-style: normal; letter-spacing: 0.06em;
}
.sdd-sch-over {
    font-size: 0.30em; color: var(--rust);
    font-style: normal; letter-spacing: 0.32em;
    font-family: var(--mono); font-weight: 500;
    text-transform: uppercase;
    margin-left: 8px;
}
.sdd-sch-window, .sdd-sch-status {
    font-family: var(--mono); font-weight: 400; font-size: 11px;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--bone-d); margin: 14px 0 0;
}
.sdd-sch-meta {
    display: grid; grid-template-columns: auto 1fr; column-gap: 16px;
    font-family: var(--mono); font-size: 11px;
    margin: 14px 0 0; padding-top: 12px;
    border-top: 0.5px solid var(--rule);
}
.sdd-sch-meta dt { color: var(--bone-d); letter-spacing: 0.18em; text-transform: uppercase; }
.sdd-sch-meta dd { color: var(--ink); margin: 0 0 4px; }
.sdd-sch-note {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 13px; color: var(--bone-d); margin: 14px 0 0;
}
.sdd-sch-empty {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 14px; color: var(--bone-d); margin: 16px 0;
}
        `;
        document.head.appendChild(s);
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectStyles);
        } else { injectStyles(); }
    }

    window.SAUDADE_SCHENGEN = { calc, render };
})();
