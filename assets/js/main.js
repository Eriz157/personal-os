/* ============================================================================
   PERSONAL OS — main.js
   Bersama untuk semua halaman: utilitas, ikon, header/rail, modal, form generik,
   formulir tugas/transaksi/habit/catatan, pengelola kategori & dompet, panel
   "Data & Sinkron". Bergantung pada database.js (global DB).
   ============================================================================ */
(function (global) {
  'use strict';
  var DB = global.DB;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------- tanggal & angka ---------- */
  var DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var MONL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var U = {
    esc: esc, pad: pad, DAYS: DAYS, MON: MON, MONL: MONL,
    parse: function (s) { var p = String(s).slice(0, 10).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); },
    ymd: function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    today: function () { return U.ymd(new Date()); },
    addDays: function (s, n) { var d = U.parse(s); d.setDate(d.getDate() + n); return U.ymd(d); },
    diff: function (a, b) { var x = U.parse(a), y = U.parse(b); return Math.round((Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) - Date.UTC(y.getFullYear(), y.getMonth(), y.getDate())) / 864e5); },
    dayName: function (s) { return DAYS[U.parse(s).getDay()]; },
    dmy: function (s) { var p = String(s).slice(0, 10).split('-'); return p[2] + '-' + p[1] + '-' + p[0]; },
    long: function (s) { var d = U.parse(s); return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); },
    short: function (s) { var d = U.parse(s); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); },
    dtLabel: function (s) { return U.short(s) + (String(s).length > 10 ? ' · ' + String(s).slice(11, 16) : ''); },
    rel: function (s) { var n = U.diff(s, U.today()); if (n === 0) return 'Hari ini'; if (n === 1) return 'Besok'; if (n === -1) return 'Kemarin'; if (n < 0) return 'Terlambat ' + (-n) + ' hari'; if (n < 31) return n + ' hari lagi'; return Math.round(n / 30) + ' bulan lagi'; },
    month: function (s) { return String(s).slice(0, 7); },
    monthLabel: function (m) { var p = m.split('-'); return MONL[+p[1] - 1] + ' ' + p[0]; },
    rp: function (n) { n = Math.round(Number(n) || 0); return (n < 0 ? '-' : '') + 'Rp ' + Math.abs(n).toLocaleString('id-ID'); },
    num: function (n) { return (Number(n) || 0).toLocaleString('id-ID'); },
    size: function (b) { return b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB'; },
    ext: function (n) { var m = /\.([a-z0-9]+)$/i.exec(n || ''); return m ? m[1].toUpperCase() : 'FILE'; },
    greet: function () { var h = new Date().getHours(); return h < 4 ? 'Selamat malam' : h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam'; },
    cat: function (id) { return DB.find('categories', id); },
    catName: function (id) { var c = DB.find('categories', id); return c ? c.name : 'Tanpa kategori'; },
    catColor: function (id) { var c = DB.find('categories', id); return c ? c.color : '#d9d9d9'; },
    cats: function (scope) { return DB.list('categories').filter(function (c) { return c.scope === scope; }); },
    download: function (name, content, type) { var b = content instanceof Blob ? content : new Blob([content], { type: type || 'application/octet-stream' }); var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 30000); }
  };

  /* ---------- prioritas ---------- */
  var PRI = {
    burgundy: { label: 'Burgundy', sub: 'Kritis', desc: 'Tidak boleh terlewat — kerjakan lebih dulu.' },
    red: { label: 'Red', sub: 'Penting', desc: 'Penting dan mendesak, segera dijadwalkan.' },
    yellow: { label: 'Yellow', sub: 'Sedang', desc: 'Perlu dikerjakan, masih ada ruang waktu.' },
    green: { label: 'Green', sub: 'Santai', desc: 'Tidak mendesak, kerjakan saat senggang.' }
  };
  var PRI_ORDER = ['burgundy', 'red', 'yellow', 'green'];

  /* ---------- ikon ---------- */
  var IC = {
    arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>', left: '<path d="M20 12H5M11 6l-6 6 6 6"/>', down: '<path d="M12 4v15M6 13l6 6 6-6"/>', up: '<path d="M12 20V5M6 11l6-6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M4 12.5l5 5L20 6.5"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    db: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',
    file: '<path d="M6 3h8l5 5v13H6zM14 3v5h5"/>', dl: '<path d="M12 4v11M6 10l6 6 6-6M5 20h14"/>', task: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12.5l3 3 5-6"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.6-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2s1 1.7 2.8 2.1c1.9.4 2.8 1 2.8 2.2s-1.2 2-2.8 2c-1.3 0-2.3-.6-2.9-1.5M12 6v1.8M12 16.2V18"/>',
    flame: '<path d="M12 3c1 3.2 4.5 5 4.5 9.2A4.5 4.5 0 0 1 12 17a4.5 4.5 0 0 1-4.5-4.8c0-1.8.8-3 1.7-4 .2 1.2.9 2 1.8 2.3C10.6 8.3 10.8 5.5 12 3zM9.5 20.5h5"/>',
    note: '<path d="M5 4h14v12l-5 5H5zM14 21v-5h5M8.5 9h7M8.5 13h4"/>', sync: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.3L20 15.5M20 20v-4.5h-4.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V18a2 2 0 0 0 2 2h13V8H6.5A2.5 2.5 0 0 1 4 7.5zM16 14h.01"/>', cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'
  };
  var ico = function (n, s, w) { s = s || 20; return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>'; };
  U.ico = ico;
  U.star = function (fill, pts, inner, cls, style) {
    var p = [], n = pts || 8, R = 48, r = inner || 22;
    for (var i = 0; i < n * 2; i++) { var rad = i % 2 ? r : R, a = Math.PI * i / n - Math.PI / 2; p.push((50 + rad * Math.cos(a)).toFixed(1) + ',' + (50 + rad * Math.sin(a)).toFixed(1)); }
    return '<svg class="' + (cls || 'star') + '" style="' + (style || '') + '" viewBox="0 0 100 100" aria-hidden="true"><polygon points="' + p.join(' ') + '" fill="' + fill + '" stroke="#1B1B1B" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  };
  U.badge = function (text, id, fill, stroke, color) {
    var d = ''; for (var i = 0; i <= 360; i += 2) { var t = i * Math.PI / 180, rr = 95 + 3.4 * Math.sin(34 * t); d += (i ? 'L' : 'M') + (100 + rr * Math.cos(t)).toFixed(2) + ' ' + (100 + rr * Math.sin(t)).toFixed(2); }
    return '<svg class="ring" viewBox="0 0 200 200" aria-hidden="true"><path d="' + d + 'Z" fill="' + (fill || 'none') + '" stroke="' + (stroke || 'none') + '" stroke-width="1"/><defs><path id="' + id + '" d="M100,100 m-70,0 a70,70 0 1,1 140,0 a70,70 0 1,1 -140,0"/></defs><text font-family="Hanken Grotesk, sans-serif" font-weight="700" font-size="14.5" fill="' + (color || '#1B1B1B') + '"><textPath href="#' + id + '" textLength="436" lengthAdjust="spacing">' + esc(text) + '</textPath></text></svg>';
  };

  /* ---------- toast & modal ---------- */
  var UI = {};
  UI.toast = function (msg, type) {
    var box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    var t = document.createElement('div'); t.className = 'toast ' + (type || ''); t.setAttribute('role', 'status'); t.textContent = msg; box.appendChild(t); setTimeout(function () { t.remove(); }, 4200);
  };
  DB.on('error', function (m) { UI.toast(m, 'err'); });

  UI.modal = function (opt) {
    var back = document.createElement('div'); back.className = 'modal-back';
    back.innerHTML = '<div class="modal ' + (opt.wide ? 'wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(opt.title) + '" tabindex="-1"><div class="modal-head"' + (opt.color ? ' style="--mh:' + opt.color + '"' : '') + '><h3>' + esc(opt.title) + '</h3><button class="x" type="button" aria-label="Tutup">×</button></div><div class="modal-body"></div></div>';
    var prev = document.activeElement, box = $('.modal', back), body = $('.modal-body', back);
    var h = { el: body, root: back, close: function () { document.removeEventListener('keydown', key); back.remove(); if (prev && prev.focus) prev.focus(); if (opt.onClose) opt.onClose(); } };
    function key(e) { if (e.key === 'Escape' && back === lastModal()) h.close(); }
    function lastModal() { var all = $$('.modal-back'); return all[all.length - 1]; }
    $('.x', back).onclick = h.close; back.addEventListener('mousedown', function (e) { if (e.target === back) h.close(); });
    if (typeof opt.body === 'string') body.innerHTML = opt.body; else if (opt.body) body.appendChild(opt.body);
    document.body.appendChild(back); document.addEventListener('keydown', key);
    var first = $('input:not([type=hidden]):not([type=radio]), select, textarea', body); (first || box).focus(); return h;
  };
  UI.confirm = function (msg, okLabel, danger) {
    return new Promise(function (res) {
      var done = false, m = UI.modal({ title: 'Konfirmasi', body: '<p style="font-size:18px;margin-top:0">' + esc(msg) + '</p><div class="row" style="justify-content:flex-end"><button class="btn plain ghost" data-r="0">Batal</button><button class="btn plain' + (danger === false ? '' : ' danger') + '" data-r="1">' + esc(okLabel || 'Ya, hapus') + '</button></div>', onClose: function () { if (!done) { done = true; res(false); } } });
      $$('[data-r]', m.el).forEach(function (b) { b.onclick = function () { done = true; m.close(); res(b.dataset.r === '1'); }; });
      $('[data-r="1"]', m.el).focus();
    });
  };
  UI.prompt = function (title, label, cb) {
    var m = UI.modal({ title: title, body: '<form class="stack"><label class="f">' + esc(label) + '<input name="v" required maxlength="40" autocomplete="off"></label><div class="row" style="justify-content:flex-end"><button class="btn plain ghost" type="button" data-c>Batal</button><button class="btn plain" type="submit">Tambah</button></div></form>' });
    $('[data-c]', m.el).onclick = m.close; $('form', m.el).onsubmit = function (e) { e.preventDefault(); var v = this.v.value.trim(); if (!v) return; m.close(); cb(v); };
  };

  /* ---------- form generik ---------- */
  function fieldHTML(f, v) {
    var val = v[f.k] != null ? v[f.k] : (f.def != null ? f.def : ''), req = f.required ? ' required' : '', ctl = '', cls = 'f' + (f.full ? ' full' : '');
    if (f.type === 'priority') {
      ctl = '<div class="pri-pick" role="radiogroup" aria-label="Prioritas">' + PRI_ORDER.slice().reverse().map(function (k) { return '<label class="pri-' + k + '"><input type="radio" name="' + f.k + '" value="' + k + '"' + (val === k ? ' checked' : '') + '><span>' + PRI[k].label + '<small>' + PRI[k].sub + '</small></span></label>'; }).join('') + '</div>';
      return '<div class="' + cls + ' full" data-k="' + f.k + '"><span>' + esc(f.label) + '</span>' + ctl + '</div>';
    }
    if (f.type === 'textarea') ctl = '<textarea name="' + f.k + '" maxlength="' + (f.max || 4000) + '" placeholder="' + esc(f.placeholder || '') + '"' + req + ' style="' + (f.rows ? 'min-height:' + f.rows * 26 + 'px' : '') + '">' + esc(val) + '</textarea>';
    else if (f.type === 'select') {
      var sel = '<select name="' + f.k + '"' + req + '>' + (f.options || []).map(function (o) { return '<option value="' + esc(o.v) + '"' + (String(o.v) === String(val) ? ' selected' : '') + '>' + esc(o.l) + '</option>'; }).join('') + '</select>';
      ctl = f.addNew ? '<div class="sel-add">' + sel + '<button type="button" class="btn sm plain light" data-add="' + f.k + '" style="border-radius:10px">＋ Baru</button></div>' : sel;
    } else if (f.type === 'money') ctl = '<input name="' + f.k + '" inputmode="numeric" autocomplete="off" placeholder="0" value="' + esc(val !== '' ? Number(val).toLocaleString('id-ID') : '') + '"' + req + '>';
    else if (f.type === 'file') ctl = '<input type="file" name="' + f.k + '" accept="' + esc(f.accept || '') + '">';
    else if (f.type === 'check') return '<label class="' + cls + '" style="display:flex;gap:10px;align-items:center;text-transform:none;font-size:15px" data-k="' + f.k + '"><input type="checkbox" name="' + f.k + '"' + (val ? ' checked' : '') + '>' + esc(f.label) + '</label>';
    else ctl = '<input type="' + ({ datetime: 'datetime-local' }[f.type] || f.type || 'text') + '" name="' + f.k + '" value="' + esc(val) + '"' + req + (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null && f.type === 'number' ? ' max="' + f.max + '"' : '') + (f.maxlength ? ' maxlength="' + f.maxlength + '"' : '') + ' placeholder="' + esc(f.placeholder || '') + '" autocomplete="off">';
    return '<label class="' + cls + '" data-k="' + f.k + '">' + esc(f.label) + (f.required ? ' *' : '') + ctl + (f.hint ? '<small>' + f.hint + '</small>' : '') + '</label>';
  }
  UI.form = function (opt) {
    var vals = opt.values || {}, m = UI.modal({ title: opt.title, color: opt.color, wide: opt.wide });
    m.el.innerHTML = '<form class="stack" novalidate><div class="form-err" role="alert" hidden></div><div class="fgrid">' + opt.fields.map(function (f) { return fieldHTML(f, vals); }).join('') + '</div><div class="row between" style="margin-top:4px"><div class="row">' + (opt.onDelete ? '<button class="btn plain ghost danger-t" type="button" data-del style="color:var(--err);border-color:var(--err)">Hapus</button>' : '') + '</div><div class="row"><button class="btn plain ghost" type="button" data-c>Batal</button><button class="btn" type="submit">' + esc(opt.submit || 'Simpan') + ' <span class="chip">' + ico('check', 20) + '</span></button></div></div></form>';
    var form = $('form', m.el), err = $('.form-err', m.el);
    function get() {
      var o = {}; opt.fields.forEach(function (f) {
        var el = form.elements[f.k]; if (!el) return;
        if (f.type === 'check') o[f.k] = el.checked; else if (f.type === 'file') o[f.k] = el.files && el.files[0] || null;
        else if (f.type === 'money') o[f.k] = Number(String(el.value).replace(/\D/g, '')) || 0; else if (f.type === 'number') o[f.k] = el.value === '' ? '' : Number(el.value);
        else if (f.type === 'priority') { var c = form.querySelector('input[name="' + f.k + '"]:checked'); o[f.k] = c ? c.value : ''; } else o[f.k] = typeof el.value === 'string' ? el.value.trim() : el.value;
      }); return o;
    }
    var api = {
      get: get, close: m.close, form: form,
      setOptions: function (k, options, value) { var s = form.elements[k]; s.innerHTML = options.map(function (o) { return '<option value="' + esc(o.v) + '">' + esc(o.l) + '</option>'; }).join(''); if (value != null) s.value = value; },
      show: function (k, on) { var l = $('[data-k="' + k + '"]', form); if (l) l.hidden = !on; },
      set: function (k, v) { form.elements[k].value = v; },
      error: function (t) { err.textContent = t; err.hidden = !t; }
    };
    opt.fields.forEach(function (f) { if (f.type === 'money') form.elements[f.k].addEventListener('input', function () { var d = this.value.replace(/\D/g, ''); this.value = d ? Number(d).toLocaleString('id-ID') : ''; }); });
    $$('[data-add]', form).forEach(function (b) {
      b.onclick = function () { var f = opt.fields.filter(function (x) { return x.k === b.dataset.add; })[0]; UI.prompt(f.addLabel || 'Tambah baru', f.addPrompt || 'Nama', function (name) { var r = f.addNew(name, get()); if (!r) return; var s = form.elements[f.k]; var o = document.createElement('option'); o.value = r.v; o.textContent = r.l; s.appendChild(o); s.value = r.v; if (opt.onAdded) opt.onAdded(f.k, r); }); };
    });
    form.addEventListener('input', function (e) { if (opt.onChange) opt.onChange(e.target.name, get(), api); err.hidden = true; });
    form.addEventListener('change', function (e) { if (opt.onChange && e.target.tagName === 'SELECT') opt.onChange(e.target.name, get(), api); });
    $('[data-c]', m.el).onclick = m.close;
    if (opt.onDelete) $('[data-del]', m.el).onclick = function () { UI.confirm(opt.deleteMsg || 'Hapus data ini?').then(function (ok) { if (ok) { opt.onDelete(); m.close(); } }); };
    form.onsubmit = function (e) {
      e.preventDefault(); var v = get(), bad = opt.fields.filter(function (f) { return f.required && (v[f.k] === '' || v[f.k] == null || v[f.k] === 0 && f.type === 'money'); })[0];
      if (bad) { api.error('Lengkapi kolom: ' + bad.label); var el = form.elements[bad.k]; if (el && el.focus) el.focus(); return; }
      Promise.resolve(opt.onSubmit(v, api)).then(function (r) { if (typeof r === 'string') api.error(r); else if (r !== false) m.close(); });
    };
    if (opt.onOpen) opt.onOpen(api, vals); return api;
  };

  /* ---------- formulir domain ---------- */
  var F = {};
  function opts(list, key, label) { return list.map(function (x) { return { v: x[key || 'id'], l: x[label || 'name'] }; }); }
  var PASTEL = ['#E8CDFA', '#EDE06E', '#A5CDE6', '#F5C5A8', '#B0E5A8', '#C8CCFA'];
  function newCat(scope, name) { var ex = DB.list('categories').filter(function (c) { return c.scope === scope && c.name.toLowerCase() === name.toLowerCase(); })[0]; if (ex) return { v: ex.id, l: ex.name }; var c = DB.add('categories', { scope: scope, name: name, color: PASTEL[Math.floor(Math.random() * PASTEL.length)] }); return { v: c.id, l: c.name }; }

  F.task = function (rec, preset) {
    rec = rec || null; var v = rec || Object.assign({ priority: 'yellow', date: U.today(), time: '' }, preset || {});
    UI.form({
      title: rec ? 'Edit tugas' : 'Tugas baru', color: 'var(--yel)', values: v,
      fields: [{ k: 'name', label: 'Nama tugas', required: true, full: true, maxlength: 140 }, { k: 'date', label: 'Tanggal deadline', type: 'date', required: true }, { k: 'time', label: 'Waktu deadline', type: 'time', hint: 'Boleh dikosongkan' },
        { k: 'priority', label: 'Prioritas', type: 'priority' }, { k: 'description', label: 'Deskripsi', type: 'textarea', full: true, rows: 4 }],
      onSubmit: function (x) { var p = { name: x.name, date: x.date, time: x.time, priority: x.priority || 'yellow', description: x.description }; if (rec) DB.update('tasks', rec.id, p); else DB.add('tasks', Object.assign(p, { done: false })); UI.toast(rec ? 'Tugas diperbarui' : 'Tugas ditambahkan', 'ok'); },
      onDelete: rec ? function () { DB.remove('tasks', rec.id); UI.toast('Tugas dihapus', 'ok'); } : null, deleteMsg: 'Hapus tugas ini?'
    });
  };

  F.tx = function (rec, preset) {
    rec = rec || null; var v = rec || Object.assign({ type: 'expense', datetime: DB.localDT(new Date()), walletId: (DB.list('wallets')[0] || {}).id }, preset || {});
    var scopeOf = function (t) { return t === 'income' ? 'income' : 'expense'; };
    if (!v.categoryId || !U.cat(v.categoryId) || U.cat(v.categoryId).scope !== scopeOf(v.type)) v.categoryId = (U.cats(scopeOf(v.type))[0] || {}).id;
    UI.form({
      title: rec ? 'Edit transaksi' : 'Catat transaksi', color: 'var(--blu)', values: v,
      fields: [{ k: 'type', label: 'Jenis', type: 'select', options: [{ v: 'expense', l: 'Pengeluaran' }, { v: 'income', l: 'Pemasukan' }] },
        { k: 'categoryId', label: 'Kategori', type: 'select', options: opts(U.cats(scopeOf(v.type))), addNew: function (n, cur) { return newCat(scopeOf(cur.type), n); }, addLabel: 'Kategori baru', addPrompt: 'Nama kategori' },
        { k: 'amount', label: 'Nominal (Rp)', type: 'money', required: true },
        { k: 'walletId', label: 'Dompet', type: 'select', options: opts(DB.list('wallets')), addNew: function (n) { var w = DB.add('wallets', { name: n, opening: 0, color: PASTEL[DB.list('wallets').length % 6] }); return { v: w.id, l: w.name }; }, addLabel: 'Dompet baru', addPrompt: 'Nama dompet (mis. SeaBank)' },
        { k: 'datetime', label: 'Tanggal & waktu', type: 'datetime', required: true, full: true }, { k: 'description', label: 'Deskripsi', type: 'textarea', full: true, rows: 3 }],
      onChange: function (name, cur, api) { if (name === 'type') api.setOptions('categoryId', opts(U.cats(scopeOf(cur.type))), (U.cats(scopeOf(cur.type))[0] || {}).id); },
      onSubmit: function (x) { var p = { type: x.type, categoryId: x.categoryId, amount: x.amount, walletId: x.walletId, datetime: x.datetime, description: x.description }; if (!p.walletId) return 'Pilih dompet dulu'; if (rec) DB.update('transactions', rec.id, p); else DB.add('transactions', p); UI.toast('Transaksi tersimpan', 'ok'); },
      onDelete: rec ? function () { DB.remove('transactions', rec.id); UI.toast('Transaksi dihapus', 'ok'); } : null, deleteMsg: 'Hapus transaksi ini?'
    });
  };

  F.habit = function (rec, preset) {
    rec = rec || null; var v = rec || Object.assign({ date: U.today(), categoryId: (U.cats('habit')[0] || {}).id, repeat: 'none', count: 7 }, preset || {});
    UI.form({
      title: rec ? 'Edit aktivitas' : 'Aktivitas baru', color: 'var(--grn)', values: v,
      fields: [{ k: 'name', label: 'Nama aktivitas', required: true, full: true, maxlength: 120 }, { k: 'date', label: 'Tanggal aktivitas', type: 'date', required: true },
        { k: 'categoryId', label: 'Kategori', type: 'select', options: opts(U.cats('habit')), addNew: function (n) { return newCat('habit', n); }, addLabel: 'Kategori baru', addPrompt: 'Nama kategori (mis. Menulis)' },
        { k: 'description', label: 'Deskripsi', type: 'textarea', full: true, rows: 3 }]
        .concat(rec ? [{ k: 'done', label: 'Sudah dilakukan', type: 'check', full: true }] : [{ k: 'repeat', label: 'Ulangi', type: 'select', options: [{ v: 'none', l: 'Tidak diulang' }, { v: 'daily', l: 'Setiap hari' }, { v: 'weekly', l: 'Setiap minggu' }] }, { k: 'count', label: 'Total jadwal', type: 'number', min: 2, max: 60, hint: 'Termasuk tanggal pertama' }]),
      onOpen: function (api) { if (!rec) api.show('count', false); },
      onChange: function (name, cur, api) { if (name === 'repeat') api.show('count', cur.repeat !== 'none'); },
      onSubmit: function (x) {
        var p = { name: x.name, date: x.date, categoryId: x.categoryId, description: x.description };
        if (rec) { p.done = !!x.done; p.done_at = x.done ? (rec.done_at || DB.localDT(new Date())) : null; DB.update('habits', rec.id, p); UI.toast('Aktivitas diperbarui', 'ok'); return; }
        var n = x.repeat === 'none' ? 1 : Math.max(2, Math.min(60, Number(x.count) || 2)), step = x.repeat === 'weekly' ? 7 : 1, series = n > 1 ? DB.uid() : null;
        for (var i = 0; i < n; i++) DB.add('habits', Object.assign({}, p, { date: U.addDays(x.date, i * step), done: false, series: series }));
        UI.toast(n > 1 ? n + ' jadwal ditambahkan' : 'Aktivitas ditambahkan', 'ok');
      },
      onDelete: rec ? function () { DB.remove('habits', rec.id); UI.toast('Aktivitas dihapus', 'ok'); } : null, deleteMsg: 'Hapus aktivitas ini?'
    });
  };

  F.note = function (rec, preset) {
    rec = rec || null; var v = rec ? Object.assign({}, rec) : Object.assign({ categoryId: (U.cats('note')[0] || {}).id }, preset || {});
    UI.form({
      title: rec ? 'Edit simpanan' : 'Simpanan baru', color: 'var(--grn)', values: v, wide: true,
      fields: [{ k: 'name', label: 'Nama', required: true, full: true, maxlength: 140 }, { k: 'categoryId', label: 'Kategori', type: 'select', options: opts(U.cats('note')), addNew: function (n) { return newCat('note', n); }, addLabel: 'Kategori baru', addPrompt: 'Nama kategori' },
        { k: 'file', label: 'File (opsional)', type: 'file', hint: (rec && rec.file ? 'Saat ini: ' + esc(rec.file.name) + ' — pilih file baru untuk mengganti. ' : '') + 'Maks. ' + (DB.MAX_FILE / 1048576) + ' MB · PDF, gambar, dokumen Office, teks, zip, audio/video.' },
        { k: 'description', label: 'Deskripsi / catatan', type: 'textarea', full: true, rows: 9, max: 20000 }]
        .concat(rec && rec.file ? [{ k: 'removeFile', label: 'Hapus file terlampir', type: 'check', full: true }] : []),
      onSubmit: function (x) {
        var f = x.file, e = DB.files.check(f); if (e) return e;
        var p = { name: x.name, categoryId: x.categoryId, description: x.description }, old = rec && rec.file;
        function dropOld() { if (old) { DB.files.del(old.id); if (old.remote) { DB.data.fileTrash.push(old.id); } } }
        if (f) { var id = DB.uid() + DB.uid(); p.file = { id: id, name: f.name, type: f.type, size: f.size, remote: false }; p.uploaded_at = DB.localDT(new Date()); dropOld(); return DB.files.put(id, f).then(save); }
        if (x.removeFile && old) { p.file = null; dropOld(); }
        save();
        function save() { if (rec) DB.update('notes', rec.id, p); else DB.add('notes', Object.assign({ file: null, uploaded_at: DB.localDT(new Date()) }, p)); UI.toast('Tersimpan', 'ok'); }
      },
      onDelete: rec ? function () { DB.remove('notes', rec.id); UI.toast('Simpanan dihapus', 'ok'); } : null, deleteMsg: 'Hapus simpanan ini beserta filenya?'
    });
  };

  /* ---------- pengelola kategori & dompet ---------- */
  F.categories = function (scope, title) {
    var m = UI.modal({ title: title || 'Kelola kategori', color: 'var(--yel)' });
    function usage(c) { return scope === 'expense' || scope === 'income' ? DB.list('transactions').filter(function (t) { return t.categoryId === c.id; }).length : scope === 'habit' ? DB.list('habits').filter(function (t) { return t.categoryId === c.id; }).length : DB.list('notes').filter(function (t) { return t.categoryId === c.id; }).length; }
    function draw() {
      var list = U.cats(scope);
      m.el.innerHTML = '<div class="stack">' + (list.length ? list.map(function (c) { return '<div class="row" style="flex-wrap:nowrap" data-id="' + c.id + '"><input type="color" value="' + c.color + '" aria-label="Warna" style="width:56px;flex:none"><input value="' + esc(c.name) + '" aria-label="Nama" maxlength="40"><span class="hint" style="white-space:nowrap">' + usage(c) + ' data</span><button class="iconbtn danger" data-del aria-label="Hapus">' + ico('trash', 16) + '</button></div>'; }).join('') : '<div class="empty">Belum ada kategori</div>') +
        '<form class="row" style="flex-wrap:nowrap;margin-top:6px" data-new><input name="n" placeholder="Kategori baru…" maxlength="40" required aria-label="Kategori baru"><button class="btn sm plain" type="submit">Tambah</button></form></div>';
      $$('[data-id]', m.el).forEach(function (r) {
        var id = r.dataset.id, ins = $$('input', r);
        ins[0].onchange = function () { DB.update('categories', id, { color: this.value }); }; ins[1].onchange = function () { if (this.value.trim()) DB.update('categories', id, { name: this.value.trim() }); };
        $('[data-del]', r).onclick = function () { var c = DB.find('categories', id), n = usage(c); UI.confirm('Hapus kategori "' + c.name + '"?' + (n ? ' ' + n + ' data akan menjadi "Tanpa kategori".' : '')).then(function (ok) { if (ok) { DB.remove('categories', id); draw(); } }); };
      });
      $('[data-new]', m.el).onsubmit = function (e) { e.preventDefault(); var n = this.n.value.trim(); if (n) { newCat(scope, n); draw(); } };
    }
    draw();
  };
  F.wallets = function () {
    var m = UI.modal({ title: 'Kelola dompet', color: 'var(--blu)', wide: true });
    function draw() {
      var list = DB.list('wallets');
      m.el.innerHTML = '<div class="stack"><p class="hint" style="margin:0">Saldo awal dihitung sebelum transaksi apa pun. Dompet yang sudah dipakai transaksi tidak bisa dihapus.</p>' + list.map(function (w) { var n = DB.list('transactions').filter(function (t) { return t.walletId === w.id; }).length; return '<div class="row" style="flex-wrap:nowrap" data-id="' + w.id + '"><input type="color" value="' + w.color + '" aria-label="Warna" style="width:56px;flex:none"><input value="' + esc(w.name) + '" aria-label="Nama dompet" maxlength="30"><input value="' + Number(w.opening || 0).toLocaleString('id-ID') + '" inputmode="numeric" aria-label="Saldo awal" style="max-width:170px"><span class="hint" style="white-space:nowrap">' + n + ' trx</span><button class="iconbtn danger" data-del aria-label="Hapus" ' + (n ? 'disabled style="opacity:.35"' : '') + '>' + ico('trash', 16) + '</button></div>'; }).join('') +
        '<form class="row" style="flex-wrap:nowrap;margin-top:6px" data-new><input name="n" placeholder="Dompet baru (mis. SeaBank)…" maxlength="30" required aria-label="Dompet baru"><button class="btn sm plain" type="submit">Tambah</button></form></div>';
      $$('[data-id]', m.el).forEach(function (r) {
        var id = r.dataset.id, ins = $$('input', r);
        ins[0].onchange = function () { DB.update('wallets', id, { color: this.value }); }; ins[1].onchange = function () { if (this.value.trim()) DB.update('wallets', id, { name: this.value.trim() }); };
        ins[2].oninput = function () { var d = this.value.replace(/\D/g, ''); this.value = d ? Number(d).toLocaleString('id-ID') : ''; }; ins[2].onchange = function () { DB.update('wallets', id, { opening: Number(this.value.replace(/\D/g, '')) || 0 }); };
        $('[data-del]', r).onclick = function () { UI.confirm('Hapus dompet ini?').then(function (ok) { if (ok) { DB.remove('wallets', id); draw(); } }); };
      });
      $('[data-new]', m.el).onsubmit = function (e) { e.preventDefault(); var n = this.n.value.trim(); if (n) { DB.add('wallets', { name: n, opening: 0, color: PASTEL[list.length % 6] }); draw(); } };
    }
    draw();
  };

  /* ---------- statistik bersama ---------- */
  var S = {
    walletBalance: function (w) { return (w.opening || 0) + DB.list('transactions').filter(function (t) { return t.walletId === w.id; }).reduce(function (a, t) { return a + (t.type === 'income' ? t.amount : -t.amount); }, 0); },
    totalBalance: function () { return DB.list('wallets').reduce(function (a, w) { return a + S.walletBalance(w); }, 0); },
    habitDays: function () { var s = {}; DB.list('habits').forEach(function (h) { if (h.done) s[h.date] = (s[h.date] || 0) + 1; }); return s; },
    streak: function () {
      var d = S.habitDays(), cur = 0, t = U.today(), k = d[t] ? t : U.addDays(t, -1); while (d[k]) { cur++; k = U.addDays(k, -1); }
      var keys = Object.keys(d).sort(), best = 0, run = 0, prev = null; keys.forEach(function (x) { run = prev && U.diff(x, prev) === 1 ? run + 1 : 1; if (run > best) best = run; prev = x; });
      return { current: cur, best: best, total: DB.list('habits').filter(function (h) { return h.done; }).length, days: keys.length, todayDone: !!d[t] };
    },
    openTasks: function () { return DB.list('tasks').filter(function (t) { return !t.done; }); },
    taskKey: function (t) { return t.date + 'T' + (t.time || '23:59'); },
    byDeadline: function (a, b) { return S.taskKey(a) < S.taskKey(b) ? -1 : S.taskKey(a) > S.taskKey(b) ? 1 : 0; }
  };

  /* ---------- panel Data & Sinkron ---------- */
  var SYNC_TEXT = { off: 'Belum diatur', idle: 'Siap', syncing: 'Sinkron…', ok: 'Tersinkron', error: 'Galat' };
  function dataPanel(tab0) {
    var m = UI.modal({ title: 'Data & Sinkron', wide: true, color: 'var(--lav)' }), tab = tab0 || 'sync';
    function draw() {
      var c = DB.sync.config() || {}, st = DB.sync.status();
      var tabs = [['sync', 'Sinkronisasi'], ['backup', 'Cadangan'], ['raw', 'Data mentah'], ['misc', 'Profil & lainnya']];
      var body = '';
      if (tab === 'sync') body = '<div class="stack"><div class="notice-box" style="border:2px solid var(--ink);border-radius:12px;padding:12px 14px;background:var(--soft);font-size:14px"><b>Agar data sama di semua perangkat:</b> buat repo GitHub (disarankan <u>private</u>, mis. <code>personal-os-data</code>), lalu buat <i>fine-grained token</i> dengan izin <b>Contents: Read and write</b> hanya untuk repo itu. Isi di bawah dan simpan. Token disimpan <b>hanya di peramban perangkat ini</b>; ulangi di tiap perangkat. Data digabung per-record, jadi dua perangkat bisa mengubah data bergantian tanpa saling menimpa.</div>' +
        '<form class="fgrid" data-sync><label class="f full">Repo (pemilik/nama)<input name="repo" placeholder="username/personal-os-data" value="' + esc(c.repo || '') + '" required></label><label class="f">Cabang<input name="branch" value="' + esc(c.branch || 'main') + '"></label><label class="f">Lokasi berkas data<input name="path" value="' + esc(c.path || 'data/personal-os.json') + '"></label>' +
        '<label class="f full">Token GitHub<input name="token" type="password" autocomplete="off" placeholder="github_pat_…" value="' + esc(c.token || '') + '" required></label><div class="row full"><button class="btn" type="submit">Simpan &amp; sinkron <span class="chip">' + ico('sync', 20) + '</span></button><button class="btn light plain" type="button" data-test>Uji koneksi</button>' + (c.repo ? '<button class="btn plain ghost" type="button" data-off>Putuskan</button>' : '') + '</div></form>' +
        '<div class="row"><span class="chipx ' + (st.state === 'ok' ? 'ok' : st.state === 'error' ? 'no' : 'wait') + '"><i></i>' + SYNC_TEXT[st.state] + '</span><span class="hint" data-st>' + esc(st.msg) + (st.at ? ' · terakhir ' + new Date(st.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '') + '</span>' + (DB.sync.configured() ? '<button class="btn sm plain light" data-now>Sinkron sekarang</button>' : '') + '</div></div>';
      if (tab === 'backup') body = '<div class="grid g2"><div class="card"><h3 class="display h-sm" style="margin:0 0 8px">Ekspor</h3><p class="muted">Unduh seluruh data (tugas, keuangan, habit, catatan) sebagai satu berkas JSON. File lampiran tidak ikut — gunakan sinkronisasi GitHub untuk itu.</p><button class="btn" data-export>Unduh JSON <span class="chip">' + ico('dl', 20) + '</span></button></div>' +
        '<div class="card"><h3 class="display h-sm" style="margin:0 0 8px">Impor</h3><p class="muted">Pilih berkas JSON hasil ekspor. <b>Gabungkan</b> menjaga data yang sudah ada; <b>Timpa</b> mengganti semuanya.</p><input type="file" accept="application/json,.json" data-import><div class="row" style="margin-top:12px"><button class="btn sm plain" data-imp="merge">Gabungkan</button><button class="btn sm plain danger" data-imp="replace">Timpa</button></div></div></div>';
      if (tab === 'raw') body = '<div class="stack"><p class="muted" style="margin:0">Semua data ada di sini. Ubah langsung bila perlu (mis. menyunting banyak baris sekaligus), lalu terapkan. Pastikan JSON valid.</p><textarea class="json" data-raw spellcheck="false">' + esc(DB.exportJSON()) + '</textarea><div class="row"><button class="btn plain" data-apply>Terapkan perubahan</button><span class="hint" data-rerr></span></div></div>';
      if (tab === 'misc') body = '<div class="stack"><form class="row" style="flex-wrap:nowrap" data-prof><label class="f" style="flex:1">Nama panggilan (untuk sapaan dashboard)<input name="n" value="' + esc(DB.data.profile.name) + '" maxlength="30" placeholder="mis. Rizo"></label><button class="btn plain" type="submit" style="align-self:end">Simpan</button></form><hr style="width:100%;border:0;border-top:1px solid #ddd"><div class="row"><button class="btn plain light" data-demo>Isi data contoh</button><button class="btn plain danger" data-wipe>Hapus semua data</button></div><p class="hint" style="margin:0">Data contoh ditambahkan ke data yang sudah ada. “Hapus semua data” mengosongkan perangkat ini (dan GitHub bila sinkron aktif).</p></div>';
      m.el.innerHTML = '<div class="tabs">' + tabs.map(function (t) { return '<button class="tab ' + (t[0] === tab ? 'on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' + body;
      $$('[data-tab]', m.el).forEach(function (b) { b.onclick = function () { tab = b.dataset.tab; draw(); }; });
      var sf = $('[data-sync]', m.el); if (sf) {
        sf.onsubmit = function (e) { e.preventDefault(); var f = sf.elements; DB.sync.save({ repo: f.repo.value, branch: f.branch.value, path: f.path.value, token: f.token.value }); UI.toast('Menyinkronkan…'); DB.sync.run().then(function (ok) { UI.toast(ok ? 'Sinkronisasi berhasil' : 'Sinkronisasi gagal: ' + DB.sync.status().msg, ok ? 'ok' : 'err'); draw(); }); };
        $('[data-test]', m.el).onclick = function () { var f = sf.elements; DB.sync.save({ repo: f.repo.value, branch: f.branch.value, path: f.path.value, token: f.token.value }); DB.sync.test().then(function (t) { UI.toast(t, 'ok'); }, function (e) { UI.toast(e.message, 'err'); }); };
        var off = $('[data-off]', m.el); if (off) off.onclick = function () { DB.sync.save(null); UI.toast('Sinkronisasi diputus. Data tetap ada di perangkat ini.', 'ok'); draw(); };
        var now = $('[data-now]', m.el); if (now) now.onclick = function () { DB.sync.run().then(draw); };
      }
      var ex = $('[data-export]', m.el); if (ex) ex.onclick = function () { U.download('personal-os-' + U.today() + '.json', DB.exportJSON(), 'application/json'); };
      $$('[data-imp]', m.el).forEach(function (b) { b.onclick = function () {
        var f = $('[data-import]', m.el).files[0]; if (!f) return UI.toast('Pilih berkas JSON dulu', 'err');
        f.text().then(function (t) { var o = JSON.parse(t); if (!o || typeof o !== 'object' || !Array.isArray(o.tasks)) throw new Error('Bukan berkas Personal OS'); if (b.dataset.imp === 'merge') DB.replaceAll(DB.merge(DB.data, Object.assign(JSON.parse(DB.exportJSON()), o))); else DB.replaceAll(o); UI.toast('Impor selesai', 'ok'); m.close(); }).catch(function (e) { UI.toast('Gagal impor: ' + e.message, 'err'); });
      }; });
      var ap = $('[data-apply]', m.el); if (ap) ap.onclick = function () { try { var o = JSON.parse($('[data-raw]', m.el).value); if (!o || !Array.isArray(o.tasks) || !Array.isArray(o.transactions)) throw new Error('Struktur tidak lengkap'); DB.replaceAll(o); UI.toast('Data diperbarui', 'ok'); m.close(); } catch (e) { $('[data-rerr]', m.el).textContent = 'JSON tidak valid: ' + e.message; } };
      var pf = $('[data-prof]', m.el); if (pf) pf.onsubmit = function (e) { e.preventDefault(); DB.setProfile({ name: pf.n.value.trim() }); UI.toast('Nama disimpan', 'ok'); };
      var dm = $('[data-demo]', m.el); if (dm) dm.onclick = function () { DB.loadDemo(); UI.toast('Data contoh ditambahkan', 'ok'); m.close(); };
      var wp = $('[data-wipe]', m.el); if (wp) wp.onclick = function () { UI.confirm('Hapus SEMUA data? Tindakan ini tidak bisa dibatalkan (kecuali ada cadangan).', 'Ya, hapus semua').then(function (ok) { if (ok) { DB.data.tasks.concat(DB.data.transactions, DB.data.habits, DB.data.notes).forEach(function (r) { DB.data.deleted[r.id] = Date.now(); }); DB.data.notes.forEach(function (n) { if (n.file) { DB.files.del(n.file.id); if (n.file.remote) DB.data.fileTrash.push(n.file.id); } }); DB.data.tasks = []; DB.data.transactions = []; DB.data.habits = []; DB.data.notes = []; DB.replaceAll(DB.data); UI.toast('Semua data dihapus', 'ok'); m.close(); } }); };
    }
    DB.on('sync', function () { if (document.body.contains(m.root) && tab === 'sync') { var s = $('[data-st]', m.el); if (s) { var st = DB.sync.status(); s.textContent = st.msg; } } });
    draw();
  }

  /* ---------- header, rail, init ---------- */
  var NAV = [['dash', 'Dashboard', 'index.html'], ['tasks', 'Tasks', 'pages/tasks.html'], ['fin', 'Finance', 'pages/finance.html'], ['hab', 'Habits', 'pages/habits.html'], ['files', 'Files', 'pages/files.html']];
  function layout() {
    var root = document.body.dataset.root || '', key = document.body.dataset.key;
    var hdr = document.createElement('header'); hdr.className = 'site-header';
    hdr.innerHTML = '<a class="logo" href="' + root + 'index.html" aria-label="Personal OS — dashboard">PERSONAL OS<small>LIFE</small></a><nav class="nav" aria-label="Navigasi utama">' + NAV.map(function (n) { return '<a href="' + root + n[2] + '"' + (n[0] === key ? ' class="active" aria-current="page"' : '') + '>' + n[1] + '</a>'; }).join('') + '</nav>' +
      '<div class="header-right"><button class="sync-pill" type="button" id="syncPill" aria-label="Data dan sinkronisasi"><i></i><span>Data</span></button><button class="menu-btn" type="button" aria-label="Menu" aria-expanded="false">' + ico('menu') + '</button></div>';
    document.body.insertBefore(hdr, document.body.firstChild);
    var mb = $('.menu-btn', hdr), nav = $('.nav', hdr); mb.onclick = function () { var o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o); }; nav.onclick = function () { nav.classList.remove('open'); };
    var rail = document.createElement('aside'); rail.className = 'rail'; rail.setAttribute('aria-label', 'Tambah cepat');
    rail.innerHTML = [['task', 'Tugas baru', 'task'], ['coin', 'Catat transaksi', 'tx'], ['flame', 'Aktivitas baru', 'habit'], ['note', 'Simpanan baru', 'note']].map(function (r) { return '<button type="button" title="' + r[1] + '" aria-label="' + r[1] + '" data-q="' + r[2] + '">' + ico(r[0], 22) + '</button>'; }).join('');
    document.body.appendChild(rail); $$('[data-q]', rail).forEach(function (b) { b.onclick = function () { F[b.dataset.q](); }; });
    var tc = document.createElement('div'); tc.id = 'toasts'; tc.setAttribute('aria-live', 'polite'); document.body.appendChild(tc);
    $('#syncPill').onclick = function () { dataPanel(); };
    function pill() { var st = DB.sync.status(), p = $('#syncPill'); p.className = 'sync-pill ' + st.state; $('span', p).textContent = st.state === 'off' ? 'Lokal' : SYNC_TEXT[st.state]; p.title = st.msg; }
    DB.on('sync', pill); pill();
  }

  /** Jalankan fn setelah DOM siap & tata letak terpasang; fn dipanggil ulang tiap data berubah. */
  function start(render) {
    function go() { layout(); render(); DB.on('change', render); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }

  global.App = { $: $, $$: $$, U: U, UI: UI, F: F, S: S, PRI: PRI, PRI_ORDER: PRI_ORDER, ico: ico, esc: esc, start: start, dataPanel: dataPanel };
})(window);
