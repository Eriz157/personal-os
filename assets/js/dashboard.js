/* PERSONAL OS — dashboard.js : hero, ringkasan aktivitas yang bisa di-drag, ringkasan hari ini */
(function () {
  'use strict';
  var A = window.App, DB = window.DB, U = A.U, $ = A.$, $$ = A.$$, esc = A.esc, ico = A.ico, S = A.S, PRI = A.PRI, F = A.F;
  var PCOL = { green: '#B0E5A8', yellow: '#EDE06E', red: '#F2887D', burgundy: '#7D2438' };
  var drag = null;

  /* ---------- kartu aktivitas: semua yang belum selesai ---------- */
  function items() {
    var t = U.today(), out = [];
    S.openTasks().forEach(function (k) { out.push({ kind: 'task', rec: k, date: k.date, time: k.time || '', key: k.date + 'T' + (k.time || '23:59') }); });
    DB.list('habits').forEach(function (h) { if (!h.done && h.date >= t) out.push({ kind: 'habit', rec: h, date: h.date, time: '', key: h.date + 'T12:00' }); });
    out.sort(function (a, b) { var late = function (x) { return x.date < t ? 0 : 1; }; return late(a) - late(b) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0); });
    return out;
  }
  function card(it) {
    var r = it.rec, late = it.date < U.today() && it.kind === 'task', isT = it.kind === 'task', pc, pt = '#1B1B1B', label, sub;
    if (isT) { pc = PCOL[r.priority] || PCOL.yellow; if (r.priority === 'burgundy') pt = '#fff'; label = PRI[r.priority] ? PRI[r.priority].label : 'Tugas'; sub = 'Tugas'; }
    else { pc = U.catColor(r.categoryId); label = U.catName(r.categoryId); sub = 'Habit'; }
    var when = U.rel(it.date) + (it.time ? ' · ' + it.time : '');
    return '<article class="ds-card" data-kind="' + it.kind + '" data-id="' + r.id + '"><div class="poster" style="--pc:' + pc + ';--pt:' + pt + '">' +
      U.star('#fff', 8, 24, 'p-star', 'right:-24px;bottom:-30px;width:130px;--rot:20deg;opacity:.35') +
      '<div class="p-top"><span class="daystamp' + (late ? ' late' : '') + '" title="' + esc(U.long(it.date)) + '"><b>' + U.dayName(it.date) + '</b><span>' + U.dmy(it.date) + '</span></span><span class="sticker" style="--bg:#fff;color:#1B1B1B">' + sub + ' · ' + esc(label) + '</span></div>' +
      '<h3>' + esc(r.name) + '</h3><div class="p-bot"><span class="chipx ' + (late ? 'no' : 'wait') + '" style="background:#fff;color:#1B1B1B"><i></i>' + esc(when) + '</span></div></div>' +
      '<div class="ds-meta"><div class="desc">' + esc(r.description || 'Tanpa deskripsi.') + '</div><button class="btn sm plain light" data-act="done">' + ico('check', 16) + ' Selesai</button><button class="btn sm plain ghost" data-act="edit">' + ico('edit', 16) + ' Ubah</button></div></article>';
  }

  function renderShowcase() {
    var list = items(), host = $('#ds'); if (!host) return;
    $('#dsCount').textContent = list.length ? list.length + ' aktivitas belum selesai' : 'Semua beres';
    if (!list.length) { host.querySelector('.ds-track').innerHTML = '<div class="card" style="width:min(560px,86vw)"><div class="empty" style="border:0"><b>Tidak ada aktivitas tertunda</b>Tambahkan tugas atau aktivitas baru dengan tombol di kanan.</div></div>'; }
    else host.querySelector('.ds-track').innerHTML = list.map(card).join('');
    if (drag) drag.measure();
  }

  /* ---------- mesin DRAG (pointer events, inersia, rubber-band) ---------- */
  function Drag(root) {
    var vp = $('.ds-viewport', root), track = $('.ds-track', root), bar = $('.ds-progress i', root), cnt = $('.ds-count', root), prev = $('[data-prev]', root), next = $('[data-next]', root), cur = $('.drag-cursor');
    var x = 0, min = 0, vel = 0, down = false, moved = false, sx = 0, sy = 0, lx = 0, lt = 0, raf = 0, pid = null, startX = 0, canceled = false;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function measure() { min = Math.min(0, vp.clientWidth - track.scrollWidth); set(Math.max(min, Math.min(0, x))); }
    function set(v) { x = v; track.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)'; ui(); }
    function ui() {
      var span = -min, p = span > 0 ? Math.min(1, Math.max(0, -x / span)) : 0, w = span > 0 ? vp.clientWidth / track.scrollWidth : 1;
      bar.style.width = (w * 100) + '%'; bar.style.transform = 'translateX(' + (p * (1 / w - 1) * 100) + '%)';
      var cards = $$('.ds-card', track), step = cards.length > 1 ? (cards[1].offsetLeft - cards[0].offsetLeft) : 1, i = cards.length ? Math.min(cards.length, Math.round(-x / step) + 1) : 0;
      cnt.textContent = String(Math.max(cards.length ? 1 : 0, i)).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
      prev.disabled = x >= -1; next.disabled = x <= min + 1;
    }
    function rubber(v) { if (v > 0) return v * .35; if (v < min) return min + (v - min) * .35; return v; }
    function inertia() {
      cancelAnimationFrame(raf);
      if (reduce) { set(Math.max(min, Math.min(0, x))); return; }
      (function step() {
        vel *= .94; var nx = x + vel;
        if (nx > 0 || nx < min) { var t = nx > 0 ? 0 : min; nx += (t - nx) * .18; vel *= .6; }
        set(nx);
        if (Math.abs(vel) > .1 || nx > .5 || nx < min - .5) raf = requestAnimationFrame(step); else set(Math.max(min, Math.min(0, nx)));
      })();
    }
    function animTo(t) {
      cancelAnimationFrame(raf); t = Math.max(min, Math.min(0, t)); if (reduce) { set(t); return; }
      (function step() { var d = t - x; if (Math.abs(d) < .5) { set(t); return; } set(x + d * .16); raf = requestAnimationFrame(step); })();
    }
    function stepSize() { var c = $$('.ds-card', track); return c.length > 1 ? c[1].offsetLeft - c[0].offsetLeft : vp.clientWidth * .8; }
    vp.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('button')) return;
      down = true; moved = false; pid = e.pointerId; sx = lx = e.clientX; sy = e.clientY; startX = x; lt = performance.now(); vel = 0; cancelAnimationFrame(raf); cur && cur.classList.add('down');
    });
    vp.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'touch') pos(e);
      if (!down) return;
      var dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 5) { if (e.pointerType === 'touch' && Math.abs(e.clientY - sy) > Math.abs(dx)) { down = false; return; } moved = true; try { vp.setPointerCapture(pid); } catch (_) { } vp.classList.add('is-dragging'); }
      if (!moved) return;
      var now = performance.now(), dt = Math.max(1, now - lt); vel = vel * .6 + ((e.clientX - lx) / dt * 16) * .4; lx = e.clientX; lt = now;
      set(rubber(startX + dx));
    });
    function up() { if (!down) return; down = false; cur && cur.classList.remove('down'); vp.classList.remove('is-dragging'); try { vp.releasePointerCapture(pid); } catch (_) { } if (moved) inertia(); }
    vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);
    vp.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    vp.addEventListener('wheel', function (e) { if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 0) { e.preventDefault(); cancelAnimationFrame(raf); vel = 0; set(Math.max(min, Math.min(0, x - e.deltaX))); } }, { passive: false });
    vp.addEventListener('keydown', function (e) { var k = e.key; if (k === 'ArrowRight') { e.preventDefault(); animTo(x - stepSize()); } else if (k === 'ArrowLeft') { e.preventDefault(); animTo(x + stepSize()); } else if (k === 'Home') { e.preventDefault(); animTo(0); } else if (k === 'End') { e.preventDefault(); animTo(min); } });
    prev.onclick = function () { animTo(x + stepSize()); }; next.onclick = function () { animTo(x - stepSize()); };
    window.addEventListener('resize', measure);
    /* kursor "DRAG" melingkar — hanya mouse/pen, hanya di dalam seksi */
    function pos(e) { if (!cur || e.pointerType === 'touch') return; cur.style.transform = 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)'; }
    root.addEventListener('pointerenter', function (e) { if (cur && e.pointerType !== 'touch') { root.classList.add('has-cursor'); pos(e); cur.classList.add('on'); } });
    root.addEventListener('pointermove', function (e) { if (cur && e.pointerType !== 'touch') { pos(e); var onUI = e.target.closest('.ds-ui, .showcase-head, button, .btn'); cur.classList.toggle('on', !onUI); root.classList.toggle('has-cursor', !onUI); } });
    root.addEventListener('pointerleave', function () { if (cur) { cur.classList.remove('on', 'down'); root.classList.remove('has-cursor'); } });
    return { measure: measure };
  }

  /* ---------- hero & ringkasan hari ini ---------- */
  function renderHero() {
    var d = new Date(), t = U.today(), open = S.openTasks(), st = S.streak();
    var name = DB.data.profile.name;
    $('#heroEyebrow').textContent = U.greet() + (name ? ', ' + name : '') + ' · ' + U.long(t);
    var late = open.filter(function (k) { return k.date < t; }).length, dueToday = open.filter(function (k) { return k.date === t; }).length;
    var month = U.month(t), net = DB.list('transactions').filter(function (x) { return U.month(x.datetime) === month; }).reduce(function (a, x) { return a + (x.type === 'income' ? x.amount : -x.amount); }, 0);
    $('#heroTiles').innerHTML = [['var(--yel)', open.length, 'Tugas terbuka' + (late ? ' · ' + late + ' terlambat' : '')], ['var(--blu)', U.rp(S.totalBalance()), 'Total saldo'], ['var(--grn)', st.current + ' hari', 'Streak habit'], ['var(--pch)', U.rp(net), 'Arus kas ' + U.monthLabel(month).split(' ')[0]]]
      .map(function (x) { return '<div class="tile" style="background:' + x[0] + '"><div class="n">' + esc(x[1]) + '</div><div class="l">' + esc(x[2]) + '</div></div>'; }).join('');
    $('#today').innerHTML = todayHTML(t, open, dueToday, st);
    $$('#today [data-go]').forEach(function (b) { b.onclick = function () { location.href = b.dataset.go; }; });
  }
  function todayHTML(t, open, dueToday, st) {
    var tasks = open.filter(function (k) { return k.date <= t; }).sort(S.byDeadline).slice(0, 5);
    var hs = DB.list('habits').filter(function (h) { return h.date === t; });
    var tx = DB.list('transactions').filter(function (x) { return x.datetime.slice(0, 10) === t; });
    var spent = tx.filter(function (x) { return x.type === 'expense'; }).reduce(function (a, x) { return a + x.amount; }, 0), inc = tx.filter(function (x) { return x.type === 'income'; }).reduce(function (a, x) { return a + x.amount; }, 0);
    return '<div class="card"><div class="row between"><h3 class="display h-sm" style="margin:0">Tugas hari ini &amp; terlambat</h3><a class="btn sm plain light" href="pages/tasks.html">Semua</a></div><ul class="mini-list" style="margin-top:14px">' +
      (tasks.length ? tasks.map(function (k) { return '<li><span class="dot" style="--pc:' + PCOL[k.priority] + '"></span><b>' + esc(k.name) + '</b><span class="hint">' + esc(U.rel(k.date)) + '</span></li>'; }).join('') : '<li><b class="muted">Tidak ada tugas jatuh tempo. Santai dulu!</b></li>') + '</ul></div>' +
      '<div class="card"><div class="row between"><h3 class="display h-sm" style="margin:0">Habit hari ini</h3><a class="btn sm plain light" href="pages/habits.html">Buka</a></div><div class="big-n" style="margin:10px 0 2px">' + hs.filter(function (h) { return h.done; }).length + '/' + hs.length + '</div><div class="hint">selesai · streak ' + st.current + ' hari (terbaik ' + st.best + ')</div><ul class="mini-list" style="margin-top:12px">' +
      hs.slice(0, 4).map(function (h) { return '<li><span class="dot" style="--pc:' + U.catColor(h.categoryId) + ';' + (h.done ? 'background:#1B1B1B' : '') + '"></span><b>' + esc(h.name) + '</b></li>'; }).join('') + '</ul></div>' +
      '<div class="card"><div class="row between"><h3 class="display h-sm" style="margin:0">Keuangan hari ini</h3><a class="btn sm plain light" href="pages/finance.html">Buka</a></div><div class="big-n" style="margin:10px 0 2px">' + esc(U.rp(spent)) + '</div><div class="hint">pengeluaran · pemasukan ' + esc(U.rp(inc)) + '</div><ul class="mini-list" style="margin-top:12px">' +
      tx.slice(0, 4).map(function (x) { return '<li><span class="dot" style="--pc:' + U.catColor(x.categoryId) + '"></span><b>' + esc(x.description || U.catName(x.categoryId)) + '</b><span class="hint">' + (x.type === 'income' ? '+' : '−') + U.num(x.amount) + '</span></li>'; }).join('') + '</ul></div>';
  }

  function render() {
    renderHero(); renderShowcase();
    var e = $('#emptyHint'); if (e) e.hidden = !DB.isEmpty();
  }

  App.start(function () {
    if (!drag) {
      drag = Drag($('#ds'));
      $('#ds').addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]'); if (!b) return; var c = b.closest('.ds-card'), id = c.dataset.id, kind = c.dataset.kind, tbl = kind === 'task' ? 'tasks' : 'habits';
        if (b.dataset.act === 'done') { DB.update(tbl, id, kind === 'task' ? { done: true, done_at: DB.localDT(new Date()) } : { done: true, done_at: DB.localDT(new Date()) }); A.UI.toast('Ditandai selesai', 'ok'); }
        else F[kind](DB.find(tbl, id));
      });
      var heroAdd = $$('[data-add]'); heroAdd.forEach(function (b) { b.onclick = function () { F[b.dataset.add](); }; });
      var dm = $('#demoBtn'); if (dm) dm.onclick = function () { DB.loadDemo(); A.UI.toast('Data contoh ditambahkan', 'ok'); };
      var dp = $('#dataBtn'); if (dp) dp.onclick = function () { A.dataPanel(); };
    }
    render();
  });
})();
