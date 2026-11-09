(function(w) {
    "use strict";
    var PS = 1e3;
    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"'`]/g, (function(c) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
                "`": "&#96;"
            }[c];
        }));
    }
    function jsq(v) {
        return esc(JSON.stringify(String(v == null ? "" : v)));
    }
    function kstParts(d) {
        var t = new Date((d ? new Date(d) : new Date).getTime() + 9 * 3600 * 1e3);
        return {
            y: t.getUTCFullYear(),
            m: t.getUTCMonth() + 1,
            d: t.getUTCDate()
        };
    }
    function p2(n) {
        return (n < 10 ? "0" : "") + n;
    }
    function todayKst(d) {
        var k = kstParts(d);
        return k.y + "-" + p2(k.m) + "-" + p2(k.d);
    }
    function ymKst(d) {
        var k = kstParts(d);
        return k.y + "-" + p2(k.m);
    }
    function won(n) {
        if (n === null || n === undefined || n === "" || isNaN(+n)) return "–";
        return Math.round(+n).toLocaleString("ko-KR");
    }
    async function pageAll(spec) {
        var sb = spec.sb || w.sb, max = spec.max || 2e5, cols = spec.select || "*";
        var ord = (spec.order || []).slice();
        if (spec.pk && !ord.some((function(o) {
            return o[0] === spec.pk;
        }))) ord.push([ spec.pk, {
            ascending: true
        } ]);
        function q(f, withCount) {
            var x = withCount ? sb.from(spec.from).select(cols, {
                count: "exact"
            }) : sb.from(spec.from).select(cols);
            if (spec.filter) x = spec.filter(x);
            ord.forEach((function(o) {
                x = x.order(o[0], o[1] || {
                    ascending: true
                });
            }));
            return x.range(f, f + PS - 1);
        }
        var r0 = await q(0, true);
        if (r0.error) throw r0.error;
        var out = (r0.data || []).slice(), n = typeof r0.count === "number" ? Math.min(r0.count, max) : null;
        if (out.length < PS) return out;
        if ((spec.pk || spec.unique) && n !== null) {
            var starts = [];
            for (var s = PS; s < n; s += PS) starts.push(s);
            for (var i = 0; i < starts.length; i += 4) {
                var rs = await Promise.all(starts.slice(i, i + 4).map((function(st) {
                    return q(st);
                })));
                for (var k = 0; k < rs.length; k++) {
                    if (rs[k].error) throw rs[k].error;
                    out = out.concat(rs[k].data || []);
                }
            }
        } else {
            for (var f = PS; out.length < max; f += PS) {
                var r = await q(f);
                if (r.error) throw r.error;
                var d = r.data || [];
                out = out.concat(d);
                if (d.length < PS) break;
            }
        }
        if (n !== null && r0.count <= max && out.length !== n) {
            var e = new Error((spec.label || spec.from) + " 건수 불일치 " + out.length.toLocaleString() + "/" + n.toLocaleString() + " — 조회를 다시 눌러 주세요");
            e.code = "ERPC_COUNT_MISMATCH";
            throw e;
        }
        return out;
    }
    async function pageAllMk(mk, opt) {
        opt = opt || {};
        var max = opt.max || 2e5, out = [];
        for (var f = 0; out.length < max; f += PS) {
            var r = await mk().range(f, f + PS - 1);
            if (r.error) throw r.error;
            var d = r.data || [];
            out = out.concat(d);
            if (d.length < PS) break;
        }
        return out;
    }
    var FETCH_MS = 45e3;
    var NOBODY = {
        101: 1,
        204: 1,
        205: 1,
        304: 1
    };
    var GATE_MAX = 3, gateN = 0, gateQ = [];
    function gateIn(u) {
        if (!/\/rest\/v1\//.test(u)) return Promise.resolve(false);
        if (gateN < GATE_MAX) {
            gateN++;
            return Promise.resolve(true);
        }
        return new Promise((function(z) {
            gateQ.push(z);
        }));
    }
    function gateOut(held) {
        if (!held) return;
        var nx = gateQ.shift();
        if (nx) nx(true); else gateN--;
    }
    function fetchT(input, init) {
        var tries = 0, url = String(input && input.url || input || "");
        function again() {
            return gateIn(url).then((function(held) {
                return fetch1(input, init).then((function(r) {
                    gateOut(held);
                    return r;
                }), (function(e) {
                    gateOut(held);
                    throw e;
                }));
            })).then((function(r) {
                if (tries >= 2 || !(r.status === 503 || r.status === 500 || r.status === 504)) return r;
                return r.clone().text().then((function(tx) {
                    if (!/PGRST002|schema cache|57014|statement timeout|canceling statement/i.test(tx || "")) return r;
                    tries++;
                    return new Promise((function(z) {
                        setTimeout(z, tries === 1 ? 1500 : 4e3);
                    })).then(again);
                }), (function() {
                    return r;
                }));
            }));
        }
        return again();
    }
    function fetch1(input, init) {
        init = init || {};
        if (typeof AbortController !== "function") return w.fetch(input, init);
        var ac = new AbortController, outer = init.signal, t = setTimeout((function() {
            ac.abort();
        }), FETCH_MS);
        if (outer) {
            if (outer.aborted) ac.abort(); else outer.addEventListener("abort", (function() {
                ac.abort();
            }));
        }
        var opt = {};
        for (var k in init) opt[k] = init[k];
        opt.signal = ac.signal;
        function fail(e) {
            clearTimeout(t);
            if (ac.signal.aborted && !(outer && outer.aborted)) {
                var x = new Error("timeout: 서버 응답 " + FETCH_MS / 1e3 + "초 초과");
                x.code = "ERPC_TIMEOUT";
                throw x;
            }
            throw e;
        }
        return w.fetch(input, opt).then((function(r) {
            if (NOBODY[r.status] || opt.method && String(opt.method).toUpperCase() === "HEAD") {
                clearTimeout(t);
                return r;
            }
            return r.arrayBuffer().then((function(buf) {
                clearTimeout(t);
                return new Response(buf, {
                    status: r.status,
                    statusText: r.statusText,
                    headers: r.headers
                });
            }));
        })).catch(fail);
    }
    async function pageAllR(spec) {
        try {
            return {
                data: await pageAll(spec),
                error: null
            };
        } catch (e) {
            return {
                data: null,
                error: e
            };
        }
    }
    function errText(e) {
        if (!e) return "";
        var m = e.message || e.error_description || e.hint || String(e);
        if (/JWT|jwt expired|invalid claim/i.test(m)) return "로그인이 만료되었습니다. 다시 로그인해 주세요";
        if (/Failed to fetch|NetworkError|network/i.test(m)) return "네트워크 연결을 확인해 주세요";
        if (/timeout|57014|canceling statement/i.test(m)) return "서버 응답이 늦습니다. 잠시 후 조회를 다시 눌러 주세요";
        if (/permission denied|42501|row-level security/i.test(m)) return "권한이 없습니다";
        return m;
    }
    var DCSS = ".erpc-bk{position:fixed;inset:0;background:rgba(15,23,42,.38);display:flex;align-items:center;justify-content:center;z-index:10000}" + ".erpc-bx{background:var(--sf,var(--panel,#fff));color:var(--tx,var(--text,#111));border:1px solid var(--ln,var(--border,#d0d5dd));border-radius:8px;min-width:320px;max-width:min(560px,92vw);box-shadow:0 12px 40px rgba(0,0,0,.25);font-size:13.5px}" + ".erpc-bx h4{margin:0;padding:14px 18px 6px;font-size:15px}.erpc-bx .m{padding:4px 18px 12px;white-space:pre-line;line-height:1.55;max-height:50vh;overflow:auto}" + ".erpc-bx input{display:block;width:calc(100% - 36px);margin:0 18px 12px;height:32px;padding:0 10px;border:1px solid var(--ln,var(--border,#d0d5dd));border-radius:4px;font:inherit;background:inherit;color:inherit;box-sizing:border-box}" + ".erpc-bx .f{display:flex;justify-content:flex-end;gap:8px;padding:10px 18px 14px;border-top:1px solid var(--ln2,var(--border,#eee))}" + ".erpc-bx button{height:32px;padding:0 16px;border-radius:4px;border:1px solid var(--ln,var(--border,#d0d5dd));background:inherit;color:inherit;font:inherit;cursor:pointer}" + ".erpc-bx button.p{background:var(--ac,var(--accent,#1d4ed8));border-color:var(--ac,var(--accent,#1d4ed8));color:#fff}.erpc-bx button.d{background:#b42318;border-color:#b42318;color:#fff}" + ".erpc-ts{position:fixed;left:50%;bottom:44px;transform:translateX(-50%);display:flex;flex-direction:column;gap:6px;align-items:center;z-index:10001;pointer-events:none}" + ".erpc-t{background:#1f2937;color:#fff;padding:8px 16px;border-radius:6px;font-size:13px;max-width:80vw;white-space:pre-line;box-shadow:0 4px 14px rgba(0,0,0,.2)}.erpc-t.e{background:#b42318}.erpc-t.g{background:#1f7a4d}.erpc-t.w{background:#92400e}";
    function dcss() {
        if (document.getElementById("erpc-css")) return;
        var s = document.createElement("style");
        s.id = "erpc-css";
        s.textContent = DCSS;
        document.head.appendChild(s);
    }
    function say(msg, kind) {
        dcss();
        var box = document.querySelector(".erpc-ts");
        if (!box) {
            box = document.createElement("div");
            box.className = "erpc-ts";
            document.body.appendChild(box);
        }
        var m = String(msg == null ? "" : msg);
        if ([].some.call(box.children, (function(x) {
            return x.textContent === m;
        }))) return;
        var t = document.createElement("div");
        t.className = "erpc-t " + (kind || "");
        t.textContent = m;
        box.appendChild(t);
        setTimeout((function() {
            t.remove();
        }), kind === "e" ? 6e3 : 3e3);
    }
    function ask(title, msg, opt) {
        opt = opt || {};
        dcss();
        return new Promise((function(res) {
            var bk = document.createElement("div");
            bk.className = "erpc-bk";
            bk.innerHTML = '<div class="erpc-bx" role="dialog" aria-modal="true"><h4></h4><div class="m"></div>' + (opt.input ? "<input>" : "") + '<div class="f">' + (opt.hideCancel ? "" : '<button class="n">취소</button>') + '<button class="' + (opt.danger ? "d" : "p") + ' y"></button></div></div>';
            bk.querySelector("h4").textContent = title || "확인";
            bk.querySelector(".m").textContent = msg || "";
            bk.querySelector(".y").textContent = opt.ok || "확인";
            var inp = bk.querySelector("input");
            if (inp) {
                inp.value = opt.value != null ? opt.value : "";
                inp.placeholder = opt.placeholder || "";
            }
            document.body.appendChild(bk);
            var prev = document.activeElement;
            function done(v) {
                document.removeEventListener("keydown", key, true);
                bk.remove();
                try {
                    if (prev && prev.focus) prev.focus();
                } catch (e) {}
                res(v);
            }
            function key(e) {
                if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    done(null);
                } else if (e.key === "Enter" && !e.isComposing && (!inp || e.target === inp || !opt.danger)) {
                    e.preventDefault();
                    e.stopPropagation();
                    ok();
                }
            }
            function ok() {
                done(inp ? inp.value.trim() || null : true);
            }
            bk.querySelector(".y").onclick = ok;
            var n = bk.querySelector(".n");
            if (n) n.onclick = function() {
                done(null);
            };
            bk.onclick = function(e) {
                if (e.target === bk) done(null);
            };
            document.addEventListener("keydown", key, true);
            setTimeout((function() {
                (inp || bk.querySelector(opt.danger ? ".n" : ".y") || bk.querySelector(".y")).focus();
            }), 30);
        }));
    }
    w.ERPC = {
        version: "1.00",
        ask: ask,
        say: say,
        esc: esc,
        jsq: jsq,
        todayKst: todayKst,
        ymKst: ymKst,
        won: won,
        pageAll: pageAll,
        pageAllMk: pageAllMk,
        pageAllR: pageAllR,
        errText: errText,
        fetchT: fetchT
    };
})(window);