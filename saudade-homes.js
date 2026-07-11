// saudade · home cities setting
//
// One screen, three lines: pick up to three "home" cities. The personal-
// moments engine uses them for the saudade meter ("X days since you last
// sat in a Lisbon café") and the on-this-day rubric.
//
// Triggered via #homes URL hash or window.SAUDADE_HOMES.openModal().
'use strict';

// IIFE — 로드 즉시 실행. "홈 도시 3곳 고르기" 모달(공감 엔진의 사우다지 미터 입력) 모듈.
(function() {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_HOMES) return;

    // L — 현재 에디션 언어 문자열 선택(없으면 영어).
    function L(strings, lang) {
        const ed = lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }
    // escapeHtml — innerHTML 주입 전 위험 문자 이스케이프(XSS 방지).
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    // 모달 DOM 캐시(한 번 만들어 재사용).
    let _modal = null;

    // injectStyles — 이 모듈 전용 CSS 를 <head> 에 한 번만 주입(전역 CSS 변수 사용).
    function injectStyles() {
        if (document.getElementById('sddHomesStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddHomesStyles';
        s.textContent = `
.sdd-homes-modal {
    position: fixed; inset: 0; z-index: var(--z-modal-ugc);
    background: var(--paper); color: var(--ink);
    display: none; align-items: flex-start; justify-content: center;
    padding: clamp(40px, 8vw, 96px) clamp(24px, 6vw, 80px);
    overflow-y: auto;
}
.sdd-homes-modal.active { display: flex; }
.sdd-homes-inner { width: 100%; max-width: 520px; }
.sdd-homes-inner h2 {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: clamp(28px, 4vw, 42px); line-height: 1.05;
    letter-spacing: -0.02em; margin: 0 0 12px;
}
.sdd-homes-lede {
    font-family: var(--serif); font-weight: 300;
    font-size: clamp(14px, 1.3vw, 16px); line-height: 1.55;
    color: var(--bone-d); font-style: italic;
    margin: 0 0 24px; max-width: 44ch;
}
.sdd-homes-list {
    list-style: none; margin: 0 0 24px; padding: 0;
    border-top: 0.5px solid var(--rule);
}
.sdd-homes-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 0;
    border-bottom: 0.5px solid var(--rule);
    font-family: var(--mono); font-size: 13px;
    color: var(--ink);
    cursor: pointer;
    transition: color .12s, padding .12s;
}
.sdd-homes-row:hover { color: var(--rust); padding-left: 4px; }
.sdd-homes-row .city {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: 18px;
}
.sdd-homes-row .code {
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; color: var(--bone-d);
}
.sdd-homes-row.is-selected .code { color: var(--rust); }
.sdd-homes-row.is-selected .city { color: var(--rust); }
.sdd-homes-row .pos {
    font-family: var(--mono); font-weight: 500; font-size: 18px;
    color: var(--rust); font-style: italic;
    font-family: var(--serif);
    margin-right: 12px;
}
.sdd-homes-actions {
    display: flex; flex-direction: column;
    border-top: 0.5px solid var(--rule);
    margin-top: 12px;
}
.sdd-homes-btn {
    background: transparent; border: 0;
    border-bottom: 0.5px solid var(--rule);
    font-family: var(--mono); font-weight: 500; font-size: 12px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--ink); padding: 16px 4px; cursor: pointer;
    text-align: left; min-height: 44px;
    transition: color .15s;
}
.sdd-homes-btn:hover { color: var(--rust); }
.sdd-homes-btn.is-quiet { color: var(--bone-d); }
.sdd-homes-close {
    position: absolute; top: clamp(20px, 4vw, 32px); right: clamp(20px, 4vw, 32px);
    background: transparent; border: 0; cursor: pointer;
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase; color: var(--bone-d);
}
.sdd-homes-close:hover { color: var(--rust); }
        `;
        document.head.appendChild(s);
    }

    // paint — 도시 목록을 그리고 선택/저장/초기화 핸들러를 건다.
    // 선택된 도시는 앞으로 정렬 + 순번(1~3) 표시. 저장(Save) 전까지는 실제 저장 안 함.
    function paint() {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        // 도시 사전과 현재 저장된 홈 도시는 공감 모듈(PERSONAL)에서 가져온다.
        const cities = (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.CITIES) || {};
        const current = (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.getHomes && window.SAUDADE_PERSONAL.getHomes()) || [];
        const c = {
            title: L({ en: 'Where are you from?', ko: '어디에서 왔나?', ja: 'どこから来ましたか？', pt: 'De onde é?', es: '¿De dónde es?' }, ed),
            lede:  L({
                en: 'Pick up to three cities you carry with you. We’ll count the days since you last sat in each.',
                ko: '품고 다니는 도시를 세 곳까지 고르라. 마지막으로 그곳에 앉은 날부터 헤아린다.',
                ja: '心に抱える街を最大三つ。最後にそこに座った日から数える。',
                pt: 'Escolha até três cidades que carrega consigo. Contamos os dias desde a última vez em cada uma.',
                es: 'Elija hasta tres ciudades que lleva consigo. Contamos los días desde la última vez en cada una.'
            }, ed),
            close: L({ en: 'CLOSE', ko: '닫기', ja: '閉じる', pt: 'FECHAR', es: 'CERRAR' }, ed),
            save:  L({ en: 'SAVE', ko: '저장', ja: '保存', pt: 'GUARDAR', es: 'GUARDAR' }, ed),
            clear: L({ en: 'CLEAR ALL', ko: '모두 지우기', ja: 'すべて消す', pt: 'LIMPAR TUDO', es: 'BORRAR TODO' }, ed),
            none:  L({ en: 'No cities selected yet.', ko: '아직 선택된 도시가 없다.', ja: 'まだ選んでいない。', pt: 'Sem cidades.', es: 'Sin ciudades.' }, ed)
        };
        const sel = current.slice();
        const codes = Object.keys(cities).sort((a, b) => {
            const ai = sel.indexOf(a), bi = sel.indexOf(b);
            if (ai !== -1 && bi === -1) return -1;
            if (bi !== -1 && ai === -1) return 1;
            if (ai !== -1 && bi !== -1) return ai - bi;
            return cities[a].en.localeCompare(cities[b].en);
        });
        _modal.innerHTML = `
            <button type="button" class="sdd-homes-close" data-close>${escapeHtml(c.close)}</button>
            <div class="sdd-homes-inner">
                <h2>${escapeHtml(c.title)}</h2>
                <p class="sdd-homes-lede">${escapeHtml(c.lede)}</p>
                <ul class="sdd-homes-list" data-list>
                    ${codes.map(code => {
                        const pos = sel.indexOf(code);
                        const cls = pos !== -1 ? 'is-selected' : '';
                        return `
                            <li class="sdd-homes-row ${cls}" data-code="${code}" tabindex="0">
                                <span><span class="pos">${pos !== -1 ? (pos + 1) : ''}</span><span class="city">${escapeHtml(cities[code][ed] || cities[code].en)}</span></span>
                                <span class="code">${code}</span>
                            </li>
                        `;
                    }).join('')}
                </ul>
                <div class="sdd-homes-actions">
                    <button type="button" class="sdd-homes-btn" data-save>${escapeHtml(c.save)}</button>
                    <button type="button" class="sdd-homes-btn is-quiet" data-clear>${escapeHtml(c.clear)}</button>
                </div>
            </div>
        `;
        // local — 저장 전 임시 선택 배열(Save 눌러야 실제 저장).
        let local = sel;
        _modal.querySelector('[data-close]').addEventListener('click', closeModal);
        _modal.querySelectorAll('.sdd-homes-row').forEach(row => {
            // 행 클릭 = 토글: 이미 있으면 제거, 3개 미만이면 추가, 꽉 찼으면 마지막을 교체.
            row.addEventListener('click', () => {
                const code = row.dataset.code;
                const idx = local.indexOf(code);
                if (idx !== -1) {
                    local.splice(idx, 1);
                } else if (local.length < 3) {
                    local.push(code);
                } else {
                    // Replace last selection so user can keep tapping cities
                    local[2] = code;
                }
                // Repaint with the new selection so the position number updates.
                if (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.setHomes) {
                    // don't persist yet — that's what Save does
                }
                // Repaint just the list rows.
                const cities = (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.CITIES) || {};
                _modal.querySelectorAll('.sdd-homes-row').forEach(r => {
                    const code = r.dataset.code;
                    const pos = local.indexOf(code);
                    r.classList.toggle('is-selected', pos !== -1);
                    r.querySelector('.pos').textContent = pos !== -1 ? (pos + 1) : '';
                });
            });
        });
        // 저장 — 임시 선택을 실제 저장하고 모달을 닫은 뒤 표지 공감 블록을 다시 그린다.
        _modal.querySelector('[data-save]').addEventListener('click', () => {
            if (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.setHomes) {
                window.SAUDADE_PERSONAL.setHomes(local);
            }
            closeModal();
            // Repaint the cover personal block if mounted.
            const target = document.getElementById('sddCoverPersonal');
            if (target && window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.render) {
                window.SAUDADE_PERSONAL.render(target);
            }
        });
        _modal.querySelector('[data-clear]').addEventListener('click', () => {
            local = [];
            if (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.setHomes) {
                window.SAUDADE_PERSONAL.setHomes([]);
            }
            paint();
        });
    }

    // openModal — 모달을 만들고(최초 1회, ESC 닫기 포함) 그린 뒤 표시.
    function openModal() {
        injectStyles();
        if (!_modal) {
            _modal = document.createElement('div');
            _modal.className = 'sdd-homes-modal';
            _modal.setAttribute('role', 'dialog');
            _modal.setAttribute('aria-modal', 'true');
            document.body.appendChild(_modal);
            document.addEventListener('keydown', e => {
                if (e.key === 'Escape' && _modal.classList.contains('active')) closeModal();
            });
        }
        paint();
        _modal.classList.add('active');
    }
    // closeModal — 모달을 숨긴다.
    function closeModal() { if (_modal) _modal.classList.remove('active'); }

    // handleHash — URL 이 #homes 이면 모달을 열고 해시를 지운다(딥링크 트리거).
    function handleHash() {
        if (location.hash === '#homes') {
            openModal();
            try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        }
    }
    window.addEventListener('hashchange', handleHash);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', handleHash);
    else handleHash();

    // 전역 공개 API — 모달 열기/닫기.
    window.SAUDADE_HOMES = { openModal, closeModal };
})();
