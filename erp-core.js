/* erp-core.js — BVS · SSJG · PYRO 공통 코어 v1.02 (2026-09-28)
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
  function fetchT(input, init) {
    init = init || {};
    if (typeof AbortController !== 'function') return w.fetch(input, init);
    var ac = new AbortController(), outer = init.signal, t = setTimeout(function () { ac.abort(); }, FETCH_MS);
    if (outer) { if (outer.aborted) ac.abort(); else outer.addEventListener('abort', function () { ac.abort(); }); }
    var opt = {}; for (var k in init) opt[k] = init[k]; opt.signal = ac.signal;
    return w.fetch(input, opt).then(function (r) { clearTimeout(t); return r; }, function (e) {
      clearTimeout(t);
      if (ac.signal.aborted && !(outer && outer.aborted)) { var x = new Error('timeout: 서버 응답 ' + (FETCH_MS / 1000) + '초 초과'); x.code = 'ERPC_TIMEOUT'; throw x; }
      throw e;
    });
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

  w.ERPC = { version: '1.02', esc: esc, jsq: jsq, todayKst: todayKst, ymKst: ymKst, won: won, pageAll: pageAll, pageAllMk: pageAllMk, pageAllR: pageAllR, errText: errText, fetchT: fetchT };
})(window);
