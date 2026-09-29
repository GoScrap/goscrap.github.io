/* erp-core.js — BVS · SSJG · PYRO 공통 코어 v1.05 (2026-09-29 · v1.05 바쁠 때 자동 재시도 · v1.04 확인창 ERPC.ask · 알림 ERPC.say — 브라우저 alert/confirm 대신)
 * 세 ERP가 같은 파일을 쓴다. bvs-erp.github.io 와 goscrap.github.io 에 똑같은 사본을 둔다(sha256 동일 유지).
 * 원칙: 조회 실패·건수 불일치는 조용히 넘기지 않고 오류로 드러낸다. 0원과 '자료 없음'을 구분한다.
 */
(function (w) {
  'use strict';
  var PS = 1000;

  /* 화면 출력용 이스케이프 — 작은따옴표·백틱 포함 */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"'`]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c];
    });
  }

  /* HTML 속성(onclick 등) 안의 JS 문자열 값 — 이름에 ' 가 있거나 외부 자료(메일 제목 등)에 따옴표·꺾쇠가 있어도
   * 스크립트가 깨지거나 주입되지 않는다. 사용: '...onclick="fn('+ERPC.jsq(v)+')"...'  (속성은 반드시 큰따옴표로 감쌀 것) */
  function jsq(v) { return esc(JSON.stringify(String(v == null ? '' : v))); }

  /* 한국 시각 기준 날짜 — 브라우저 시간대와 무관 */
  function kstParts(d) {
    var t = new Date((d ? new Date(d) : new Date()).getTime() + 9 * 3600 * 1000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function todayKst(d) { var k = kstParts(d); return k.y + '-' + p2(k.m) + '-' + p2(k.d); }
  function ymKst(d) { var k = kstParts(d); return k.y + '-' + p2(k.m); }

  /* 금액 — null/빈값은 '–'(자료 없음), 0은 '0' */
  function won(n) {
    if (n === null || n === undefined || n === '' || isNaN(+n)) return '–';
    return Math.round(+n).toLocaleString('ko-KR');
  }

  /* 끝까지 이어받기 조회 (표준형)
   * spec = { sb, from:'표', select:'열', order:[['열',{ascending:true}],...], filter:function(q){...}, pk:'고유열', max:200000, label:'화면 이름' }
   * - 첫 요청에 전체 건수(count=exact)를 함께 받아, 다 받은 뒤 건수를 대조한다. 어긋나면 오류(조용히 틀린 합계 금지).
   * - pk가 있으면 정렬 끝에 pk를 붙여 동률 때문에 행이 겹치거나 빠지지 않게 한다. pk가 있거나 unique:true(정렬이 이미 고유)일 때만 나머지 쪽을 4개씩 병렬로 받는다.
   * 반환: 행 배열. 실패 시 Error throw.
   */
  async function pageAll(spec) {
    var sb = spec.sb || w.sb, max = spec.max || 200000, cols = spec.select || '*';
    var ord = (spec.order || []).slice();
    if (spec.pk && !ord.some(function (o) { return o[0] === spec.pk; })) ord.push([spec.pk, { ascending: true }]);
    function q(f, withCount) {
      var x = withCount ? sb.from(spec.from).select(cols, { count: 'exact' }) : sb.from(spec.from).select(cols);
      if (spec.filter) x = spec.filter(x);
      ord.forEach(function (o) { x = x.order(o[0], o[1] || { ascending: true }); });
      return x.range(f, f + PS - 1);
    }
    var r0 = await q(0, true);
    if (r0.error) throw r0.error;
    var out = (r0.data || []).slice(), n = typeof r0.count === 'number' ? Math.min(r0.count, max) : null;
    if (out.length < PS) return out;
    if ((spec.pk || spec.unique) && n !== null) {
      var starts = []; for (var s = PS; s < n; s += PS) starts.push(s);
      for (var i = 0; i < starts.length; i += 4) {
        var rs = await Promise.all(starts.slice(i, i + 4).map(function (st) { return q(st); }));
        for (var k = 0; k < rs.length; k++) { if (rs[k].error) throw rs[k].error; out = out.concat(rs[k].data || []); }
      }
    } else {
      for (var f = PS; out.length < max; f += PS) {
        var r = await q(f); if (r.error) throw r.error;
        var d = r.data || []; out = out.concat(d); if (d.length < PS) break;
      }
    }
    if (n !== null && r0.count <= max && out.length !== n) {
      var e = new Error((spec.label || spec.from) + ' 건수 불일치 ' + out.length.toLocaleString() + '/' + n.toLocaleString() + ' — 조회를 다시 눌러 주세요');
      e.code = 'ERPC_COUNT_MISMATCH'; throw e;
    }
    return out;
  }

  /* 이어받기 조회 (기존 조회 함수 감싸기용)
   * mk: 호출할 때마다 정렬까지 붙인 새 조회를 돌려주는 함수. 건수 대조는 못 하므로 정렬에 고유 열을 꼭 넣을 것.
   */
  async function pageAllMk(mk, opt) {
    opt = opt || {};
    var max = opt.max || 200000, out = [];
    for (var f = 0; out.length < max; f += PS) {
      var r = await mk().range(f, f + PS - 1);
      if (r.error) throw r.error;
      var d = r.data || []; out = out.concat(d);
      if (d.length < PS) break;
    }
    return out;
  }

  /* 시간 제한 fetch (v1.02) — createClient(url, key, { global: { fetch: ERPC.fetchT } })
   * 휴대폰에서 탭을 오가면 백그라운드 탭의 요청이 끝나지도 실패하지도 않은 채 멈출 수 있다.
   * 그러면 '조회 중' 표시가 풀리지 않아 조회 버튼이 먹통이 된다(SSJG 모바일, 2026-09-28).
   * 45초 안에 응답이 없으면 요청을 끊고 오류로 돌려준다 → 화면은 '서버 응답이 늦습니다'를 보여 주고 다시 조회할 수 있다. */
  var FETCH_MS = 45000;
  /* v1.03: 머리글만 오고 본문이 멈추는 경우(휴대폰 탭 전환·약한 전파)까지 막는다 — 본문을 다 받을 때까지를 45초 안에 끝낸다.
   * 본문은 여기서 끝까지 읽어 새 Response로 돌려준다(JSON 응답이라 크기 부담 없음). */
  var NOBODY = { 101: 1, 204: 1, 205: 1, 304: 1 };
  /* v1.05 서버가 잠깐 바쁠 때(스키마 캐시 재적재 PGRST002 · 문장 시간 초과 57014 · 503) 같은 요청을 1.5초·4초 뒤 다시 보낸다.
   * 두 경우 모두 서버에서 실행되지 않았거나 되돌려진 요청이라 다시 보내도 중복 저장되지 않는다. */
  /* v1.05 동시 조회 제한 — 화면 하나가 무거운 조회(급여대장·달력·대시보드)를 한꺼번에 5~6개 보내면
   * 작은 DB에서 서로 CPU를 뺏어 8초 제한에 걸린다(2026-09-29 로그 실측). DB 조회(/rest/v1/)는 동시에 3개까지만 보내고 나머지는 줄 세운다. */
  var GATE_MAX = 3, gateN = 0, gateQ = [];
  function gateIn(u) {
    if (!/\/rest\/v1\//.test(u)) return Promise.resolve(false);
    if (gateN < GATE_MAX) { gateN++; return Promise.resolve(true); }
    return new Promise(function (z) { gateQ.push(z); });
  }
  function gateOut(held) { if (!held) return; var nx = gateQ.shift(); if (nx) nx(true); else gateN--; }
  function fetchT(input, init) {
    var tries = 0, url = String((input && input.url) || input || '');
    function again() {
      return gateIn(url).then(function (held) {
        return fetch1(input, init).then(function (r) { gateOut(held); return r; }, function (e) { gateOut(held); throw e; });
      }).then(function (r) {
        if (tries >= 2 || !(r.status === 503 || r.status === 500 || r.status === 504)) return r;
        return r.clone().text().then(function (tx) {
          if (!/PGRST002|schema cache|57014|statement timeout|canceling statement/i.test(tx || '')) return r;
          tries++; return new Promise(function (z) { setTimeout(z, tries === 1 ? 1500 : 4000); }).then(again);
        }, function () { return r; });
      });
    }
    return again();
  }
  function fetch1(input, init) {
    init = init || {};
    if (typeof AbortController !== 'function') return w.fetch(input, init);
    var ac = new AbortController(), outer = init.signal, t = setTimeout(function () { ac.abort(); }, FETCH_MS);
    if (outer) { if (outer.aborted) ac.abort(); else outer.addEventListener('abort', function () { ac.abort(); }); }
    var opt = {}; for (var k in init) opt[k] = init[k]; opt.signal = ac.signal;
    function fail(e) {
      clearTimeout(t);
      if (ac.signal.aborted && !(outer && outer.aborted)) { var x = new Error('timeout: 서버 응답 ' + (FETCH_MS / 1000) + '초 초과'); x.code = 'ERPC_TIMEOUT'; throw x; }
      throw e;
    }
    return w.fetch(input, opt).then(function (r) {
      if (NOBODY[r.status] || (opt.method && String(opt.method).toUpperCase() === 'HEAD')) { clearTimeout(t); return r; }
      return r.arrayBuffer().then(function (buf) {
        clearTimeout(t);
        return new Response(buf, { status: r.status, statusText: r.statusText, headers: r.headers });
      });
    }).catch(fail);
  }

  /* {data,error} 형태가 필요한 곳용 */
  async function pageAllR(spec) {
    try { return { data: await pageAll(spec), error: null }; }
    catch (e) { return { data: null, error: e }; }
  }

  /* 오류 문구 — 사람이 읽을 한 줄 */
  function errText(e) {
    if (!e) return '';
    var m = e.message || e.error_description || e.hint || String(e);
    if (/JWT|jwt expired|invalid claim/i.test(m)) return '로그인이 만료되었습니다. 다시 로그인해 주세요';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return '네트워크 연결을 확인해 주세요';
    if (/timeout|57014|canceling statement/i.test(m)) return '서버 응답이 늦습니다. 잠시 후 조회를 다시 눌러 주세요';
    if (/permission denied|42501|row-level security/i.test(m)) return '권한이 없습니다';
    return m;
  }

  /* v1.04 확인창·알림 (R5: 3사 alert/confirm 폐지)
   * ERPC.ask(제목, 내용, {ok:'버튼 글자', danger:true(빨간 버튼), input:true(입력칸), value:'기본값', placeholder}) → Promise: 확인 true(입력칸이면 글자), 취소 null
   * ERPC.say(내용, 'e'|'g'|'w') → 화면 아래 알림(3초, 오류는 6초). 멈추지 않는다. */
  var DCSS = '.erpc-bk{position:fixed;inset:0;background:rgba(15,23,42,.38);display:flex;align-items:center;justify-content:center;z-index:10000}'
    + '.erpc-bx{background:var(--sf,var(--panel,#fff));color:var(--tx,var(--text,#111));border:1px solid var(--ln,var(--border,#d0d5dd));border-radius:8px;min-width:320px;max-width:min(560px,92vw);box-shadow:0 12px 40px rgba(0,0,0,.25);font-size:13.5px}'
    + '.erpc-bx h4{margin:0;padding:14px 18px 6px;font-size:15px}.erpc-bx .m{padding:4px 18px 12px;white-space:pre-line;line-height:1.55;max-height:50vh;overflow:auto}'
    + '.erpc-bx input{display:block;width:calc(100% - 36px);margin:0 18px 12px;height:32px;padding:0 10px;border:1px solid var(--ln,var(--border,#d0d5dd));border-radius:4px;font:inherit;background:inherit;color:inherit;box-sizing:border-box}'
    + '.erpc-bx .f{display:flex;justify-content:flex-end;gap:8px;padding:10px 18px 14px;border-top:1px solid var(--ln2,var(--border,#eee))}'
    + '.erpc-bx button{height:32px;padding:0 16px;border-radius:4px;border:1px solid var(--ln,var(--border,#d0d5dd));background:inherit;color:inherit;font:inherit;cursor:pointer}'
    + '.erpc-bx button.p{background:var(--ac,var(--accent,#1d4ed8));border-color:var(--ac,var(--accent,#1d4ed8));color:#fff}.erpc-bx button.d{background:#b42318;border-color:#b42318;color:#fff}'
    + '.erpc-ts{position:fixed;left:50%;bottom:44px;transform:translateX(-50%);display:flex;flex-direction:column;gap:6px;align-items:center;z-index:10001;pointer-events:none}'
    + '.erpc-t{background:#1f2937;color:#fff;padding:8px 16px;border-radius:6px;font-size:13px;max-width:80vw;white-space:pre-line;box-shadow:0 4px 14px rgba(0,0,0,.2)}.erpc-t.e{background:#b42318}.erpc-t.g{background:#1f7a4d}.erpc-t.w{background:#92400e}';
  function dcss() { if (document.getElementById('erpc-css')) return; var s = document.createElement('style'); s.id = 'erpc-css'; s.textContent = DCSS; document.head.appendChild(s); }
  function say(msg, kind) {
    dcss(); var box = document.querySelector('.erpc-ts');
    if (!box) { box = document.createElement('div'); box.className = 'erpc-ts'; document.body.appendChild(box); }
    var m = String(msg == null ? '' : msg);
    if ([].some.call(box.children, function (x) { return x.textContent === m; })) return;
    var t = document.createElement('div'); t.className = 'erpc-t ' + (kind || ''); t.textContent = m; box.appendChild(t);
    setTimeout(function () { t.remove(); }, kind === 'e' ? 6000 : 3000);
  }
  function ask(title, msg, opt) {
    opt = opt || {}; dcss();
    return new Promise(function (res) {
      var bk = document.createElement('div'); bk.className = 'erpc-bk';
      bk.innerHTML = '<div class="erpc-bx" role="dialog" aria-modal="true"><h4></h4><div class="m"></div>' + (opt.input ? '<input>' : '')
        + '<div class="f">' + (opt.hideCancel ? '' : '<button class="n">취소</button>') + '<button class="' + (opt.danger ? 'd' : 'p') + ' y"></button></div></div>';
      bk.querySelector('h4').textContent = title || '확인'; bk.querySelector('.m').textContent = msg || '';
      bk.querySelector('.y').textContent = opt.ok || '확인';
      var inp = bk.querySelector('input'); if (inp) { inp.value = opt.value != null ? opt.value : ''; inp.placeholder = opt.placeholder || ''; }
      document.body.appendChild(bk);
      var prev = document.activeElement;
      function done(v) { document.removeEventListener('keydown', key, true); bk.remove(); try { if (prev && prev.focus) prev.focus(); } catch (e) {} res(v); }
      function key(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); }
        else if (e.key === 'Enter' && !e.isComposing && (!inp || e.target === inp || !opt.danger)) { e.preventDefault(); e.stopPropagation(); ok(); }
      }
      function ok() { done(inp ? (inp.value.trim() || null) : true); }
      bk.querySelector('.y').onclick = ok;
      var n = bk.querySelector('.n'); if (n) n.onclick = function () { done(null); };
      bk.onclick = function (e) { if (e.target === bk) done(null); };
      document.addEventListener('keydown', key, true);
      setTimeout(function () { (inp || bk.querySelector(opt.danger ? '.n' : '.y') || bk.querySelector('.y')).focus(); }, 30);
    });
  }

  w.ERPC = { version: '1.05', ask: ask, say: say, esc: esc, jsq: jsq, todayKst: todayKst, ymKst: ymKst, won: won, pageAll: pageAll, pageAllMk: pageAllMk, pageAllR: pageAllR, errText: errText, fetchT: fetchT };
})(window);
