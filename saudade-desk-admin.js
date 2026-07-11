// SAUDADE · v7 §10 — /desk 편집장 라우트 (admin UI)
//
// 일일 검수 (15분/일) 워크플로우:
//   - 오늘 발행된 dispatches 큐 표시
//   - per dispatch: REVIEW / EDIT HEADLINE / RETRACT
//   - 액션 → POST /editor/log (§9.10 Editor-on-Leave 활동 감지 입력)
//
// 진입:
//   - URL hash #desk
//   - 또는 Ctrl+Shift+D
//
// 토큰:
//   - localStorage 'saudade.editor.token' (편집장이 수동 설정)
//   - 미설정 시 모든 액션 inline-only (worker 호출 X, 시각 토글만)
//
// 의존: window.AURA_SERVER (worker URL).
'use strict';

// IIFE — 로드 즉시 실행. 편집장 전용 /desk 관리 화면(일일 큐 검수) 모듈.
(function() {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_DESK_ADMIN) return;

    // KEY_TOKEN: 편집자 인증 토큰 localStorage 키. HASH: 이 화면의 URL 해시(#desk).
    const KEY_TOKEN = 'saudade.editor.token';
    const HASH = '#desk';

    // _root: 화면 컨테이너 캐시. _data: 오늘 디스패치 JSON 캐시.
    let _root = null;
    let _data = null;

    // L — 현재 에디션 언어 문자열 선택(없으면 영어).
    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    // escapeHtml — innerHTML 주입 전 위험 문자 이스케이프(XSS 방지).
    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    // getToken — 편집자 토큰을 localStorage 에서 읽는다(없으면 null → 액션은 인라인 전용).
    function getToken() {
        try { return localStorage.getItem(KEY_TOKEN) || null; } catch (e) { return null; }
    }

    function copy() {
        return {
            head1:    L({ en: 'The desk,',  ko: '편집부,',  ja: '編集部、',
                         pt: 'A redação,', es: 'La redacción,' }),
            head2:    L({ en: 'today.',     ko: '오늘.',     ja: '今日。',
                         pt: 'hoje.',      es: 'hoy.' }),
            sub:      L({
                en: 'Review the queue. Edit, retract, mark reviewed. About fifteen minutes.',
                ko: '큐 검수. 편집·철회·검토 표시. 약 15분.',
                ja: 'キュー確認。編集・撤回・確認済み。およそ15分。',
                pt: 'Reveja a fila. Edite, retire, marque revisto. Cerca de quinze minutos.',
                es: 'Revisa la cola. Edita, retira, marca revisado. Unos quince minutos.'
            }),
            tokenMissing: L({
                en: 'EDITOR TOKEN NOT SET — actions inline only',
                ko: '편집자 토큰 미설정 — 액션 인라인 전용',
                ja: '編集者トークン未設定 — アクションはインラインのみ',
                pt: 'TOKEN DE EDITOR NÃO DEFINIDO — ações apenas inline',
                es: 'TOKEN DE EDITOR NO DEFINIDO — acciones solo en línea'
            }),
            close:    L({ en: 'CLOSE', ko: '닫기', ja: '閉じる',
                         pt: 'FECHAR', es: 'CERRAR' }),
            review:   L({ en: 'REVIEW',  ko: '검토', ja: '確認',
                         pt: 'REVER',   es: 'REVISAR' }),
            edit:     L({ en: 'EDIT',    ko: '편집', ja: '編集',
                         pt: 'EDITAR',  es: 'EDITAR' }),
            retract:  L({ en: 'RETRACT', ko: '철회', ja: '撤回',
                         pt: 'RETIRAR', es: 'RETIRAR' }),
            saved:    L({ en: 'logged',  ko: '기록됨', ja: '記録',
                         pt: 'registado', es: 'registrado' }),
            empty:    L({
                en: 'No dispatches in the queue today.',
                ko: '오늘 큐에 디스패치 없음.',
                ja: '今日のキューに通信なし。',
                pt: 'Nenhum despacho na fila hoje.',
                es: 'Ningún despacho en la cola hoy.'
            })
        };
    }

    // injectStyles — 이 모듈 전용 CSS 를 <head> 에 한 번만 주입(전역 CSS 변수 사용).
    function injectStyles() {
        if (document.getElementById('sddDeskAdminStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddDeskAdminStyles';
        s.textContent = `
.sdd-deskadm {
    position: fixed; inset: 0;
    z-index: 12;
    background: var(--paper);
    color: var(--ink);
    overflow-y: auto;
    padding: 88px clamp(24px, 6vw, 80px) calc(var(--dock-h, 56px) + 88px);
    display: none;
}
.sdd-deskadm.active { display: block; }
.sdd-deskadm-mast {
    position: fixed; top: 0; left: 0; right: 0;
    padding: clamp(20px, 3vw, 40px) clamp(24px, 6vw, 80px) clamp(12px, 1.5vw, 18px);
    display: flex; justify-content: space-between; align-items: center;
    background: var(--paper);
    border-bottom: 0.5px solid var(--rule);
    z-index: 13;
    font-family: var(--mono);
    font-weight: 500; font-size: 11px;
    letter-spacing: var(--tr-mono-mast); text-transform: uppercase;
    color: var(--ink);
}
.sdd-deskadm-mast .num   { color: var(--rust); margin-right: 12px; }
.sdd-deskadm-mast .name  { color: var(--ink); }
.sdd-deskadm-mast .close {
    background: transparent; border: 0;
    color: var(--bone-d);
    font-family: var(--mono); font-weight: 400; font-size: 11px;
    letter-spacing: var(--tr-mono-meta); text-transform: uppercase;
    cursor: pointer; padding: 4px 8px;
}
.sdd-deskadm-mast .close:hover { color: var(--rust); }
.sdd-deskadm-mast .close::before { content: '← '; }

.sdd-deskadm-head {
    margin: 0 0 clamp(28px, 4vw, 56px);
    padding-bottom: clamp(12px, 2vw, 20px);
    border-bottom: 0.5px solid var(--rule);
}
.sdd-deskadm-h2 {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(36px, 5vw, 54px);
    line-height: 0.95;
    letter-spacing: var(--tr-fraunces-h2-d);
    color: var(--ink);
    margin: 0;
}
.sdd-deskadm-h2 .it { font-style: italic; display: inline; }
.sdd-deskadm-sub {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(15px, 1.4vw, 18px);
    line-height: 1.5;
    color: var(--ink-soft, var(--ink));
    margin: 12px 0 0;
}
.sdd-deskadm-warn {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--rust);
    margin: 12px 0 0;
}

.sdd-deskadm-item {
    display: grid;
    grid-template-columns: 40px 1fr 220px;
    gap: clamp(12px, 2vw, 24px);
    padding: clamp(16px, 2vw, 24px) 0;
    border-top: 0.5px solid var(--rule);
    align-items: baseline;
}
.sdd-deskadm-item:last-child { border-bottom: 0.5px solid var(--rule); }
.sdd-deskadm-num {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-data);
    color: var(--bone-d);
}
.sdd-deskadm-headline {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(17px, 1.7vw, 22px);
    line-height: 1.35;
    color: var(--ink);
    margin: 0;
}
.sdd-deskadm-meta {
    margin: 6px 0 0;
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
}
.sdd-deskadm-actions {
    display: flex; flex-direction: column; gap: 0;
    border-left: 0.5px solid var(--rule);
    padding-left: clamp(12px, 2vw, 20px);
}
.sdd-deskadm-btn {
    background: transparent;
    border: 0;
    border-bottom: 0.5px solid var(--rule);
    color: var(--ink);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    cursor: pointer;
    padding: 10px 4px;
    text-align: left;
    border-radius: 0;
    min-height: 40px;
}
.sdd-deskadm-btn:last-child { border-bottom: 0; }
.sdd-deskadm-btn:hover  { color: var(--rust); background: var(--paper-d); }
.sdd-deskadm-btn.retract { color: var(--rust); }
.sdd-deskadm-saved {
    display: inline-block;
    margin-left: 8px;
    font-family: var(--mono);
    font-weight: 400;
    font-size: 9px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--jade);
}

.sdd-deskadm-empty {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    text-align: center;
    padding: clamp(40px, 6vw, 80px) 0;
}

@media (max-width: 768px) {
    .sdd-deskadm { padding: 72px 16px calc(var(--dock-h, 56px) + 24px); }
    .sdd-deskadm-mast { padding: 14px 16px 8px; font-size: 9px; }
    .sdd-deskadm-item { grid-template-columns: 32px 1fr; gap: 8px; }
    .sdd-deskadm-actions { grid-column: 1 / -1; flex-direction: row; border-left: 0; padding-left: 0; border-top: 0.5px solid var(--rule); padding-top: 8px; }
    .sdd-deskadm-btn { flex: 1; border-bottom: 0; border-right: 0.5px solid var(--rule); text-align: center; }
    .sdd-deskadm-btn:last-child { border-right: 0; }
}
@media print { .sdd-deskadm { display: none !important; } }
        `;
        document.head.appendChild(s);
    }

    // logAction — 편집자 액션(검토/편집/철회)을 Worker 에 기록(§9.10 활동 감지 입력).
    // 토큰이나 서버 주소가 없으면 서버 호출 없이 시각 토글만(인라인 전용).
    async function logAction(action, target) {
        const token = getToken();
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        if (!token || !base) return { ok: false, reason: 'no_token_or_server' };
        try {
            // POST /editor/log — Authorization: Bearer 토큰으로 인증해 액션을 남긴다.
            const r = await fetch(base + '/editor/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ action, target, editor: 'desk-ui' }),
                credentials: 'omit'
            });
            const j = await r.json().catch(() => null);
            return { ok: r.ok && j && j.ok, body: j };
        } catch (e) {
            return { ok: false, reason: 'network' };
        }
    }

    // ensureRoot — 화면 컨테이너를 한 번만 만들어 body 에 붙이고 캐시.
    function ensureRoot() {
        if (_root) return _root;
        _root = document.createElement('section');
        _root.id = 'sddDeskAdmin';
        _root.className = 'sdd-deskadm';
        document.body.appendChild(_root);
        return _root;
    }

    // loadData — 오늘 디스패치 큐를 가져온다(no-cache: 항상 최신 검수 대상).
    function loadData() {
        return fetch('./data/dispatches.json', { cache: 'no-cache' })
            .then(r => r.ok ? r.json() : null)
            .then(d => { _data = d; return d; })
            .catch(() => { _data = null; return null; });
    }

    // flattenItems — 도시별로 중첩된 디스패치를 평면 목록으로 펼친다(id 는 "도시-항목" 인덱스).
    function flattenItems(data) {
        if (!data || !Array.isArray(data.cities)) return [];
        const out = [];
        data.cities.forEach((city, ci) => {
            (city.items || []).forEach((it, ii) => {
                out.push({
                    id: `${ci}-${ii}`,
                    city: city.city,
                    headline: it.headline || '',
                    source: it.source || '',
                    source_date: it.source_date || '',
                    n: it.n || ''
                });
            });
        });
        return out;
    }

    // render — 큐 목록과 각 항목의 검토/편집/철회 버튼을 그린다.
    function render() {
        const c = copy();
        const root = ensureRoot();
        const tokenMissing = !getToken();
        const items = flattenItems(_data);

        root.innerHTML = `
            <header class="sdd-deskadm-mast">
                <div>
                    <span class="num">§ 04</span>
                    <span class="name">${escapeHtml(L({ en: 'THE DESK', ko: '편집부', ja: '編集部', pt: 'A REDAÇÃO', es: 'LA REDACCIÓN' }))}</span>
                </div>
                <button type="button" class="close" data-close>${escapeHtml(c.close)}</button>
            </header>
            <header class="sdd-deskadm-head">
                <h2 class="sdd-deskadm-h2">
                    ${escapeHtml(c.head1)}
                    <span class="it">${escapeHtml(c.head2)}</span>
                </h2>
                <p class="sdd-deskadm-sub">${escapeHtml(c.sub)}</p>
                ${tokenMissing ? `<p class="sdd-deskadm-warn">${escapeHtml(c.tokenMissing)}</p>` : ''}
            </header>
            ${items.length === 0 ? `<p class="sdd-deskadm-empty">${escapeHtml(c.empty)}</p>` :
                items.map(it => `
                    <article class="sdd-deskadm-item" data-item-id="${escapeHtml(it.id)}">
                        <span class="sdd-deskadm-num">${escapeHtml(it.n)}</span>
                        <div>
                            <h3 class="sdd-deskadm-headline">${escapeHtml(it.headline)}</h3>
                            <p class="sdd-deskadm-meta">${escapeHtml(it.city)} · ${escapeHtml(it.source)}${it.source_date ? ' · ' + escapeHtml(it.source_date) : ''}</p>
                        </div>
                        <div class="sdd-deskadm-actions">
                            <button type="button" class="sdd-deskadm-btn"          data-action="dispatch.review"        data-target="${escapeHtml(it.id)}">${escapeHtml(c.review)}</button>
                            <button type="button" class="sdd-deskadm-btn"          data-action="dispatch.headline_edit" data-target="${escapeHtml(it.id)}">${escapeHtml(c.edit)}</button>
                            <button type="button" class="sdd-deskadm-btn retract"  data-action="dispatch.retract"       data-target="${escapeHtml(it.id)}">${escapeHtml(c.retract)}</button>
                        </div>
                    </article>
                `).join('')
            }
        `;
        // 닫기 버튼 + 각 액션 버튼에 핸들러 연결.
        root.querySelector('[data-close]').addEventListener('click', close);
        root.querySelectorAll('[data-action]').forEach(btn => {
            // 버튼 클릭 → 서버에 액션 기록 → "logged"/"— inline" 배지를 2초간 표시.
            btn.addEventListener('click', async () => {
                const action = btn.getAttribute('data-action');
                const target = btn.getAttribute('data-target');
                const result = await logAction(action, target);
                const sav = document.createElement('span');
                sav.className = 'sdd-deskadm-saved';
                sav.textContent = result.ok ? c.saved : '— inline';
                btn.parentNode.appendChild(sav);
                setTimeout(() => sav.remove(), 2000);
            });
        });
    }

    // open — 화면을 열고 URL 해시를 #desk 로 맞춘 뒤 데이터를 로드해 렌더.
    function open() {
        ensureRoot().classList.add('active');
        if (location.hash !== HASH) {
            try { history.replaceState(null, '', HASH); } catch (e) {}
        }
        loadData().then(render);
    }
    // close — 화면을 닫고 해시를 원래 경로로 되돌린다.
    function close() {
        if (_root) _root.classList.remove('active');
        try {
            if (location.hash === HASH) history.replaceState(null, '', location.pathname + location.search);
        } catch (e) {}
    }

    // watchHash — URL 해시(#desk)와 화면 표시 상태를 동기화(뒤로가기/딥링크 대응).
    function watchHash() {
        const sync = () => {
            if (location.hash === HASH) open();
            else if (_root && _root.classList.contains('active')) close();
        };
        window.addEventListener('hashchange', sync);
        sync();
    }

    // watchKeys — 단축키: Ctrl+Shift+D 로 열고/닫기, ESC 로 닫기.
    function watchKeys() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
                e.preventDefault();
                if (_root && _root.classList.contains('active')) close();
                else open();
            }
            if (e.key === 'Escape' && _root && _root.classList.contains('active')) close();
        });
    }

    // init — 모듈 시동: 스타일 주입 + 해시/단축키 감시 시작.
    function init() {
        injectStyles();
        watchHash();
        watchKeys();
    }

    // 문서 로딩 중이면 DOMContentLoaded 후, 아니면 즉시 시동.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 전역 공개 API — 열기/닫기 + 토큰 설정/조회.
    window.SAUDADE_DESK_ADMIN = {
        open, close,
        setToken: (t) => { try { t ? localStorage.setItem(KEY_TOKEN, t) : localStorage.removeItem(KEY_TOKEN); } catch (e) {} },
        getToken
    };
})();
