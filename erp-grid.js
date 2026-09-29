/* erp-grid.js v1.00 — 3사(BVS·SSJG·PYRO) 공통 표 부품 (260929_전사_ERP3사_통일표준 R3)
   두 저장소(bvs-erp·goscrap)에 같은 바이트로 둔다.
   화면이 그린 <table>(thead + tbody)을 그대로 두고 기능만 얹는다. tbody를 다시 그려도 상태가 이어진다.
   · 머리칸 누르면 정렬(오름 → 내림 → 원래 순서)
   · 재무제표처럼 줄 순서·소계가 뜻을 갖는 표는 <table data-eg-lite> → 필터만(정렬·합계줄 없음)
   · 머리 아래 필터줄: 글자 포함 / 여러 낱말은 모두 포함 / !글자 = 제외 / >1000 <0 =0 숫자 비교
   · 머리칸 오른쪽 끝 끌어 열 너비 · 첫 열 고정 · 필터를 걸면 보이는 줄만 다시 더한 합계줄
   · 어댑터(ERPG.adapter)가 줄 → 기록을 알려주는 표만:
       맨 앞 체크 → 위에 선택 막대(N건 선택 · 항목 · 값 · 일괄 수정 · 선택 삭제)
       칸 두 번 눌러 고치고(Enter 아래 · Tab 옆 · Esc 취소) 고친 칸은 노란 테두리 → Ctrl+S 한꺼번에 저장
   확인창(alert/confirm)은 쓰지 않는다. 되돌릴 수 없는 일은 버튼을 두 번 눌러야 실행된다. */
