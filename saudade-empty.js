// saudade · unified empty-state component
//
// Editor's-note flavoured empty states for every section. One look, five
// editions. Replaces the section-specific empty-state markup that was
// scattered across ledger / atlas / cover / dispatches.
//
// API:
//   window.SAUDADE_EMPTY.render(targetEl, {
//       eyebrow:  'A LEDGER, IN FOUR COLUMNS.',
//       headline: 'Nothing on the ledger yet.',
//       lede:     'Add a visa, a tax-residency entry…',
//       actions:  [{ label, onClick, kind: 'primary'|undefined, hint: 'Cmd+E' }],
//       note:     'We never store your data on a server.'
//   })
//
//   window.SAUDADE_EMPTY.text(section)   →  pre-translated copy bundle
//                                            for sections: ledger / atlas /
//                                            cover / dispatches / listening
'use strict';

(function() {
    if (window.SAUDADE_EMPTY) return;

    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    const EDITOR_LABEL = {
        en: "Editor's note", ko: '편집장의 메모', ja: '編集長より',
        pt: 'Nota do editor', es: 'Nota del editor'
    };

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    function render(target, opts) {
        if (!target) return null;
        opts = opts || {};
        const eyebrow  = opts.eyebrow  || '';
        const headline = opts.headline || '';
        const lede     = opts.lede     || '';
        const actions  = Array.isArray(opts.actions) ? opts.actions : [];
        const note     = opts.note     || '';

        const root = document.createElement('section');
        root.className = 'sdd-empty';
        root.setAttribute('data-editor-note-label', L(EDITOR_LABEL));
        root.innerHTML = `
            ${eyebrow ? `<p class="sdd-empty__eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
            ${headline ? `<h3 class="sdd-empty__h">${escapeHtml(headline)}</h3>` : ''}
            ${lede ? `<p class="sdd-empty__lede">${lede /* lede may include <em>/<strong> */}</p>` : ''}
            ${actions.length ? `<ul class="sdd-empty__actions" role="list">
                ${actions.map((a, i) => `
                    <li>
                        <button type="button"
                                class="sdd-empty__action ${a.kind === 'primary' ? 'is-primary' : ''}"
                                data-action-idx="${i}">
                            ${escapeHtml(a.label || '')}
                            ${a.hint ? `<small>${escapeHtml(a.hint)}</small>` : ''}
                        </button>
                    </li>`).join('')}
            </ul>` : ''}
            ${note ? `<p class="sdd-empty__note">${escapeHtml(note)}</p>` : ''}
        `;

        // Wire actions
        root.querySelectorAll('.sdd-empty__action').forEach(btn => {
            const idx = parseInt(btn.dataset.actionIdx, 10);
            const a = actions[idx];
            if (a && typeof a.onClick === 'function') {
                btn.addEventListener('click', a.onClick);
            } else if (a && a.href) {
                btn.addEventListener('click', () => { window.location.href = a.href; });
            }
        });

        // If `target` is a selector, replace its children with our element.
        const el = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!el) return root;
        el.innerHTML = '';
        el.appendChild(root);
        return root;
    }

    // ─── Pre-translated copy banks, per section ─────────────────────────
    function text(section) {
        switch (section) {
            case 'ledger':
                return {
                    eyebrow: L({ en: 'A LEDGER, IN FOUR COLUMNS.', ko: '네 칸짜리 장부.', ja: '四つの欄の台帳。', pt: 'UM LIVRO, EM QUATRO COLUNAS.', es: 'UN LIBRO, EN CUATRO COLUMNAS.' }),
                    headline: L({ en: 'Nothing on the ledger yet.', ko: '장부에 아직 아무것도 없다.', ja: '台帳にまだ何もない。', pt: 'Ainda nada no livro.', es: 'Todavía nada en el libro.' }),
                    lede: L({
                        en: 'Add a visa, a tax-residency entry, a health-insurance pause, or a pension filing. <em>Each entry is a row this newspaper will count from tomorrow morning.</em>',
                        ko: '비자·세금 거주일·건강보험 정지·연금 신고를 추가하라. <em>각 항목은 이 신문이 내일 아침부터 헤아릴 한 줄이 된다.</em>',
                        ja: 'ビザ、税居住、健康保険の停止、年金届出のいずれかを加える。<em>一つひとつが、明朝からこの新聞が数える一行になる。</em>',
                        pt: 'Adicione um visto, uma entrada fiscal, uma pausa de seguro, ou um registo de pensão. <em>Cada entrada é uma linha que este jornal contará a partir de amanhã.</em>',
                        es: 'Añada un visado, una residencia fiscal, una pausa de seguro o un registro de pensión. <em>Cada entrada es una línea que este periódico contará desde mañana.</em>'
                    }),
                    note: L({
                        en: 'We never store your visa data on a server. It lives on this device only — clear your browser, and it disappears with you.',
                        ko: '비자 데이터는 서버에 저장하지 않는다. 이 기기에만 머문다 — 브라우저를 비우면 함께 사라진다.',
                        ja: 'ビザ情報はサーバーに保存しない。この端末だけにある — ブラウザを消せば、ともに消える。',
                        pt: 'Nunca guardamos os seus dados num servidor. Vivem apenas neste dispositivo — limpe o navegador, e desaparecem consigo.',
                        es: 'Nunca guardamos sus datos en un servidor. Viven sólo en este dispositivo — limpie el navegador, y desaparecen con usted.'
                    })
                };
            case 'atlas':
                return {
                    eyebrow: L({ en: 'CAFÉS, VERIFIED.', ko: '확인된 카페.', ja: '確認済みカフェ。', pt: 'CAFÉS, VERIFICADOS.', es: 'CAFÉS, VERIFICADOS.' }),
                    headline: L({ en: 'No café visited yet.', ko: '아직 들른 카페가 없다.', ja: 'まだ訪れたカフェがない。', pt: 'Ainda não visitou nenhum café.', es: 'Todavía no ha visitado ningún café.' }),
                    lede: L({
                        en: 'Open a café from the list and tap <strong>I sat here</strong>. Each visit becomes a tiny row in your saudade — a record of where you actually wrote, not where the algorithm thought you should.',
                        ko: '목록에서 카페를 열고 <strong>여기 앉았다</strong> 를 눌러라. 방문 하나하나가 saudade 의 작은 한 줄이 된다 — 알고리즘이 추천한 곳이 아니라 실제로 글을 쓴 곳의 기록.',
                        ja: 'リストからカフェを開いて <strong>ここに座った</strong> を押す。訪問の一つひとつが saudade の小さな行になる — アルゴリズムが勧めた場所ではなく、実際に書いた場所の記録。',
                        pt: 'Abra um café da lista e toque <strong>Sentei-me aqui</strong>. Cada visita torna-se uma pequena linha na sua saudade — um registo de onde escreveu de facto, não onde o algoritmo achou que devia.',
                        es: 'Abra un café de la lista y pulse <strong>Me senté aquí</strong>. Cada visita se convierte en una pequeña línea de su saudade — un registro de dónde escribió de verdad, no de dónde el algoritmo creyó que debía.'
                    }),
                    note: L({
                        en: 'A note from the desk. We test outlets, noise, and Wi-Fi ourselves. We do not list a café we have not sat in.',
                        ko: '편집부의 메모. 콘센트·소음·와이파이는 우리가 직접 시험한다. 앉아보지 않은 카페는 등록하지 않는다.',
                        ja: '編集部より。コンセント・騒音・Wi-Fi は自分たちで試す。座ったことのないカフェは載せない。',
                        pt: 'Uma nota da redacção. Testamos as tomadas, o ruído e o Wi-Fi. Não listamos um café onde não nos sentámos.',
                        es: 'Una nota de la redacción. Probamos enchufes, ruido y Wi-Fi. No incluimos un café donde no nos hayamos sentado.'
                    })
                };
            case 'dispatches':
                return {
                    eyebrow: L({ en: 'THE WIRES, EDITED.', ko: '편집된 통신문.', ja: '編まれた電信。', pt: 'OS DESPACHOS, EDITADOS.', es: 'LOS DESPACHOS, EDITADOS.' }),
                    headline: L({ en: 'No dispatch ready.', ko: '아직 도착한 디스패치가 없다.', ja: 'まだディスパッチがない。', pt: 'Ainda não há despachos.', es: 'Todavía no hay despachos.' }),
                    lede: L({
                        en: 'The desk files three city items, six days a week. <em>Sunday is silence — by design.</em>',
                        ko: '편집부는 일주일에 엿새, 도시당 세 항목을 보낸다. <em>일요일은 침묵 — 의도된.</em>',
                        ja: '編集部は週六日、都市ごとに三本を送る。<em>日曜は沈黙 — 意図されたもの。</em>',
                        pt: 'A redacção arquiva três itens por cidade, seis dias por semana. <em>Domingo é silêncio — propositado.</em>',
                        es: 'La redacción archiva tres elementos por ciudad, seis días por semana. <em>El domingo es silencio — intencionado.</em>'
                    }),
                    note: L({
                        en: 'Dispatches are AI-drafted and AI-reviewed against the magazine’s constitution. Sources are quoted at most twenty-five words.',
                        ko: '디스패치는 AI 가 초안을 작성하고, 발행 전 AI 가 매거진 헌법에 맞는지 다시 검수한다. 인용은 25 단어를 넘지 않는다.',
                        ja: 'ディスパッチは AI が起草し、発行前に AI がもう一度、本誌憲法に照らして検閲する。引用は二十五語を超えない。',
                        pt: 'Os despachos são redigidos por IA e revistos por uma segunda passagem de IA contra a constituição editorial. Citamos no máximo vinte e cinco palavras.',
                        es: 'Los despachos los redacta una IA y los revisa una segunda pasada de IA frente a la constitución editorial. Citamos como máximo veinticinco palabras.'
                    })
                };
            case 'cover':
                return {
                    eyebrow: L({ en: 'TODAY.', ko: '오늘.', ja: '今日。', pt: 'HOJE.', es: 'HOY.' }),
                    headline: L({ en: 'Three cities, no schedule.', ko: '세 도시, 정해진 시간 없음.', ja: '三つの都市、時刻表なし。', pt: 'Três cidades, sem horário.', es: 'Tres ciudades, sin horario.' }),
                    lede: L({
                        en: 'Edited from Lisbon. <em>A slow newspaper for digital nomads.</em>',
                        ko: '리스본에서 편집. <em>디지털 노마드를 위한 느린 신문.</em>',
                        ja: 'リスボン編集。<em>デジタルノマドのための、ゆっくりとした新聞。</em>',
                        pt: 'Editado em Lisboa. <em>Um jornal lento para nómadas digitais.</em>',
                        es: 'Editado desde Lisboa. <em>Un periódico lento para nómadas digitales.</em>'
                    }),
                    note: ''
                };
            case 'listening':
                // When the room is entirely empty (no tracks loaded at all),
                // we tell the truth: the editor hasn't selected any yet.
                // §3 — list only what we've heard carefully.
                return {
                    eyebrow: L({ en: 'THE LISTENING ROOM.', ko: '청취실.', ja: 'リスニングルーム。', pt: 'A SALA DE ESCUTA.', es: 'LA SALA DE ESCUCHA.' }),
                    headline: L({
                        en: 'Awaiting the first track.',
                        ko: '첫 트랙을 기다린다.',
                        ja: '最初のトラックを待つ。',
                        pt: 'À espera da primeira faixa.',
                        es: 'A la espera de la primera pista.'
                    }),
                    lede: L({
                        en: 'Field recordings are added one at a time — listened to in full before they are filed. <em>The room is empty until the editor presses play and means it.</em>',
                        ko: '현장 녹음은 한 트랙씩 추가한다 — 편집장이 전체를 들어 본 뒤에야 게재한다. <em>편집장이 재생을 누르고 동의하기 전까지 방은 비어 있다.</em>',
                        ja: 'フィールド録音は一トラックずつ追加する — 編集長が全編を聴いた上で掲載する。<em>編集長が再生を押し、納得するまで部屋は空のまま。</em>',
                        pt: 'As gravações de campo são adicionadas uma a uma — ouvidas na íntegra antes de serem arquivadas. <em>A sala fica vazia até o editor carregar em play e concordar.</em>',
                        es: 'Las grabaciones de campo se añaden de una en una — escuchadas por completo antes de archivarse. <em>La sala queda vacía hasta que el editor pulsa reproducir y lo aprueba.</em>'
                    }),
                    note: L({
                        en: 'Every track will declare its licence and credits. CONTENT-LICENSE.md §3.',
                        ko: '모든 트랙은 라이선스와 크레딧을 명시한다. CONTENT-LICENSE.md §3.',
                        ja: '全トラックがライセンスとクレジットを明記する。CONTENT-LICENSE.md §3。',
                        pt: 'Cada faixa declarará a sua licença e créditos. CONTENT-LICENSE.md §3.',
                        es: 'Cada pista declarará su licencia y créditos. CONTENT-LICENSE.md §3.'
                    })
                };
            default:
                return { eyebrow: '', headline: '', lede: '', note: '' };
        }
    }

    window.SAUDADE_EMPTY = { render, text };
})();
