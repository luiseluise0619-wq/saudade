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

    /* brief: editorial note shown at the bottom of the atlas page. Explains
       the listing bar (visited or vetted), no payment, no borrowed photos. */
    const atlasNoteTitle = {
        en: 'A note on places.',
        ko: '편집부 메모.',
        ja: '場所についての覚書。',
        pt: 'Uma nota sobre os lugares.',
        es: 'Una nota sobre los lugares.'
    };
    const atlasNoteBody = {
        en: 'We list only what we have visited. We accept no payment for inclusion. We never use a photograph that is not our own. If you are an owner and would like to be removed, write to luiseluise0619@gmail.com.',
        ko: '직접 방문한 곳만 게재한다. 입점료는 받지 않는다. 본인이 촬영하지 않은 사진은 쓰지 않는다. 삭제를 원하는 점주는 luiseluise0619@gmail.com 으로 연락 바람.',
        ja: '実際に訪れた場所のみを掲載する。掲載料は受け取らない。自身で撮影していない写真は使わない。掲載辞退は luiseluise0619@gmail.com まで。',
        pt: 'Listamos apenas o que visitámos. Não aceitamos pagamento pela inclusão. Nunca usamos uma fotografia que não seja nossa. Se é proprietário e quiser ser removido, escreva para luiseluise0619@gmail.com.',
        es: 'Sólo listamos lo que hemos visitado. No aceptamos pago por inclusión. Nunca usamos una fotografía que no sea nuestra. Si es propietario y desea retirarse, escriba a luiseluise0619@gmail.com.'
    };

    /* brief: editorial note shown at the bottom of the dispatches page.
       Explains how dispatches are written (own words, max 25-word quotes,
       linked source, no wire-service reuse, no borrowed photos, AI-drafted
       and AI-reviewed against the constitution). Voice is matter-of-fact. */
    const dispatchesNoteTitleFull = {
        en: 'A note on sources.',
        ko: '출처에 대한 메모.',
        ja: '出典についての覚書。',
        pt: 'Uma nota sobre as fontes.',
        es: 'Una nota sobre las fuentes.'
    };
    const dispatchesNoteToggle = {
        en: 'A note on sources',
        ko: '출처에 대한 메모',
        ja: '出典についての覚書',
        pt: 'Uma nota sobre as fontes',
        es: 'Una nota sobre las fuentes'
    };
    /* JA was 検閲する (censor) — wrong word; the action is 校閲 (proofread /
       editorial review). Fixed here as part of the voice migration. */
    const dispatchesNoteBody = {
        en: 'Each dispatch is rewritten in our own words from the source listed. We quote no more than twenty-five words. We link to the original. We do not republish AP, Reuters, or Bloomberg copy. We never use photographs we did not take ourselves. Dispatches are AI-drafted and AI-reviewed against the magazine’s constitution before filing.',
        ko: '각 디스패치는 명시된 출처를 바탕으로 우리의 언어로 다시 쓴다. 인용은 25 단어를 넘지 않는다. 원문 링크를 단다. AP·Reuters·Bloomberg 기사는 재배포하지 않는다. 본인이 촬영하지 않은 사진은 쓰지 않는다. 디스패치는 AI 가 초안을 잡고, 발행 전 다시 한 번 AI 가 매거진 헌법에 비추어 검수한다.',
        ja: '各通信は明示された出典から自らの言葉で書き直す。引用は二十五語以内。出典リンクを付ける。AP・Reuters・Bloomberg の記事は再配布しない。自身で撮影していない写真は使わない。通信は AI が起草し、発行前に AI がもう一度、本誌憲法に照らして校閲する。',
        pt: 'Cada despacho é reescrito em palavras nossas a partir da fonte listada. Citamos no máximo vinte e cinco palavras. Ligamos ao original. Não republicamos AP, Reuters ou Bloomberg. Nunca usamos fotografias que não tirámos. Os despachos são redigidos por IA e revistos por uma segunda passagem de IA contra a constituição editorial antes de serem publicados.',
        es: 'Cada despacho se reescribe con palabras nuestras a partir de la fuente indicada. Citamos no más de veinticinco palabras. Enlazamos al original. No reeditamos copia de AP, Reuters o Bloomberg. Nunca usamos fotografías que no tomamos nosotros. Los despachos los redacta una IA y luego una segunda pasada de IA los revisa frente a la constitución editorial antes de su publicación.'
    };

    /* brief: ledger intro — sits above the four counters (visa / tax /
       insurance / pension). Eyebrow is uppercase formal; body is one
       paragraph with the four numbers in italic, ending with the
       editorial disclaimer "a calendar, not advice." */
    const ledgerIntroEyebrow = {
        en: 'A LEDGER, IN FOUR COLUMNS.',
        ko: '네 칸의 장부.',
        ja: '四欄の台帳。',
        pt: 'UM LIVRO-RAZÃO, EM QUATRO COLUNAS.',
        es: 'UN LIBRO MAYOR, EN CUATRO COLUMNAS.'
    };
    const ledgerIntroBody = {
        en: 'The four numbers a digital nomad watches each morning: <em>how many days the visa permits, how long since the last entry to a tax country, when health insurance pauses, when pension residency files.</em> This page is a calendar, not advice.',
        ko: '디지털 노마드가 매일 아침 들여다보는 네 가지 숫자: <em>비자가 허용한 날짜, 가장 최근 입국 후 며칠이 지났는가, 건강보험은 언제 정지되는가, 연금 해외체류 신고는 언제인가.</em> 이 페이지는 달력이지 조언이 아니다.',
        ja: 'デジタルノマドが毎朝確かめる四つの数字 — <em>ビザの許す日数、最後の入国から何日たったか、健康保険がいつ止まるか、年金の海外居住届はいつか。</em> このページは暦であり、助言ではない。',
        pt: 'Os quatro números que um nómada digital observa todas as manhãs: <em>quantos dias o visto permite, quanto tempo desde a última entrada num país fiscal, quando o seguro de saúde se interrompe, quando se apresenta o registo da pensão.</em> Esta página é um calendário, não um conselho.',
        es: 'Los cuatro números que un nómada digital mira cada mañana: <em>cuántos días permite el visado, cuánto tiempo desde la última entrada a un país fiscal, cuándo se interrumpe el seguro de salud, cuándo se presenta la residencia de pensión.</em> Esta página es un calendario, no un consejo.'
    };

    /* brief: ledger empty state — first time a reader opens the page with
       no entries. Headline is one terse sentence; body is the call to
       action with the four counters named. JA was 'まだ台帳に何も書かれて
       いない。' — workable but flat; new line uses 白紙 (blank paper) for
       the editorial image. */
    const ledgerEmptyHeadline = {
        en: 'Nothing on the ledger yet.',
        ko: '아직 장부에 적힌 것이 없다.',
        ja: 'まだ台帳は白紙のまま。',
        pt: 'Nada no livro-razão ainda.',
        es: 'Nada en el libro mayor todavía.'
    };
    const ledgerEmptyBody = {
        en: 'Add a visa, a tax-residency entry, a health-insurance pause, or a pension filing below. Each entry is a row this newspaper will count from tomorrow morning.',
        ko: '아래에서 비자·세금 거주일·건강보험 정지·연금 신고를 추가한다. 각 항목은 이 신문이 내일 아침부터 헤아릴 한 줄이 된다.',
        ja: '下のフォームからビザ・税居住日・健康保険の停止・年金届出を加える。一つひとつが、明朝からこの新聞が数える一行になる。',
        pt: 'Adicione abaixo um visto, uma entrada de residência fiscal, uma pausa de seguro de saúde ou um registo de pensão. Cada entrada é uma linha que este jornal contará a partir de amanhã de manhã.',
        es: 'Añada abajo un visado, una entrada de residencia fiscal, una pausa de seguro de salud o un registro de pensión. Cada entrada es una fila que este periódico contará desde mañana por la mañana.'
    };
    const ledgerEditorNote = {
        en: 'A note from the editor. We never store your visa data on a server. It lives on this device only — clear your browser, and it disappears with you.',
        ko: '편집장의 메모. 비자 데이터는 서버에 저장하지 않는다. 이 기기에만 머문다 — 브라우저를 비우면 함께 사라진다.',
        ja: '編集長より。ビザの記録はサーバーに残さない。この端末だけにある — ブラウザを消せば、ともに消える。',
        pt: 'Uma nota do editor. Nunca guardamos os seus dados de visto num servidor. Vivem apenas neste dispositivo — limpe o navegador, e desaparecem consigo.',
        es: 'Una nota del editor. Nunca guardamos sus datos de visado en un servidor. Viven sólo en este dispositivo — limpie el navegador, y desaparecen con usted.'
    };

    /* brief: Sunday silence — the constitution §9.1 forbids publishing on
       Sundays. Two lines: declarative message + resume time. KST is the
       editorial timezone and stays in Latin letters across all editions
       (it's how the editorial calendar names itself). */
    const sundayMessage = {
        en: 'Saudade does not publish on Sundays.',
        ko: 'Saudade는 일요일에 쉰다.',
        ja: 'Saudade は日曜日に発行しない。',
        pt: 'A Saudade não publica aos domingos.',
        es: 'Saudade no publica los domingos.'
    };
    const sundayResume = {
        en: 'Dispatches resume Monday at 06:00 KST.',
        ko: '월요일 새벽 6시(KST) 통신 재개.',
        ja: '月曜 朝6時(KST)に通信再開。',
        pt: 'Os despachos voltam segunda às 06h00 KST.',
        es: 'Los despachos vuelven el lunes a las 06:00 KST.'
    };

    /* brief: write-to-editor modal — title above the form + one-line lede
       under it. Voice is plain newspaper: explain what to expect (length
       limit, human review), nothing else. */
    const lettersModalTitle = {
        en: 'Write to the editor.',
        ko: '편집장에게 편지.',
        ja: '編集長への手紙。',
        pt: 'Escrever ao editor.',
        es: 'Escribir al editor.'
    };
    const lettersModalLede = {
        en: 'Up to 800 characters. Read by a human editor before publication.',
        ko: '800자 이내. 편집장이 직접 읽고 검토한 뒤 공개.',
        ja: '八百字まで。編集長が目を通したうえで公開。',
        pt: 'Até 800 caracteres. Lida por um editor humano antes de publicar.',
        es: 'Hasta 800 caracteres. Leída por un editor humano antes de publicar.'
    };

    /* brief: atlas — what shows when the editor has not yet listed any
       café in the current city. Headline + body + two CTAs (switch the
       desk to a city we already cover; suggest a place we should visit).
       ES was using "la mesa" for the desk inside the body and CTA — fixed
       to "la redacción" to match the rest of the cover voice. */
    const atlasEmptyHeadline = {
        en: 'The atlas opens with a city.',
        ko: '아틀라스는 도시 한 곳에서 시작한다.',
        ja: 'アトラスは一つの街から始まる。',
        pt: 'O atlas abre com uma cidade.',
        es: 'El atlas se abre con una ciudad.'
    };
    const atlasEmptyBody = {
        en: 'Each café in this list is a place we have walked into. We list none until we have. Switch the desk to the city you live in, or write to suggest one we should visit.',
        ko: '이 목록에 오른 카페는 모두 우리가 직접 걸어 들어간 곳이다. 들르기 전에는 적지 않는다. 거주하는 도시로 데스크를 옮기거나, 들렀으면 하는 곳을 제안한다.',
        ja: 'この一覧に並ぶカフェは、いずれも私たちが実際に足を運んだ場所だ。訪れるまでは載せない。住む街にデスクを切り替えるか、訪ねるべき場所を知らせてほしい。',
        pt: 'Cada café desta lista é um lugar onde entrámos. Não listamos nenhum antes disso. Mude a redação para a cidade onde vive, ou escreva-nos a sugerir um que devíamos visitar.',
        es: 'Cada café de esta lista es un lugar al que hemos entrado. No listamos ninguno hasta haberlo hecho. Cambie la redacción a la ciudad donde vive, o escríbanos para sugerir uno que deberíamos visitar.'
    };
    const atlasEmptySwitch = {
        en: '+ Switch the desk to your home city',
        ko: '+ 데스크를 거주 도시로 옮기기',
        ja: '+ デスクを住む街へ切り替える',
        pt: '+ Mudar a redação para a sua cidade',
        es: '+ Cambiar la redacción a su ciudad'
    };
    const atlasEmptySubmit = {
        en: '+ Submit a café we should visit',
        ko: '+ 들렀으면 하는 카페 제안하기',
        ja: '+ 訪ねるべきカフェを知らせる',
        pt: '+ Sugerir um café que devíamos visitar',
        es: '+ Sugerir un café que deberíamos visitar'
    };
    const atlasNoMatches = {
        en: 'No matches.',
        ko: '검색 결과 없음.',
        ja: '該当なし。',
        pt: 'Sem resultados.',
        es: 'Sin resultados.'
    };

    /* brief: listening room — editorial note under the player. Explains
       the sourcing rule (self-recorded or CC-licensed via Freesound),
       and the "no music, no talking" constraint. */
    const listeningSoundNoteTitle = {
        en: 'A note on sound.',
        ko: '소리에 대한 메모.',
        ja: '音についての覚書。',
        pt: 'Uma nota sobre o som.',
        es: 'Una nota sobre el sonido.'
    };
    const listeningSoundNoteBody = {
        en: 'Each track is recorded in person or licensed under Creative Commons from Freesound.org. No music. No conversation. The full license list is on the credits page.',
        ko: '모든 트랙은 직접 녹음했거나 Freesound.org 의 크리에이티브 커먼즈 라이선스로 받았다. 음악 없음. 대화 없음. 전체 라이선스 목록은 크레딧 페이지에 있다.',
        ja: '全トラックは自ら録音したか、Freesound.org のクリエイティブ・コモンズ・ライセンスで取得した。音楽なし。会話なし。ライセンス一覧はクレジットページに。',
        pt: 'Cada faixa é gravada pessoalmente ou licenciada em Creative Commons no Freesound.org. Sem música. Sem conversa. A lista completa de licenças está na página de créditos.',
        es: 'Cada pista se graba en persona o se obtiene bajo Creative Commons en Freesound.org. Sin música. Sin conversación. La lista completa de licencias está en la página de créditos.'
    };

    /* brief: dispatches onboarding — what a reader sees when they have
       not picked any cities to follow yet. Headline + one-line body that
       points at the pairings list below or "The Desk". PT/ES were using
       "A Mesa / La Mesa" for The Desk; corrected here to redação /
       redacción for consistency with the cover. */
    const dispatchesOnboardHead = {
        en: 'No cities yet.',
        ko: '아직 도시가 없다.',
        ja: 'まだ街がない。',
        pt: 'Ainda sem cidades.',
        es: 'Aún sin ciudades.'
    };
    const dispatchesOnboardBody = {
        en: 'Pick a starting set below — or open The Desk to choose three cities yourself.',
        ko: '아래에서 시작 묶음을 고른다 — 또는 데스크에서 세 도시를 직접 고른다.',
        ja: '下から始まりの組み合わせを選ぶ — またはデスクで三つの街を自分で選ぶ。',
        pt: 'Escolha um conjunto inicial abaixo — ou abra A Redação para escolher três cidades você mesmo.',
        es: 'Elija un conjunto inicial abajo — o abra La Redacción para elegir tres ciudades usted mismo.'
    };

    /* brief: letters page header — section title shown above the list of
       published letters. Three lines: title (uppercase eyebrow style),
       write-your-own CTA, and the empty-state line for when none have
       been published yet. */
    const lettersPageTitle = {
        en: 'LETTERS TO THE EDITOR',
        ko: '편집장에게 보낸 편지',
        ja: '編集長への手紙',
        pt: 'CARTAS AO EDITOR',
        es: 'CARTAS AL EDITOR'
    };
    const lettersPageWrite = {
        en: 'Write your own',
        ko: '직접 쓰기',
        ja: '一通書く',
        pt: 'Escrever uma',
        es: 'Escribir una'
    };
    const lettersPageNone = {
        en: 'No letters published yet. Be the first.',
        ko: '아직 공개된 편지가 없다. 첫 편지가 되어 보라.',
        ja: 'まだ公開された手紙はない。最初の一通を。',
        pt: 'Ainda sem cartas publicadas. Seja o primeiro.',
        es: 'Aún sin cartas publicadas. Sea el primero.'
    };

    /* brief: stringer application modal — title + lede explaining what a
       stringer column at saudade is. PT was 'sob A cabeçalho' (wrong
       article gender — cabeçalho is masculine); fixed to 'sob O cabeçalho'
       here. ES was 'Hazte' (informal tú); revised to 'Hágase' (usted)
       for register consistency with the rest of the modal. */
    const desksApplyTitle = {
        en: 'Become a stringer.',
        ko: '통신원으로 합류.',
        ja: '通信員になる。',
        pt: 'Tornar-se correspondente.',
        es: 'Hágase corresponsal.'
    };
    const desksApplyLede = {
        en: 'A column under the saudade masthead, signed with your name. We invite slowly — within two weeks if it fits.',
        ko: 'saudade 마스트헤드 아래 본인 이름의 칼럼. 천천히 초대한다 — 어울리면 2주 안에 답장.',
        ja: 'saudade のマストヘッド下に自分の名前で。ゆっくり招く — 合えば二週間以内に返信。',
        pt: 'Uma coluna sob o cabeçalho da saudade, com o seu nome. Convidamos devagar — duas semanas se encaixar.',
        es: 'Una columna bajo la cabecera de saudade, con su nombre. Invitamos despacio — dos semanas si encaja.'
    };

    /* brief: dispatches subtitle — sits under the pillar head on the
       dispatches page. Has a $section token that's replaced with the
       current weekday's section eyebrow at the call site. Rhythm: two
       short clauses, then the section name. Already native in all five
       editions; only relocating. */
    const dispatchesSubTagline = {
        en: 'Three a day. Six days a week. $section.',
        ko: '매일 세 편. 주 엿새. $section.',
        ja: '日に三本、週に六日。$section。',
        pt: 'Três por dia. Seis dias por semana. $section.',
        es: 'Tres al día. Seis días por semana. $section.'
    };

    /* brief: account modal — title shown at the top of the account /
       permissions sheet. One declarative phrase. The rest of the modal
       (section eyebrows, buttons) is chrome and stays inline. */
    const accountModalTitle = {
        en: 'Account & permissions.',
        ko: '계정 및 권한.',
        ja: 'アカウントと権限。',
        pt: 'Conta e permissões.',
        es: 'Cuenta y permisos.'
    };

    /* brief: letters modal — placeholder text inside the textarea so the
       reader sees what tone is expected before they type. Salutation only,
       no body. */
    const lettersPhBody = {
        en: 'Dear editor, …',
        ko: '편집장님께, …',
        ja: '編集長様、…',
        pt: 'Caro editor, …',
        es: 'Estimado editor, …'
    };

    const KEYS = {
        mastTagline,
        listeningHead, listeningItalic,
        atlasHead, atlasItalic,
        ledgerHead, ledgerItalic,
        dispatchesHead, dispatchesEdited, dispatchesResting,
        welcomeEyebrow, welcomeHeadline, welcomeBody,
        quarterlySubtitle,
        atlasNoteTitle, atlasNoteBody,
        dispatchesNoteTitleFull, dispatchesNoteToggle, dispatchesNoteBody,
        ledgerIntroEyebrow, ledgerIntroBody,
        ledgerEmptyHeadline, ledgerEmptyBody, ledgerEditorNote,
        sundayMessage, sundayResume,
        lettersModalTitle, lettersModalLede,
        atlasEmptyHeadline, atlasEmptyBody, atlasEmptySwitch, atlasEmptySubmit, atlasNoMatches,
        listeningSoundNoteTitle, listeningSoundNoteBody,
        dispatchesOnboardHead, dispatchesOnboardBody,
        lettersPageTitle, lettersPageWrite, lettersPageNone,
        desksApplyTitle, desksApplyLede,
        dispatchesSubTagline,
        accountModalTitle,
        lettersPhBody
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
