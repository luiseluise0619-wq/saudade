// SAUDADE · § 04 THE DESK (Handoff v2 §5.4)
// 발행 파이프라인 + 사용자 설정 (편집부 페이지).
// 카드 X. 모든 요소 mono UPPERCASE 라벨 + Fraunces 본문.
// 모달 X — 페이지 진입.
'use strict';

(function() {
    if (window.SAUDADE_DESK) return;

    // v3 pipeline — 100% free AI stack (Workers AI + Gemini 2.0 Flash).
    // 운영비 0원. provider 는 LLM_*_PROVIDER env var 로 swap 가능.
    const PIPELINE = [
        { time: '00:00 KST', step: 'GATHER',    desc: 'rss-parser collects RSS from city halls, museums, local press.' },
        { time: '00:30 KST', step: 'SORT',      desc: 'Workers AI · Llama 3.1 8B — city classification, noise removed.' },
        { time: '02:00 KST', step: 'SCORE',     desc: 'Workers AI · Llama 3.1 8B — quietness scored one to ten.' },
        { time: '04:00 KST', step: 'WRITE',     desc: 'Gemini 2.0 Flash — three to four sentence dispatches rewritten.' },
        { time: '05:00 KST', step: 'TRANSLATE', desc: 'Gemini 2.0 Flash — base edition into four separate impressions.' },
        { time: '05:30 KST', step: 'STAGE',     desc: 'D1 staged for editorial review.' },
        { time: '06:00 KST', step: 'FILE',      desc: 'Top nine publish. Human editor reviews afterwards.' }
    ];

    function injectStyles() {
        if (document.getElementById('sddDeskStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddDeskStyles';
        s.textContent = `
.sdd-desk {
    position: fixed; inset: 0;
    z-index: var(--z-section-page, 8);
    background: var(--paper);
    color: var(--ink);
    overflow-y: auto;
    padding: 88px clamp(24px, 6vw, 80px) calc(var(--dock-h, 56px) + 88px);
    display: none;
}
body.section-active[data-section="04"] .sdd-desk { display: block; }

.sdd-desk-head {
    margin: 0 0 clamp(24px, 4vw, 48px);
    padding-bottom: clamp(12px, 2vw, 20px);
    border-bottom: 0.5px solid var(--rule);
}
.sdd-desk-h2 {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    /* v7 §2.2 — 헤드라인 전체 italic */
    font-size: clamp(36px, 5vw, 54px);
    line-height: 0.95;
    letter-spacing: var(--tr-fraunces-h2-d);
    color: var(--ink);
    margin: 0;
}
.sdd-desk-h2 .it { font-style: italic; display: block; }

.sdd-desk-section {
    padding: clamp(20px, 3vw, 32px) 0;
    border-top: 0.5px solid var(--rule);
}
.sdd-desk-section:last-child { border-bottom: 0.5px solid var(--rule); }

.sdd-desk-label {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 0 0 clamp(12px, 2vw, 20px);
}

.sdd-desk-pipeline {
    display: flex; flex-direction: column; gap: 0;
}
.sdd-desk-step {
    display: grid;
    grid-template-columns: 100px 100px 1fr;
    gap: clamp(12px, 2vw, 24px);
    padding: 12px 0;
    border-top: 0.5px solid var(--rule);
    align-items: baseline;
}
.sdd-desk-step:first-child { border-top: 0; }
.sdd-desk-step .time {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-data);
    color: var(--bone-d);
    white-space: nowrap;
}
.sdd-desk-step .name {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--ink);
}
.sdd-desk-step .desc {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(13.5px, 1.2vw, 15px);
    line-height: 1.55;
    color: var(--ink);
}

.sdd-desk-edition-list {
    display: flex; flex-wrap: wrap; gap: 12px;
}
.sdd-desk-edition-opt {
    background: transparent;
    border: 0.5px solid var(--rule);
    color: var(--ink);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    padding: 12px 18px;
    min-height: 44px;
    cursor: pointer;
    border-radius: 4px;
    transition: border-color .12s, color .12s;
}
.sdd-desk-edition-opt:hover {
    border-color: var(--ink);
    color: var(--accent, var(--rust));
}
.sdd-desk-edition-opt[aria-current="true"] {
    border-color: var(--accent, var(--rust));
    color: var(--accent, var(--rust));
}

/* v6 §5.4 — Switch the Desk active state */
.sdd-desk-switch-active {
    padding: clamp(16px, 2vw, 24px);
    border: 0.5px solid var(--accent, var(--rust));
    margin: 0 0 16px;
}
.sdd-desk-switch-msg {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(15px, 1.4vw, 18px);
    line-height: 1.4;
    color: var(--accent, var(--rust));
    margin: 0 0 14px;
}
.sdd-desk-switch-actions {
    display: flex; flex-wrap: wrap; gap: 10px;
}

.sdd-desk-disclaimer {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.7;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    max-width: 60ch;
}
.sdd-desk-disclaimer strong {
    font-weight: 500;
    color: var(--ink);
    letter-spacing: var(--tr-mono-mast);
    display: block;
    margin-bottom: 6px;
}

.sdd-desk-foot {
    margin-top: clamp(40px, 6vw, 80px);
    padding-top: clamp(16px, 2vw, 24px);
    border-top: 0.5px solid var(--rule);
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    text-align: center;
}

@media (max-width: 768px) {
    .sdd-desk { padding: 56px 16px calc(var(--dock-h, 56px) + 80px); }
    .sdd-desk-step {
        grid-template-columns: 1fr;
        gap: 4px;
        padding: 14px 0;
    }
}
`;
        document.head.appendChild(s);
    }

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[ch]);
    }

    // v6 §5.4 — Switch the Desk + Home City UI
    function renderHomeDeskSection() {
        if (!window.SAUDADE_CITY) return '';
        const T = window.SAUDADE_T || ((s) => s.en);
        const home = window.SAUDADE_CITY.getHomeCity();
        const sw = window.SAUDADE_CITY.getSwitch();
        const ed = window.SAUDADE_EDITION?.get?.() || 'en';
        const homeName = window.SAUDADE_CITY.cityName(home, ed);
        const adjacent = window.SAUDADE_CITY.adjacentCities();

        const labels = {
            label:    T({ en: 'Home Desk', ko: '정착 책상', ja: '本拠デスク', pt: 'Mesa Permanente', es: 'Mesa Permanente' }),
            sub:      T({ en: 'Where you sleep this month', ko: '이번 달 머무는 곳', ja: '今月の住まい', pt: 'Onde dorme este mês', es: 'Dónde duermes este mes' }),
            switchTo: T({ en: 'Switch the desk to', ko: '책상을 옮기기', ja: 'デスクを移す', pt: 'Mudar a mesa para', es: 'Mover la mesa a' }),
            returnIn: T({ en: 'Returning to $home in $days days', ko: '$days일 후 $home 으로 복귀', ja: '$days日後に $home に戻ります', pt: 'Regresso a $home em $days dias', es: 'Regreso a $home en $days días' }),
            returnNow:T({ en: 'Return now', ko: '지금 복귀', ja: '今すぐ戻る', pt: 'Voltar agora', es: 'Volver ahora' }),
            keepHere: T({ en: 'Keep me on $to permanently', ko: '$to 를 정착 도시로', ja: '$to を本拠に', pt: 'Manter $to permanente', es: 'Mantener $to permanente' }),
            requestNew: T({ en: 'Request a new desk', ko: '새 책상 요청', ja: '新しいデスクを要請', pt: 'Pedir uma nova mesa', es: 'Solicitar una nueva mesa' }),
            requestPh:  T({ en: 'CITY NAME', ko: '도시 이름', ja: '都市名', pt: 'NOME DA CIDADE', es: 'NOMBRE DE LA CIUDAD' }),
            requestSent:T({ en: 'Submitted, queued for next issue.', ko: '제출됐다. 다음 호에 검토한다.', ja: '提出された。次号で検討する。', pt: 'Submetido, em fila para a próxima edição.', es: 'Enviado, en cola para la próxima edición.' })
        };

        // Switch active 시
        let switchHtml = '';
        if (sw && sw.to) {
            const daysLeft = Math.max(0, Math.ceil((new Date(sw.returns_at).getTime() - Date.now()) / 86400000));
            const fromName = window.SAUDADE_CITY.cityName(sw.from, ed);
            const toName = window.SAUDADE_CITY.cityName(sw.to, ed);
            switchHtml = `
                <div class="sdd-desk-switch-active">
                    <p class="sdd-desk-switch-msg">
                        ${escapeHtml(labels.returnIn.replace('$home', fromName).replace('$days', String(daysLeft)))}
                    </p>
                    <div class="sdd-desk-switch-actions">
                        <button class="sdd-desk-edition-opt" data-switch-end>
                            ${escapeHtml(labels.returnNow)}
                        </button>
                        <button class="sdd-desk-edition-opt" data-switch-permanent>
                            ${escapeHtml(labels.keepHere.replace('$to', toName))}
                        </button>
                    </div>
                </div>
            `;
        }

        // 주변 도시 → switch buttons
        const adjacentBtnsHtml = !sw && adjacent.length ? adjacent.map(c => {
            const name = window.SAUDADE_CITY.cityName(c, ed);
            return `<button class="sdd-desk-edition-opt" data-switch-to="${escapeHtml(c)}">
                        ${escapeHtml(labels.switchTo)} ${escapeHtml(name)}
                    </button>`;
        }).join('') : '';

        return `
            <section class="sdd-desk-section">
                <p class="sdd-desk-label">${escapeHtml(labels.label)}<span class="sdd-co-sub" style="display:block;font-weight:400;color:var(--bone-d);margin-top:4px">${escapeHtml(labels.sub)}</span></p>
                <p style="font-family:var(--serif);font-weight:300;font-style:italic;font-size:clamp(20px,2.4vw,28px);line-height:1.2;color:var(--ink);margin:0 0 16px">
                    ${escapeHtml(homeName)}
                </p>
                ${switchHtml}
                ${adjacentBtnsHtml ? `<div class="sdd-desk-edition-list" style="margin-top:12px">${adjacentBtnsHtml}</div>` : ''}
                <form class="sdd-desk-request-form" data-request-form style="margin-top:24px;display:flex;gap:8px;flex-wrap:wrap">
                    <input type="text" name="city" placeholder="${escapeHtml(labels.requestPh)}"
                           style="background:transparent;border:0;border-bottom:0.5px solid var(--rule);font-family:var(--mono);font-size:11px;letter-spacing:var(--tr-mono-meta);text-transform:uppercase;padding:10px 0;min-height:44px;flex:1;min-width:200px;color:var(--ink);outline:none" />
                    <button type="submit" class="sdd-desk-edition-opt">${escapeHtml(labels.requestNew)}</button>
                </form>
                <p class="sdd-desk-request-status" data-request-status style="font-family:var(--mono);font-size:10px;letter-spacing:var(--tr-mono-meta);text-transform:uppercase;color:var(--bone-d);margin:8px 0 0;min-height:14px"></p>
            </section>
        `;
    }

    function render() {
        let root = document.getElementById('sddDesk');
        if (!root) {
            root = document.createElement('section');
            root.id = 'sddDesk';
            root.className = 'sdd-desk';
            document.body.appendChild(root);
        }

        const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
        const editionsHtml = (window.SAUDADE_EDITION?.SUPPORTED || ['en','ko','ja','pt','es']).map(code => {
            const meta = window.SAUDADE_EDITION?.META?.[code] || { name: code };
            return `<button class="sdd-desk-edition-opt"
                            data-edition="${code}"
                            aria-current="${code === ed ? 'true' : 'false'}">
                        ${code.toUpperCase()} · ${escapeHtml(meta.name)}
                    </button>`;
        }).join('');

        const pipelineHtml = PIPELINE.map(s => `
            <div class="sdd-desk-step">
                <span class="time">${escapeHtml(s.time)}</span>
                <span class="name">${escapeHtml(s.step)}</span>
                <span class="desc">${escapeHtml(s.desc)}</span>
            </div>
        `).join('');

        const T = window.SAUDADE_T || ((s) => s.en);
        const headLabel = T({
            en: 'From the', ko: '편집부', ja: '編集部',
            pt: 'Da', es: 'Desde la'
        });
        const headItalic = T({
            en: 'desk.', ko: '에서.', ja: 'より。',
            pt: 'mesa.', es: 'mesa.'
        });

        root.innerHTML = `
            <header class="sdd-desk-head">
                <h2 class="sdd-desk-h2">
                    ${escapeHtml(headLabel)}
                    <span class="it">${escapeHtml(headItalic)}</span>
                </h2>
            </header>

            <section class="sdd-desk-section">
                <p class="sdd-desk-label">Daily filing pipeline</p>
                <div class="sdd-desk-pipeline">${pipelineHtml}</div>
            </section>

            <section class="sdd-desk-section">
                <p class="sdd-desk-label">Editions</p>
                <p style="font-family:var(--serif);font-weight:300;font-size:14.5px;line-height:1.55;color:var(--ink);max-width:60ch;margin:0 0 16px">
                    Each edition is its own impression. The user opens a different magazine, not a translation.
                </p>
                <div class="sdd-desk-edition-list">${editionsHtml}</div>
            </section>

            ${renderHomeDeskSection()}

            <section class="sdd-desk-section">
                <p class="sdd-desk-disclaimer">
                    <strong>A note on sources.</strong>
                    Each dispatch is rewritten in our own words from the source listed.
                    We quote no more than twenty-five words. We link to the original.
                    We do not republish AP, Reuters, or Bloomberg copy. We never use
                    photographs we did not take ourselves. Dispatches are AI-assisted
                    and reviewed by a human editor.
                </p>
            </section>

            <section class="sdd-desk-section">
                <p class="sdd-desk-disclaimer">
                    <strong>A note on visas.</strong>
                    Visa policy changes without warning. Verify with the embassy of
                    the country you are visiting. We do not guarantee accuracy.
                </p>
            </section>

            <section class="sdd-desk-section">
                <p class="sdd-desk-disclaimer">
                    <strong>A note on places.</strong>
                    We list only what we have visited. We accept no payment for
                    inclusion. We never use a photograph that is not our own. If
                    you are an owner and would like to be removed, write to
                    desk@saudade.app.
                </p>
            </section>

            <footer class="sdd-desk-foot">
                Saudade · Issue 03 · Spring 2026 · Daily filing · Operating cost zero
            </footer>
        `;

        root.querySelectorAll('[data-edition]').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.getAttribute('data-edition');
                if (window.SAUDADE_EDITION?.set) window.SAUDADE_EDITION.set(code);
            });
        });

        // v6 §5.4 — Switch the Desk handlers
        root.querySelectorAll('[data-switch-to]').forEach(btn => {
            btn.addEventListener('click', () => {
                const to = btn.getAttribute('data-switch-to');
                if (window.SAUDADE_CITY?.startSwitch) window.SAUDADE_CITY.startSwitch(to);
            });
        });
        root.querySelector('[data-switch-end]')?.addEventListener('click', () => {
            window.SAUDADE_CITY?.endSwitch?.();
        });
        root.querySelector('[data-switch-permanent]')?.addEventListener('click', () => {
            window.SAUDADE_CITY?.makePermanent?.();
        });

        // v6 §5.5 — 정의 안 된 도시 요청 폼
        const reqForm = root.querySelector('[data-request-form]');
        if (reqForm) {
            reqForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const fd = new FormData(reqForm);
                const cityName = String(fd.get('city') || '').trim();
                if (!cityName) return;
                const T = window.SAUDADE_T || ((s) => s.en);
                if (window.SAUDADE_CITY?.isDefined?.(cityName)) {
                    // 이미 정의된 도시 → 바로 setHomeCity
                    window.SAUDADE_CITY.setHomeCity(cityName);
                    render();
                    return;
                }
                // 미정의 → worker D1 INSERT (v7 §5.5) + local fallback
                let count = window.SAUDADE_CITY?.recordRequest?.(cityName) || 0;
                const status = root.querySelector('[data-request-status]');
                // POST /city/request — fire-and-forget, count 갱신
                const _base = (window.AURA_SERVER || '').replace(/\/$/, '');
                if (_base) {
                    fetch(_base + '/city/request', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            requested_city: cityName,
                            edition: (window.SAUDADE_EDITION?.get?.() || 'en'),
                            user_email: (window.SAUDADE_AUTH?.getUser?.() || {}).email || null
                        }),
                        credentials: 'omit'
                    }).then(r => r.json()).then(j => {
                        if (j && typeof j.count === 'number' && status) {
                            count = j.count;
                            status.textContent = status.textContent.replace(/\d+\s*\/\s*100/, count + ' / 100');
                        }
                    }).catch(() => {});
                }
                if (status) {
                    const msg = T({
                        en: `“${cityName}” isn't on our desk yet. We've noted your request. When 100 readers ask for a city, we open the desk. Currently: ${count} of 100.`,
                        ko: `"${cityName}" 은 아직 책상 위에 없다. 요청을 기록했다. 100명이 모이면 다음 분기에 책상을 연다. 현재 ${count} / 100.`,
                        ja: `「${cityName}」はまだ机にない。要請を記録した。百名集まれば次号で机を開く。現在 ${count} / 100。`,
                        pt: `“${cityName}” ainda não está na nossa mesa. Registámos o seu pedido. Quando 100 leitores pedirem uma cidade, abrimos a mesa. Atualmente: ${count} de 100.`,
                        es: `“${cityName}” aún no está en nuestra mesa. Hemos anotado su solicitud. Cuando 100 lectores pidan una ciudad, abrimos la mesa. Actualmente: ${count} de 100.`
                    });
                    status.textContent = msg;
                }
                reqForm.querySelector('input').value = '';
            });
        }
    }

    // topbar #settingsBtn 클릭 capturing 가로채 → § 04 DESK 진입 (잡지 콜로폰).
    // (이전 saudade-colophon.js 의 hook 이 여기로 통합됨)
    function watchSettings() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#settingsBtn, [data-saudade-desk]');
            if (!btn) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            // section-04 진입 (saudade-masthead 의 setSection 흐름)
            if (window.SAUDADE_MASTHEAD?.setSection) {
                window.SAUDADE_MASTHEAD.setSection('trip');
            } else {
                document.body.classList.add('section-active');
                document.body.setAttribute('data-section', '04');
            }
        }, true);
    }

    function init() {
        injectStyles();
        render();
        watchSettings();
        const mo = new MutationObserver(() => {
            if (document.body.getAttribute('data-section') === '04') render();
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-section', 'data-edition'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_DESK = { render };
})();