(function(){
  'use strict';
  if(window.ERPG) return;
  var CSS = [
    'table.eg thead th{position:sticky;top:0;z-index:4}',
    'table.eg th.eg-th{cursor:pointer;user-select:none}',
    'table.eg th.eg-th[data-sort]::after{content:attr(data-sort);font-size:9px;margin-left:4px;color:var(--accent,var(--ac,#1d4ed8))}',
    '.eg-rz{position:absolute;top:0;right:-3px;width:7px;height:100%;cursor:col-resize;z-index:5}',
    'table.eg tr.eg-fr th{padding:2px 3px!important;background:var(--grid-head,var(--panel-card,#f7f8fa))!important;z-index:4}',
    '.eg-f{display:block;width:100%;min-width:36px;height:22px;padding:1px 5px;font:inherit;font-size:11.5px;font-weight:400;border:1px solid var(--border,var(--ln,#d0d5dd));border-radius:0;background:var(--panel,var(--bg,#fff));color:inherit;box-sizing:border-box}',
    '.eg-f.on{border-color:var(--accent,var(--ac,#1d4ed8));background:var(--accent-light,var(--ac2,#e8eefc))}',
    'table.eg th:first-child,table.eg td:first-child{position:sticky;left:0;z-index:2;background:var(--panel,var(--bg,#fff))}',
    'table.eg thead th:first-child{z-index:6;background:var(--grid-head,var(--panel-card,#f3f5f8))}',
    'table.eg.eg-sel th:nth-child(2),table.eg.eg-sel td:nth-child(2){position:sticky;left:28px;z-index:2;background:var(--panel,var(--bg,#fff))}',
    'table.eg.eg-sel thead th:nth-child(2){z-index:6;background:var(--grid-head,var(--panel-card,#f3f5f8))}',
    'table.eg th.eg-ck,table.eg td.eg-ck{width:28px;min-width:28px;max-width:28px;padding:0 4px!important;text-align:center;cursor:default}',
    'table.eg .eg-ck input{margin:0;cursor:pointer;vertical-align:middle}',
    'table.eg tr.eg-on td,table.eg tr.eg-on td:first-child,table.eg.eg-sel tr.eg-on td:nth-child(2){background:var(--row-sel,var(--rs,#e8eefc))}',
    'table.eg tr.eg-hide{display:none}',
    'table.eg td.eg-dirty{box-shadow:inset 0 0 0 2px #d97706;background:#fff7e6}',
    ':root[data-theme="dark"] table.eg td.eg-dirty{background:rgba(217,119,6,.18)}',
    'table.eg td.eg-edit{padding:0!important}',
    'table.eg td.eg-edit input,table.eg td.eg-edit select{display:block;width:100%;min-width:70px;height:100%;min-height:26px;box-sizing:border-box;border:2px solid var(--accent,var(--ac,#1d4ed8));border-radius:0;padding:2px 6px;font:inherit;background:var(--panel,#fff);color:inherit}',
    'table.eg td.eg-edit input.bad{border-color:#b42318}',
    'table.eg tr.eg-sum td{font-weight:700;border-top:2px solid var(--border,var(--ln,#d0d5dd));background:var(--panel-card,var(--panel,#f7f8fa));font-variant-numeric:tabular-nums;white-space:nowrap}',
    'table.eg.eg-fon tfoot tr:not(.eg-sum){display:none}',
    '.eg-bar{display:none;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 10px;margin:0 0 6px;border:1px solid var(--accent,var(--ac,#1d4ed8));background:var(--accent-light,var(--ac2,#e8eefc));border-radius:6px;font-size:12.5px}',
    '.eg-bar.on{display:flex}',
    '.eg-bar b{font-variant-numeric:tabular-nums}',
    '.eg-bar select,.eg-bar input{height:26px;font:inherit;font-size:12.5px;padding:0 6px;border:1px solid var(--border,var(--ln,#d0d5dd));border-radius:4px;background:var(--panel,#fff);color:inherit}',
    '.eg-bar button{height:26px;font:inherit;font-size:12px;padding:0 10px;border-radius:4px;border:1px solid var(--border,var(--ln,#d0d5dd));background:var(--panel,#fff);color:inherit;cursor:pointer}',
    '.eg-bar button.pri{background:var(--accent,var(--ac,#1d4ed8));border-color:var(--accent,var(--ac,#1d4ed8));color:#fff}',
    '.eg-bar button.armed,.eg-bar button.del.armed{background:#b42318;border-color:#b42318;color:#fff}',
    '.eg-bar .eg-sp{flex:1}',
    '.eg-bar .eg-dm{color:#b45309;font-weight:600}',
    '.eg-toast{position:fixed;left:50%;bottom:48px;transform:translateX(-50%);background:#1f2937;color:#fff;padding:8px 16px;border-radius:6px;font-size:13px;z-index:9999}',
    '@media print{.eg-bar,tr.eg-fr,.eg-rz,.eg-ck{display:none!important}table.eg th.eg-th[data-sort]::after{content:""}table.eg th,table.eg td{position:static!important}table.eg td.eg-dirty{box-shadow:none}}'
  ].join('\n');
  function css(){ if(document.getElementById('erpg-css')) return; var s = document.createElement('style'); s.id = 'erpg-css'; s.textContent = CSS; document.head.appendChild(s); }

  var NUMRE = /^[-+]?[\d,]+(\.\d+)?$/;
  function num(s){ s = String(s == null ? '' : s).replace(/[원%\s]/g, ''); if(!NUMRE.test(s)) return null; var n = Number(s.replace(/,/g, '')); return isFinite(n) ? n : null; }
  function txt(c){ return c ? String(c.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function empty(s){ return s === '' || s === '-' || s === '–'; }
  function cmp(a, b){
    var ea = empty(a), eb = empty(b); if(ea || eb) return ea && eb ? 0 : (ea ? 1 : -1);
    var na = num(a), nb = num(b); if(na !== null && nb !== null) return na - nb;
    return a.localeCompare(b, 'ko');
  }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtN(n){ return Number(n).toLocaleString('ko-KR'); }
  function toast(m){
    var a = ERPG.adapter; if(a && a.toast){ try { a.toast(m); return; } catch(e){} }
    var d = document.createElement('div'); d.className = 'eg-toast'; d.textContent = m; document.body.appendChild(d); setTimeout(function(){ d.remove(); }, 2400);
  }
  /* 필터 한 칸: 여러 낱말은 모두 맞아야, !낱말은 제외, >·<·>=·<=·= 숫자 비교 */
  function match(v, q){
    var lv = v.toLowerCase();
    return q.split(/\s+/).every(function(w){
      if(!w) return true;
      var neg = w.charAt(0) === '!'; if(neg) w = w.slice(1); if(!w) return true;
      var m = /^(>=|<=|>|<|=)(-?[\d,.]+)$/.exec(w), ok;
      if(m){ var n = num(v), x = Number(m[2].replace(/,/g, '')); ok = n !== null && (m[1] === '>' ? n > x : m[1] === '<' ? n < x : m[1] === '>=' ? n >= x : m[1] === '<=' ? n <= x : n === x); }
      else ok = lv.indexOf(w.toLowerCase()) >= 0;
      return neg ? !ok : ok;
    });
  }

  function S(t){ return t._eg; }
  function headRow(t){ var rs = Array.prototype.filter.call(t.tHead.rows, function(r){ return !r.classList.contains('eg-fr'); }); return rs[rs.length - 1]; }
  function off(t){ return S(t).sel ? 1 : 0; }
  function nCols(t){ return S(t).n; }
  function isData(t, r){
    if(r.classList.contains('eg-sum')) return false;
    var c = r.cells, o = r.cells[0] && r.cells[0].classList.contains('eg-ck') ? 1 : 0;
    if(c.length - o !== nCols(t)) return false;
    for(var i = 0; i < c.length; i++) if(c[i].colSpan > 1) return false;
    return true;
  }
  function dataRows(t){
    var out = []; Array.prototype.forEach.call(t.tBodies, function(b){ Array.prototype.forEach.call(b.rows, function(r){ if(isData(t, r)) out.push(r); }); });
    return out;
  }
  function cell(t, r, ci){ return r.cells[ci + (r.cells[0] && r.cells[0].classList.contains('eg-ck') ? 1 : 0)]; }
  function recOf(t, r){
    var a = ERPG.adapter; if(!a || !a.rec) return null;
    if(r._egr === undefined){ try { r._egr = a.rec(r) || null; } catch(e){ r._egr = null; } }
    return r._egr;
  }
  function keyOf(x){ var a = ERPG.adapter; try { return a.key(x.kind, x.rec); } catch(e){ return null; } }
  function label(th){ return txt(th).replace(/[▲▼]/g, '').trim(); }
  function fieldAt(t, r, ci){
    var x = recOf(t, r), a = ERPG.adapter; if(!x || !a || !a.field) return null;
    var th = headRow(t).cells[ci + off(t)]; if(!th) return null;
    var f = a.field(x.kind, label(th)); if(!f || f.lock) return null;
    if(a.locked){ var lk = a.locked(x.kind, x.rec) || []; if(lk.indexOf(f.k) >= 0) return null; }
    return f;
  }

  function quiet(t, fn){ var s = S(t); s.busy++; try { fn(); } finally { s.busy--; if(s.mo) s.mo.takeRecords(); } }

  /* 처음 한 번: 머리칸 정렬·너비 손잡이·필터줄 */
  function init(t){
    var hr = headRow(t); var s = t._eg = { n: hr.cells.length, sort: null, f: {}, sel: null, picked: {}, dirty: {}, busy: 0, last: null, mo: null, bar: null };
    t.classList.add('eg'); t.dataset.eg = '1';
    Array.prototype.forEach.call(hr.cells, function(th, i){ bindHead(t, th, i); });
    var fr = document.createElement('tr'); fr.className = 'eg-fr';
    for(var i = 0; i < s.n; i++){
      var th = document.createElement('th'), inp = document.createElement('input');
      inp.className = 'eg-f'; inp.dataset.ci = i; inp.autocomplete = 'off'; inp.title = '글자 포함 · 여러 낱말 = 모두 포함 · !글자 = 제외 · >1000 · <0 · =0';
      inp.addEventListener('input', function(e){ var ci = +e.target.dataset.ci, v = e.target.value.trim(); if(v) s.f[ci] = v; else delete s.f[ci]; e.target.classList.toggle('on', !!v); apply(t); });
      inp.addEventListener('click', function(e){ e.stopPropagation(); });
      inp.addEventListener('keydown', function(e){ if(e.key === 'Escape' && e.target.value){ e.preventDefault(); e.stopPropagation(); e.target.value = ''; e.target.dispatchEvent(new Event('input')); } });
      th.appendChild(inp); fr.appendChild(th);
    }
    t.tHead.appendChild(fr);
    t.addEventListener('click', onClick, true);
    t.addEventListener('dblclick', onDbl);
    t.addEventListener('keydown', onEditKey);
    s.mo = new MutationObserver(function(){ if(!s.busy) apply(t); });
    observe(t);
    apply(t);
  }
  function observe(t){
    var s = S(t); s.mo.disconnect();
    s.mo.observe(t, { childList: true });
    Array.prototype.forEach.call(t.tBodies, function(b){ s.mo.observe(b, { childList: true }); });
    if(t.tFoot) s.mo.observe(t.tFoot, { childList: true });
  }
  function bindHead(t, th, i){
    th.dataset.egc = i;
    if(t.hasAttribute('data-eg-lite')){ if(getComputedStyle(th).position === 'static') th.style.position = 'sticky'; return; }
    th.classList.add('eg-th');
    if(getComputedStyle(th).position === 'static') th.style.position = 'sticky';
    th.addEventListener('click', function(e){
      if(e.target.classList.contains('eg-rz') || e.target.closest('.eg-ck')) return;
      var s = S(t), ci = +th.dataset.egc;
      s.sort = !s.sort || s.sort.ci !== ci ? { ci: ci, d: 1 } : (s.sort.d > 0 ? { ci: ci, d: -1 } : null);
      apply(t);
    });
    var h = document.createElement('span'); h.className = 'eg-rz'; th.appendChild(h);
    h.addEventListener('click', function(e){ e.stopPropagation(); });
    h.addEventListener('mousedown', function(e){
      e.preventDefault(); e.stopPropagation(); var x0 = e.clientX, w0 = th.offsetWidth;
      function mv(ev){ var w = Math.max(40, w0 + ev.clientX - x0) + 'px'; th.style.width = th.style.minWidth = th.style.maxWidth = w; }
      function up(){ document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
  }

  /* 선택 열: 줄이 기록과 이어지는 표만(어댑터가 rec을 돌려줄 때) 처음 한 번 켠다 */
  function enableSel(t){
    var s = S(t); s.sel = true; t.classList.add('eg-sel');
    Array.prototype.forEach.call(t.tHead.rows, function(r, ri){
      var th = document.createElement('th'); th.className = 'eg-ck';
      if(r === headRow(t)){ th.innerHTML = '<input type="checkbox" title="보이는 줄 전체 선택">'; th.firstChild.addEventListener('click', function(e){ e.stopPropagation(); pickAll(t, e.target.checked); }); }
      if(r.cells[0] && r.cells[0].rowSpan > 1 && ri === 0) th.rowSpan = r.cells[0].rowSpan;
      r.insertBefore(th, r.cells[0] || null);
    });
    bar(t);
  }
  function ckRow(t, r){
    var s = S(t), x = recOf(t, r); if(!x) return;
    var k = keyOf(x); r._egk = k;
    var td = r.cells[0] && r.cells[0].classList.contains('eg-ck') ? r.cells[0] : null;
    if(!td){ td = document.createElement('td'); td.className = 'eg-ck'; td.innerHTML = '<input type="checkbox">'; r.insertBefore(td, r.cells[0]); }
    var on = !!s.picked[k]; td.firstChild.checked = on; r.classList.toggle('eg-on', on);
    if(on) s.picked[k] = x;
  }
  function padRow(r){ if(r.dataset.egp) return; r.dataset.egp = '1'; var c = r.cells[0]; if(!c) return; if(c.colSpan > 1 || r.cells.length === 1) c.colSpan = c.colSpan + 1; else { var td = document.createElement(c.tagName); td.className = 'eg-ck'; r.insertBefore(td, c); } }

  /* tbody가 새로 그려질 때마다: 선택칸 · 정렬 · 필터 · 합계 · 고친 칸 표시 */
  function apply(t){
    var s = S(t); if(!s) return;
    quiet(t, function(){
      var rows = dataRows(t);
      if(!s.sel && rows.length && recOf(t, rows[0])) enableSel(t);
      rows.forEach(function(r, i){ if(r._egi === undefined) r._egi = i; });
      if(s.sel){
        rows.forEach(function(r){ ckRow(t, r); });
        Array.prototype.forEach.call(t.tBodies, function(b){ Array.prototype.forEach.call(b.rows, function(r){ if(!isData(t, r) && !r.classList.contains('eg-sum')) padRow(r); }); });
        if(t.tFoot) Array.prototype.forEach.call(t.tFoot.rows, function(r){ if(!r.classList.contains('eg-sum')) padRow(r); });
      }
      var hr = headRow(t);
      Array.prototype.forEach.call(hr.cells, function(th){ if(th.dataset.egc != null) th.removeAttribute('data-sort'); });
      if(rows.length > 1){
        var b = rows[0].parentNode, order = rows.slice();
        if(s.sort){
          var ci = s.sort.ci, d = s.sort.d, th = hr.cells[ci + off(t)]; if(th) th.setAttribute('data-sort', d > 0 ? '▲' : '▼');
          order.forEach(function(r){ r._egv = txt(cell(t, r, ci)); });
          order.sort(function(x, y){ return (cmp(x._egv, y._egv) * d) || (x._egi - y._egi); });
        } else order.sort(function(x, y){ return x._egi - y._egi; });
        var same = order.every(function(r, i){ return r === rows[i]; });
        if(!same && order.every(function(r){ return r.parentNode === b; })) order.forEach(function(r){ b.appendChild(r); });
      }
      var fk = Object.keys(s.f), shown = 0;
      rows.forEach(function(r){
        var ok = fk.every(function(ci){ return match(txt(cell(t, r, +ci)), s.f[ci]); });
        r.classList.toggle('eg-hide', !ok); if(ok) shown++;
      });
      sumRow(t, rows, fk.length > 0, shown);
      paintDirty(t, rows);
      tops(t);
      if(s.sel){ var hc = hr.cells[0] && hr.cells[0].querySelector('input'); if(hc){ var vis = rows.filter(function(r){ return !r.classList.contains('eg-hide'); }); var n = vis.filter(function(r){ return r._egk && s.picked[r._egk]; }).length; hc.checked = vis.length > 0 && n === vis.length; hc.indeterminate = n > 0 && n < vis.length; } }
      s.shown = shown; s.total = rows.length;
      observe(t);
    });
    barPaint(t);
    t.dispatchEvent(new CustomEvent('eg:change', { bubbles: true, detail: { shown: s.shown, total: s.total } }));
  }
  function tops(t){ var fr = t.tHead.querySelector('tr.eg-fr'), h = headRow(t).offsetHeight; if(!fr || !h) return; Array.prototype.forEach.call(fr.cells, function(c){ if(c.style.top !== h + 'px') c.style.top = h + 'px'; }); }
  function numCol(t, rows, ci){
    var th = headRow(t).cells[ci + off(t)];
    if(th && /잔액|단가|요율|비율|율$|%|번호|코드/.test(label(th))) return false;
    if(th && (getComputedStyle(th).textAlign === 'right' || th.style.textAlign === 'right')) return true;
    var r = rows.filter(function(x){ return !x.classList.contains('eg-hide') && !empty(txt(cell(t, x, ci))); })[0]; if(!r) return false;
    var c = cell(t, r, ci); return num(txt(c)) !== null && (/(^|\s)(num|amt[\w-]*)(\s|$)/.test(c.className) || getComputedStyle(c).textAlign === 'right');
  }
  function sumRow(t, rows, on, shown){
    var old = t.querySelector('tr.eg-sum'); if(old) old.remove();
    if(t.hasAttribute('data-eg-lite')) on = false;
    t.classList.toggle('eg-fon', on); if(!on) return;
    var tf = t.tFoot || t.createTFoot(), tr = document.createElement('tr'); tr.className = 'eg-sum';
    var html = S(t).sel ? '<td class="eg-ck"></td>' : '';
    for(var ci = 0; ci < nCols(t); ci++){
      if(ci === 0){ html += '<td>필터 ' + fmtN(shown) + '건</td>'; continue; }
      if(!numCol(t, rows, ci)){ html += '<td></td>'; continue; }
      var sum = 0; rows.forEach(function(r){ if(r.classList.contains('eg-hide')) return; var n = num(txt(cell(t, r, ci))); if(n !== null) sum += n; });
      html += '<td style="text-align:right">' + fmtN(Math.round(sum * 100) / 100) + '</td>';
    }
    tr.innerHTML = html; tf.appendChild(tr);
  }

  /* ── 선택 ── */
  function pick(t, r, on){ var s = S(t), x = recOf(t, r); if(!x || !r._egk) return; if(on) s.picked[r._egk] = x; else delete s.picked[r._egk]; r.classList.toggle('eg-on', on); var c = r.cells[0].querySelector('input'); if(c) c.checked = on; }
  function pickAll(t, on){ dataRows(t).forEach(function(r){ if(!r.classList.contains('eg-hide')) pick(t, r, on); }); apply(t); }
  function nPicked(t){ return Object.keys(S(t).picked).length; }
  function nDirty(t){ var d = S(t).dirty, n = 0; Object.keys(d).forEach(function(k){ n += Object.keys(d[k].patch).length; }); return n; }

  var clickT = null;
  function onClick(e){
    var t = e.currentTarget, s = S(t), td = e.target.closest('td'); if(!td || !t.contains(td)) return;
    var r = td.parentNode; if(!isData(t, r)) return;
    if(td.classList.contains('eg-ck')){
      e.stopPropagation();
      var on = e.target.tagName === 'INPUT' ? e.target.checked : !s.picked[r._egk];
      if(e.shiftKey && s.last){ var rows = dataRows(t).filter(function(x){ return !x.classList.contains('eg-hide'); }), a = rows.indexOf(s.last), b = rows.indexOf(r); if(a >= 0 && b >= 0){ rows.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(function(x){ pick(t, x, on); }); } }
      else pick(t, r, on);
      s.last = r; apply(t); return;
    }
    if(td.classList.contains('eg-edit') || e.target.closest('input,select,textarea,button,a')) { if(td.classList.contains('eg-edit')) e.stopPropagation(); return; }
    /* 고칠 수 있는 칸: 한 번 = (잠시 뒤) 원래 동작, 두 번 = 칸 수정 */
    if(!fieldAt(t, r, td.cellIndex - off(t))) return;
    if(!r.onclick && !r.getAttribute('onclick')) return;
    if(e.isTrusted === false && e.target === r) return;
    e.stopPropagation();
    if(clickT){ clearTimeout(clickT); clickT = null; return; }
    clickT = setTimeout(function(){ clickT = null; if(r.isConnected && !td.classList.contains('eg-edit')) r.click(); }, 240);
  }
  function onDbl(e){
    var t = e.currentTarget, td = e.target.closest('td'); if(!td || td.classList.contains('eg-ck') || td.classList.contains('eg-edit')) return;
    if(clickT){ clearTimeout(clickT); clickT = null; }
    edit(t, td);
  }

  /* ── 칸 수정 ── */
  function edit(t, td){
    var r = td.parentNode; if(!isData(t, r)) return false;
    var ci = td.cellIndex - off(t), f = fieldAt(t, r, ci), x = recOf(t, r); if(!f || !x) return false;
    var s = S(t), k = r._egk || keyOf(x), d = s.dirty[k], cur = d && f.k in d.patch ? d.patch[f.k] : x.rec[f.k];
    if(td._egH === undefined) td._egH = td.innerHTML;
    var inp;
    if(f.opts){ inp = document.createElement('select'); inp.innerHTML = f.opts.map(function(o){ return '<option value="' + esc(o) + '"' + (String(cur == null ? '' : cur) === String(o) ? ' selected' : '') + '>' + esc(optLabel(o)) + '</option>'; }).join(''); }
    else { inp = document.createElement('input'); inp.type = f.t === 'date' ? 'date' : 'text'; inp.value = cur == null ? '' : (f.t === 'number' && cur !== '' ? fmtN(cur) : cur); if(f.t === 'number'){ inp.inputMode = 'decimal'; inp.style.textAlign = 'right'; } }
    quiet(t, function(){ td.classList.add('eg-edit'); td.innerHTML = ''; td.appendChild(inp); });
    inp._eg = { t: t, td: td, r: r, f: f, x: x, k: k, ci: ci };
    inp.addEventListener('blur', function(){ if(inp._eg) commit(inp, true); });
    inp.focus(); if(inp.select) try { inp.select(); } catch(er){}
    return true;
  }
  function optLabel(o){ return o === 'true' ? '예' : o === 'false' ? '아니오' : (o === '' ? '(비움)' : o); }
  function same(a, b){ return String(a == null ? '' : a) === String(b == null ? '' : b); }
  function commit(inp, keep){
    var g = inp._eg, t = g.t, s = S(t), v = inp.value.trim();
    if(g.f.t === 'number' && v !== ''){ var n = Number(v.replace(/,/g, '')); if(!isFinite(n)){ inp.classList.add('bad'); if(keep) toast(g.f.l + ' — 숫자를 넣어 주세요'); return false; } v = n; }
    if(g.f.req && v === ''){ inp.classList.add('bad'); toast(g.f.l + ' — 비울 수 없습니다'); return false; }
    inp._eg = null;
    var d = s.dirty[g.k];
    if(same(v, g.x.rec[g.f.k])){ if(d){ delete d.patch[g.f.k]; if(!Object.keys(d.patch).length) delete s.dirty[g.k]; } }
    else { d = s.dirty[g.k] = d || { kind: g.x.kind, rec: g.x.rec, patch: {} }; d.patch[g.f.k] = v; }
    quiet(t, function(){ g.td.classList.remove('eg-edit'); g.td.innerHTML = g.td._egH; paintCell(t, g.td, g.f, s.dirty[g.k]); });
    barPaint(t);
    return true;
  }
  function cancel(inp){ var g = inp._eg; inp._eg = null; quiet(g.t, function(){ g.td.classList.remove('eg-edit'); g.td.innerHTML = g.td._egH; paintCell(g.t, g.td, g.f, S(g.t).dirty[g.k]); }); }
  function show(f, v){
    var a = ERPG.adapter; if(a && a.show){ try { var z = a.show(f, v); if(z != null) return z; } catch(e){} }
    if(v == null || v === '') return '-';
    if(f.t === 'number') return fmtN(v);
    return optLabel(String(v));
  }
  function paintCell(t, td, f, d){
    var on = !!(d && f.k in d.patch);
    if(on){ if(td._egH === undefined) td._egH = td.innerHTML; td.textContent = show(f, d.patch[f.k]); }
    else if(td._egH !== undefined){ td.innerHTML = td._egH; }
    td.classList.toggle('eg-dirty', on);
    td.title = on ? '저장 전 — Ctrl+S' : '';
  }
  function paintDirty(t, rows){
    var s = S(t); if(!Object.keys(s.dirty).length) return;
    rows.forEach(function(r){
      var d = r._egk && s.dirty[r._egk]; if(!d) return;
      for(var ci = 0; ci < nCols(t); ci++){ var f = fieldAt(t, r, ci); if(f && f.k in d.patch) paintCell(t, cell(t, r, ci), f, d); }
    });
  }
  function onEditKey(e){
    var inp = e.target; if(!inp || !inp._eg) return;
    if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); cancel(inp); return; }
    if(e.key === 'Enter' || e.key === 'Tab'){
      if(e.isComposing) return;
      e.preventDefault(); e.stopPropagation();
      var g = inp._eg; if(!commit(inp, false)) return;
      var t = g.t, rows = dataRows(t).filter(function(x){ return !x.classList.contains('eg-hide'); }), ri = rows.indexOf(g.r);
      if(e.key === 'Enter'){ for(var i = ri + (e.shiftKey ? -1 : 1); i >= 0 && i < rows.length; i += e.shiftKey ? -1 : 1){ if(edit(t, cell(t, rows[i], g.ci))) return; } }
      else { var step = e.shiftKey ? -1 : 1; for(var c = g.ci + step; c >= 0 && c < nCols(t); c += step){ if(edit(t, cell(t, g.r, c))) return; } }
    }
  }

  /* ── 선택 막대 ── */
  function bar(t){
    var s = S(t); if(s.bar) return s.bar;
    var b = s.bar = document.createElement('div'); b.className = 'eg-bar';
    var wrap = t.closest('.table-wrap') || t; wrap.parentNode.insertBefore(b, wrap);
    b.addEventListener('click', function(e){ var a = e.target.closest('[data-a]'); if(!a) return; var k = a.dataset.a;
      if(k === 'clear'){ s.picked = {}; apply(t); }
      else if(k === 'bulk') bulk(t, a);
      else if(k === 'del') del(t, a);
      else if(k === 'save') save(t);
      else if(k === 'undo'){ s.dirty = {}; dataRows(t).forEach(function(r){ Array.prototype.forEach.call(r.cells, function(c){ if(c.classList.contains('eg-dirty')){ c.classList.remove('eg-dirty'); c.title = ''; if(c._egH !== undefined) c.innerHTML = c._egH; } }); }); barPaint(t); }
    });
    b.addEventListener('change', function(e){ if(e.target.dataset.a === 'fld') valBox(t); });
    return b;
  }
  function kindOf(t){ var ks = {}; Object.keys(S(t).picked).forEach(function(k){ ks[S(t).picked[k].kind] = 1; }); ks = Object.keys(ks); return ks.length === 1 ? ks[0] : null; }
  function bulkFields(t){ var a = ERPG.adapter, k = kindOf(t); if(!k || !a || !a.fields) return []; try { return (a.fields(k) || []).filter(function(f){ return !f.lock; }); } catch(e){ return []; } }
  function barPaint(t){
    var s = S(t), b = s.bar; if(!b) { fire(t); return; }
    var np = nPicked(t), nd = nDirty(t);
    b.classList.toggle('on', np > 0 || nd > 0);
    var key = np + '|' + nd + '|' + kindOf(t);
    if(b.dataset.k === key){ fire(t); return; } b.dataset.k = key;
    var h = '';
    if(np){
      var fs = bulkFields(t), a = ERPG.adapter, k = kindOf(t), rl = a && a.removeLabel ? a.removeLabel(k) : null;
      h += '<span><b>' + fmtN(np) + '</b>건 선택</span>';
      if(fs.length){ h += '<select data-a="fld" title="바꿀 항목">' + fs.map(function(f){ return '<option value="' + esc(f.k) + '">' + esc(f.l) + '</option>'; }).join('') + '</select><span class="eg-val"></span><button class="pri" data-a="bulk">일괄 수정</button>'; }
      else if(!k) h += '<span class="muted">서로 다른 종류가 섞여 일괄 수정 불가</span>';
      if(rl) h += '<button class="del" data-a="del">선택 ' + esc(rl) + '</button>';
      h += '<button data-a="clear">선택 해제</button>';
    }
    h += '<span class="eg-sp"></span>';
    if(nd) h += '<span class="eg-dm">고친 칸 ' + fmtN(nd) + '개 · 저장 전</span><button class="pri" data-a="save">저장 (Ctrl+S)</button><button data-a="undo">되돌리기</button>';
    b.innerHTML = h;
    if(np) valBox(t);
    fire(t);
  }
  function fire(t){ t.dispatchEvent(new CustomEvent('eg:state', { bubbles: true, detail: { picked: nPicked(t), dirty: nDirty(t) } })); }
  function valBox(t){
    var b = S(t).bar, sel = b.querySelector('[data-a="fld"]'), box = b.querySelector('.eg-val'); if(!sel || !box) return;
    var f = bulkFields(t).filter(function(x){ return x.k === sel.value; })[0]; if(!f) return;
    if(f.opts) box.innerHTML = '<select data-v title="값">' + f.opts.map(function(o){ return '<option value="' + esc(o) + '">' + esc(optLabel(o)) + '</option>'; }).join('') + '</select>';
    else box.innerHTML = '<input data-v type="' + (f.t === 'date' ? 'date' : 'text') + '" placeholder="' + (f.t === 'number' ? '숫자 (비우면 지움)' : '값 (비우면 지움)') + '"' + (f.t === 'number' ? ' inputmode="decimal" style="text-align:right;width:130px"' : ' style="width:180px"') + '>';
  }
  function arm(btn, txt2){ if(btn.classList.contains('armed')) return true; btn.classList.add('armed'); btn.dataset.t0 = btn.textContent; btn.textContent = txt2; setTimeout(function(){ if(btn.isConnected && btn.classList.contains('armed')){ btn.classList.remove('armed'); btn.textContent = btn.dataset.t0; } }, 4000); return false; }
  async function bulk(t, btn){
    var s = S(t), b = s.bar, fk = b.querySelector('[data-a="fld"]').value, f = bulkFields(t).filter(function(x){ return x.k === fk; })[0], vi = b.querySelector('[data-v]'); if(!f || !vi) return;
    var v = vi.value.trim();
    if(f.t === 'number' && v !== ''){ v = Number(v.replace(/,/g, '')); if(!isFinite(v)){ toast(f.l + ' — 숫자를 넣어 주세요'); return; } }
    if(f.req && v === ''){ toast(f.l + ' — 비울 수 없습니다'); return; }
    var list = Object.keys(s.picked).map(function(k){ var x = s.picked[k], p = {}; p[f.k] = v; return { kind: x.kind, rec: x.rec, patch: p }; });
    if(!arm(btn, fmtN(list.length) + '건 「' + f.l + '」 → ' + (v === '' ? '(비움)' : show(f, v)) + ' — 한 번 더')) return;
    await run(t, 'save', list, btn);
  }
  async function del(t, btn){
    var s = S(t), a = ERPG.adapter, k = kindOf(t), rl = (a.removeLabel && a.removeLabel(k)) || '삭제';
    var list = Object.keys(s.picked).map(function(key){ return s.picked[key]; });
    if(!arm(btn, fmtN(list.length) + '건 ' + rl + ' — 한 번 더 누르면 실행')) return;
    await run(t, 'remove', list, btn);
  }
  async function save(t){
    var s = S(t), a = document.activeElement; if(a && a._eg && !commit(a, true)) return;
    var list = Object.keys(s.dirty).map(function(k){ return s.dirty[k]; }); if(!list.length) return;
    await run(t, 'save', list, null);
  }
  async function run(t, op, list, btn){
    var a = ERPG.adapter, s = S(t); if(!a || !a[op]) return;
    if(s.running) return; s.running = true;
    var bs = s.bar ? s.bar.querySelectorAll('button') : []; Array.prototype.forEach.call(bs, function(x){ x.disabled = true; });
    var res;
    try { res = await a[op](list); } catch(e){ res = { ok: 0, fail: [{ msg: (e && e.message) || String(e) }] }; }
    s.running = false;
    res = res || { ok: 0, fail: [] };
    var fail = res.fail || [];
    if(op === 'save'){
      /* 성공한 줄만 고친 칸 목록에서 뺀다 */
      var bad = {}; fail.forEach(function(f){ if(f.item) bad[keyOf({ kind: f.item.kind, rec: f.item.rec })] = 1; });
      Object.keys(s.dirty).forEach(function(k){ if(!bad[k] && list.indexOf(s.dirty[k]) >= 0) delete s.dirty[k]; });
    }
    if(!fail.length) s.picked = {};
    toast((op === 'remove' ? '처리 ' : '저장 ') + fmtN(res.ok || 0) + '건' + (fail.length ? ' · 실패 ' + fail.length + '건: ' + fail[0].msg : ''));
    if(s.bar) s.bar.dataset.k = '';
    try { if(a.reload && res.ok) await a.reload(list.map(function(x){ return x.kind; }).filter(function(k, i, arr){ return arr.indexOf(k) === i; })); } catch(e){}
    apply(t);
  }

  /* Ctrl+S: 보이는 표 가운데 고친 칸이 있는 표를 저장 */
  window.addEventListener('keydown', function(e){
    if(!(e.ctrlKey || e.metaKey) || e.altKey || String(e.key).toLowerCase() !== 's') return;
    var t = ERPG.dirtyTable(); if(!t) return;
    e.preventDefault(); e.stopImmediatePropagation(); save(t);
  }, true);

  var ERPG = window.ERPG = {
    version: '1.00',
    adapter: null,
    /* 표 하나에 기능을 얹는다 (여러 번 불러도 한 번만) */
    enhance: function(t){
      if(!t || t._eg || !t.tHead || !t.tBodies.length) return;
      if(t.dataset.eg === 'off' || t.closest('[data-eg="off"]')) return;
      var hr = headRow(t); if(!hr || !hr.cells.length) return;
      for(var i = 0; i < hr.cells.length; i++) if(hr.cells[i].colSpan > 1) return;
      css(); init(t);
    },
    /* root 안의 .table-wrap 표를 모두 */
    auto: function(root, sel){ (root || document).querySelectorAll(sel || '.table-wrap > table').forEach(function(t){ try { if(t._eg) tops(t); else ERPG.enhance(t); } catch(e){ if(window.console) console.warn('erp-grid', e); } }); },
    refresh: function(t){ if(t && t._eg) apply(t); },
    dirtyTable: function(){ var hit = null; document.querySelectorAll('table.eg').forEach(function(t){ if(!hit && t.offsetParent !== null && nDirty(t)) hit = t; }); return hit; },
    pickedTable: function(){ var hit = null; document.querySelectorAll('table.eg').forEach(function(t){ if(!hit && t.offsetParent !== null && nPicked(t)) hit = t; }); return hit; },
    save: function(t){ t = t || ERPG.dirtyTable(); if(t) return save(t); },
    /* 선택 막대의 「선택 삭제」를 누른 것과 같다 (두 번 눌러야 실행) */
    removePicked: function(t){ t = t || ERPG.pickedTable(); if(!t || !S(t).bar) return; var b = S(t).bar.querySelector('[data-a="del"]'); if(b) b.click(); },
    state: function(t){ var s = t && S(t); return s ? { picked: nPicked(t), dirty: nDirty(t), shown: s.shown, total: s.total, sort: s.sort, filter: Object.assign({}, s.f) } : null; },
    setFilter: function(t, ci, v){ var s = S(t); if(!s) return; var inp = t.tHead.querySelector('.eg-f[data-ci="' + ci + '"]'); if(inp){ inp.value = v || ''; inp.dispatchEvent(new Event('input')); } },
    sortBy: function(t, ci, d){ var s = S(t); if(!s) return; s.sort = d ? { ci: ci, d: d > 0 ? 1 : -1 } : null; apply(t); },
    /* 엑셀·인쇄용 사본: 필터줄·선택칸·숨긴 줄·고친 표시를 뺀 표 */
    clean: function(t){
      var c = t.cloneNode(true);
      c.querySelectorAll('tr.eg-fr, tr.eg-hide, .eg-ck, .eg-rz').forEach(function(x){ x.remove(); });
      if(t._eg && Object.keys(t._eg.f).length) c.querySelectorAll('tfoot tr:not(.eg-sum)').forEach(function(x){ x.remove(); });
      c.querySelectorAll('[data-sort]').forEach(function(x){ x.removeAttribute('data-sort'); });
      return c;
    },
    match: match, cmp: cmp
  };
})();
