/* ============================================================================
   PERSONAL OS — database.js
   Lapisan data. Dokumen JSON berisi tabel: tasks, wallets, categories,
   transactions, habits, notes (+ profile). Disimpan:
     1) localStorage  → selalu, di perangkat ini (cepat, bekerja offline)
     2) IndexedDB     → isi file (blob) yang diunggah di Files
     3) GitHub repo   → opsional; file data/personal-os.json (+ data/files/*) agar
                        data yang sama muncul di semua perangkat.
   Sinkronisasi menggabungkan PER-RECORD (record terbaru menang, penghapusan
   dicatat sebagai tombstone) sehingga dua perangkat yang sama-sama mengubah
   data tidak saling menimpa. Skrip klasik (bukan ES module) supaya bisa dibuka
   langsung dari file:// maupun GitHub Pages.
   ============================================================================ */
(function (global) {
  'use strict';
  var KEY = 'pos.db', SYNC_KEY = 'pos.sync', IDB_NAME = 'pos-files';
  var TABLES = ['tasks', 'wallets', 'categories', 'transactions', 'habits', 'notes'];
  var MAX_FILE = 10 * 1024 * 1024;
  var ALLOWED = /\.(pdf|png|jpe?g|gif|webp|svg|txt|md|csv|json|docx?|xlsx?|pptx?|zip|rar|7z|mp3|mp4|mov|wav)$/i;

  var now = function () { return Date.now(); };
  var uid = function () { return Math.random().toString(36).slice(2, 8) + now().toString(36).slice(-4); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var localDT = function (d) { return ymd(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };

  /* ---------- data bawaan (id tetap agar tidak dobel saat sync antar-perangkat) ---------- */
  function defaults() {
    var C = function (id, scope, name, color) { return { id: id, scope: scope, name: name, color: color, _u: 1 }; };
    return {
      version: 1,
      profile: { name: '', _u: 0 },
      tasks: [],
      wallets: [
        { id: 'w-bsi', name: 'Bank BSI', opening: 0, color: '#B0E5A8', _u: 1 },
        { id: 'w-dana', name: 'DANA', opening: 0, color: '#A5CDE6', _u: 1 },
        { id: 'w-gopay', name: 'GoPay', opening: 0, color: '#C8CCFA', _u: 1 },
        { id: 'w-ovo', name: 'OVO', opening: 0, color: '#E8CDFA', _u: 1 },
        { id: 'w-cash', name: 'Cash', opening: 0, color: '#EDE06E', _u: 1 }
      ],
      categories: [
        C('x-food', 'expense', 'Makan & Minum', '#F5C5A8'), C('x-trans', 'expense', 'Transportasi', '#A5CDE6'), C('x-edu', 'expense', 'Pendidikan', '#C8CCFA'),
        C('x-fun', 'expense', 'Hiburan', '#E8CDFA'), C('x-shop', 'expense', 'Belanja', '#EDE06E'), C('x-health', 'expense', 'Kesehatan', '#B0E5A8'),
        C('x-sub', 'expense', 'Langganan', '#d9d9d9'), C('x-other', 'expense', 'Lainnya', '#bdbdbd'),
        C('i-allow', 'income', 'Uang Saku', '#B0E5A8'), C('i-scholar', 'income', 'Beasiswa', '#EDE06E'), C('i-free', 'income', 'Freelance', '#A5CDE6'),
        C('i-gift', 'income', 'Hadiah', '#E8CDFA'), C('i-other', 'income', 'Lainnya', '#d9d9d9'),
        C('h-sport', 'habit', 'Olahraga', '#B0E5A8'), C('h-study', 'habit', 'Belajar', '#EDE06E'), C('h-read', 'habit', 'Membaca', '#E8CDFA'),
        C('h-self', 'habit', 'Self-care', '#F5C5A8'), C('h-org', 'habit', 'Organisasi', '#A5CDE6'), C('h-other', 'habit', 'Lainnya', '#d9d9d9'),
        C('n-lect', 'note', 'Catatan Kuliah', '#EDE06E'), C('n-task', 'note', 'Tugas', '#F5C5A8'), C('n-mat', 'note', 'Materi', '#A5CDE6'),
        C('n-doc', 'note', 'Dokumen Pribadi', '#C8CCFA'), C('n-cert', 'note', 'Sertifikat', '#B0E5A8'), C('n-idea', 'note', 'Ide', '#E8CDFA'), C('n-other', 'note', 'Lainnya', '#d9d9d9')
      ],
      transactions: [], habits: [], notes: [],
      deleted: {}, fileTrash: [], updated_at: now()
    };
  }

  /* ---------- penyimpanan lokal ---------- */
  var listeners = {};
  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, arg) { (listeners[evt] || []).forEach(function (f) { try { f(arg); } catch (e) { console.error(e); } }); }

  function normalize(d) {
    var base = defaults(); d = d && typeof d === 'object' ? d : {};
    TABLES.forEach(function (t) { if (!Array.isArray(d[t])) d[t] = t === 'wallets' || t === 'categories' ? base[t] : []; });
    if (!d.profile) d.profile = base.profile; if (!d.deleted) d.deleted = {}; if (!Array.isArray(d.fileTrash)) d.fileTrash = [];
    d.version = 1; d.updated_at = d.updated_at || now(); return d;
  }
  function loadLocal() {
    try { var raw = localStorage.getItem(KEY); if (raw) return normalize(JSON.parse(raw)); } catch (e) { console.warn('Data lokal rusak, memakai data baru', e); }
    return defaults();
  }
  var data = loadLocal();
  function persist(silent) {
    data.updated_at = now();
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { emit('error', 'Penyimpanan peramban penuh atau diblokir: ' + e.message); }
    if (!silent) emit('change');
  }
  global.addEventListener && global.addEventListener('storage', function (e) { if (e.key === KEY) { data = loadLocal(); emit('change'); } });

  /* ---------- CRUD ---------- */
  var DB = {
    TABLES: TABLES, MAX_FILE: MAX_FILE, uid: uid, ymd: ymd, localDT: localDT, on: on, emit: emit,
    get data() { return data; },
    list: function (t) { return data[t]; },
    find: function (t, id) { return data[t].filter(function (r) { return r.id === id; })[0] || null; },
    add: function (t, obj) {
      var rec = Object.assign({}, obj, { id: obj.id || uid(), created_at: obj.created_at || localDT(new Date()), _u: now() });
      data[t].push(rec); delete data.deleted[rec.id]; persist(); scheduleSync(); return rec;
    },
    update: function (t, id, patch) {
      var r = DB.find(t, id); if (!r) return null; Object.assign(r, patch, { _u: now() }); persist(); scheduleSync(); return r;
    },
    remove: function (t, id) {
      var i = data[t].findIndex(function (r) { return r.id === id; }); if (i < 0) return;
      var rec = data[t][i]; data[t].splice(i, 1); data.deleted[id] = now();
      if (t === 'notes' && rec.file && rec.file.id) { files.del(rec.file.id); if (rec.file.remote) data.fileTrash.push(rec.file.id); }
      persist(); scheduleSync();
    },
    setProfile: function (patch) { Object.assign(data.profile, patch, { _u: now() }); persist(); scheduleSync(); },
    replaceAll: function (obj) { data = normalize(clone(obj)); persist(); scheduleSync(); },
    exportJSON: function () { return JSON.stringify(data, null, 2); },
    reset: function () { data = defaults(); persist(); scheduleSync(); },
    isEmpty: function () { return !data.tasks.length && !data.transactions.length && !data.habits.length && !data.notes.length; }
  };

  /* ---------- IndexedDB untuk isi file ---------- */
  var mem = {}, idbp = null;
  function idb() {
    if (idbp) return idbp;
    idbp = new Promise(function (res, rej) {
      try {
        var rq = indexedDB.open(IDB_NAME, 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('files'); };
        rq.onsuccess = function () { res(rq.result); }; rq.onerror = function () { rej(rq.error); };
      } catch (e) { rej(e); }
    });
    return idbp;
  }
  function tx(mode, fn) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) { var t = db.transaction('files', mode), r = fn(t.objectStore('files')); t.oncomplete = function () { res(r && r.result); }; t.onerror = function () { rej(t.error); }; });
    });
  }
  var files = {
    put: function (id, blob) { mem[id] = blob; return tx('readwrite', function (s) { return s.put(blob, id); }).catch(function () { }); },
    get: function (id) { return tx('readonly', function (s) { return s.get(id); }).then(function (b) { return b || mem[id] || null; }).catch(function () { return mem[id] || null; }); },
    del: function (id) { delete mem[id]; return tx('readwrite', function (s) { return s.delete(id); }).catch(function () { }); },
    /** Validasi sebelum unggah (PRD 6.2: ukuran & tipe) */
    check: function (f) {
      if (!f) return ''; if (f.size > MAX_FILE) return 'Ukuran file maksimal ' + (MAX_FILE / 1048576) + ' MB';
      if (!ALLOWED.test(f.name)) return 'Tipe file tidak didukung (' + (f.name.split('.').pop() || '?') + ')'; return '';
    },
    /** Ambil blob; bila belum ada di perangkat ini dan sudah di GitHub, unduh dulu. */
    fetchBlob: function (meta) {
      return files.get(meta.id).then(function (b) {
        if (b) return b; if (!meta.remote || !sync.configured()) return null;
        return ghRaw('data/files/' + meta.id).then(function (blob) { if (blob) files.put(meta.id, blob); return blob; });
      });
    }
  };
  DB.files = files;

  /* ---------- gabung (merge) per-record ---------- */
  function merge(a, b) {
    var out = defaults(); out.transactions = []; out.wallets = []; out.categories = [];
    out.deleted = Object.assign({}, b.deleted || {}); Object.keys(a.deleted || {}).forEach(function (k) { out.deleted[k] = Math.max(out.deleted[k] || 0, a.deleted[k]); });
    var cutoff = now() - 90 * 864e5; Object.keys(out.deleted).forEach(function (k) { if (out.deleted[k] < cutoff) delete out.deleted[k]; });
    TABLES.forEach(function (t) {
      var m = {};
      (b[t] || []).forEach(function (r) { m[r.id] = r; });
      (a[t] || []).forEach(function (r) { if (!m[r.id] || (r._u || 0) >= (m[r.id]._u || 0)) m[r.id] = r; });
      out[t] = Object.keys(m).map(function (k) { return m[k]; }).filter(function (r) { return !(out.deleted[r.id] && out.deleted[r.id] >= (r._u || 0)); });
    });
    out.profile = (a.profile && (a.profile._u || 0) >= ((b.profile && b.profile._u) || 0)) ? a.profile : b.profile || a.profile;
    out.fileTrash = Array.from(new Set((a.fileTrash || []).concat(b.fileTrash || [])));
    out.updated_at = Math.max(a.updated_at || 0, b.updated_at || 0);
    return out;
  }
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(function (k) { return k !== 'updated_at'; }).map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    return JSON.stringify(v);
  }
  DB.merge = merge;

  /* ---------- sinkronisasi GitHub ---------- */
  var cfg = null, timer = null, running = false, again = false;
  var status = { state: 'off', msg: 'Sinkronisasi belum diatur', at: 0 };
  function readCfg() { try { cfg = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null'); } catch (e) { cfg = null; } if (cfg && (!cfg.repo || !cfg.token)) cfg = null; }
  readCfg();
  function setStatus(state, msg) { status = { state: state, msg: msg, at: status.at }; if (state === 'ok') status.at = now(); emit('sync', status); }

  function b64FromBytes(bytes) { var s = '', ch = 0x8000; for (var i = 0; i < bytes.length; i += ch) s += String.fromCharCode.apply(null, bytes.subarray(i, i + ch)); return btoa(s); }
  function b64FromText(t) { return b64FromBytes(new TextEncoder().encode(t)); }
  function textFromB64(b) { var s = atob(b.replace(/\s/g, '')), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new TextDecoder().decode(u); }
  function blobToB64(blob) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = function () { rej(r.error); }; r.readAsDataURL(blob); }); }

  function gh(method, path, body, accept) {
    var url = 'https://api.github.com/repos/' + cfg.repo + '/contents/' + path.split('/').map(encodeURIComponent).join('/') + (method === 'GET' ? '?ref=' + encodeURIComponent(cfg.branch || 'main') + '&_=' + now() : '');
    return fetch(url, { method: method, cache: 'no-store', headers: { Accept: accept || 'application/vnd.github+json', Authorization: 'Bearer ' + cfg.token, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  }
  function explain(r, j) {
    var m = (j && j.message) || ('HTTP ' + r.status);
    if (r.status === 401) return 'Token ditolak (401). Periksa token GitHub.';
    if (r.status === 403) return 'Akses ditolak (403): ' + m;
    if (r.status === 404) return 'Repo/cabang tidak ditemukan atau token tidak punya akses (404).';
    return m;
  }
  function ghRaw(path) {
    return gh('GET', path, null, 'application/vnd.github.raw+json').then(function (r) { if (r.status === 404) return null; if (!r.ok) throw new Error('Gagal mengunduh file (' + r.status + ')'); return r.blob(); });
  }
  function pull() {
    return gh('GET', cfg.path || 'data/personal-os.json').then(function (r) {
      if (r.status === 404) return { data: null, sha: null };
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(explain(r, j));
        if (j.content) return { data: JSON.parse(textFromB64(j.content)), sha: j.sha };
        return ghRaw(cfg.path || 'data/personal-os.json').then(function (b) { return b.text(); }).then(function (t) { return { data: JSON.parse(t), sha: j.sha }; });
      });
    });
  }
  function push(obj, sha) {
    var body = { message: 'Personal OS sync ' + new Date().toISOString(), content: b64FromText(JSON.stringify(obj, null, 1)), branch: cfg.branch || 'main' };
    if (sha) body.sha = sha;
    return gh('PUT', cfg.path || 'data/personal-os.json', body).then(function (r) {
      return r.json().then(function (j) { if (r.status === 409 || r.status === 422) { var e = new Error('konflik'); e.conflict = true; throw e; } if (!r.ok) throw new Error(explain(r, j)); return j.content.sha; });
    });
  }
  function syncFiles() {
    var jobs = [];
    data.notes.forEach(function (n) {
      if (n.file && n.file.id && !n.file.remote) {
        jobs.push(files.get(n.file.id).then(function (blob) {
          if (!blob) return; return blobToB64(blob).then(function (b) {
            return gh('PUT', 'data/files/' + n.file.id, { message: 'Personal OS file ' + n.file.name, content: b, branch: cfg.branch || 'main' }).then(function (r) { return r.json().then(function (j) { if (!r.ok && r.status !== 422) throw new Error(explain(r, j)); DB.update('notes', n.id, { file: Object.assign({}, n.file, { remote: true }) }); }); });
          });
        }));
      }
    });
    var trash = data.fileTrash.slice();
    trash.forEach(function (id) {
      jobs.push(gh('GET', 'data/files/' + id).then(function (r) { if (r.status === 404) return null; return r.json().then(function (j) { return gh('DELETE', 'data/files/' + id, { message: 'Personal OS hapus file', sha: j.sha, branch: cfg.branch || 'main' }); }); })
        .then(function () { data.fileTrash = data.fileTrash.filter(function (x) { return x !== id; }); persist(true); }).catch(function () { }));
    });
    return Promise.all(jobs);
  }
  function run() {
    if (!cfg) { setStatus('off', 'Sinkronisasi belum diatur'); return Promise.resolve(false); }
    if (!navigator.onLine) { setStatus('error', 'Offline — akan disinkronkan saat online'); return Promise.resolve(false); }
    if (running) { again = true; return Promise.resolve(false); }
    running = true; setStatus('syncing', 'Menyinkronkan…');
    var attempt = 0;
    function loop() {
      return syncFiles().then(pull).then(function (remote) {
        var merged = remote.data ? merge(data, normalize(remote.data)) : data;
        var cm = canon(merged);
        if (cm !== canon(data)) { data = merged; persist(false); }
        if (!remote.data || cm !== canon(remote.data)) {
          return push(data, remote.sha).catch(function (e) { if (e.conflict && attempt++ < 2) return loop(); throw e; });
        }
      });
    }
    return loop().then(function () { running = false; setStatus('ok', 'Tersinkron'); if (again) { again = false; scheduleSync(300); } return true; })
      .catch(function (e) { running = false; setStatus('error', e && e.message ? e.message : 'Gagal sinkron'); return false; });
  }
  function scheduleSync(ms) { if (!cfg) return; clearTimeout(timer); timer = setTimeout(run, ms == null ? 2500 : ms); }
  var sync = {
    configured: function () { return !!cfg; },
    config: function () { return cfg ? Object.assign({}, cfg) : null; },
    status: function () { return status; },
    save: function (c) { if (!c) { localStorage.removeItem(SYNC_KEY); cfg = null; setStatus('off', 'Sinkronisasi belum diatur'); return; }
      c.repo = String(c.repo || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, ''); c.path = (c.path || 'data/personal-os.json').trim(); c.branch = (c.branch || 'main').trim(); c.token = String(c.token || '').trim();
      localStorage.setItem(SYNC_KEY, JSON.stringify(c)); readCfg(); setStatus('idle', 'Siap menyinkronkan'); },
    run: run,
    /** Uji koneksi tanpa mengubah apa pun */
    test: function () { return gh('GET', cfg.path).then(function (r) { if (r.status === 404) { return gh('GET', '').then(function (r2) { if (r2.ok || r2.status === 404) return 'Repo terhubung. Berkas data belum ada dan akan dibuat saat sinkron pertama.'; return r2.json().then(function (j) { throw new Error(explain(r2, j)); }); }); } if (r.ok) return 'Terhubung. Berkas data ditemukan.'; return r.json().then(function (j) { throw new Error(explain(r, j)); }); }); }
  };
  DB.sync = sync;
  function auto() { if (cfg) { scheduleSync(400); } }
  global.addEventListener && (global.addEventListener('online', auto), global.addEventListener('focus', function () { if (cfg && now() - status.at > 30000) scheduleSync(300); }));
  document.addEventListener('visibilitychange', function () { if (!document.hidden && cfg && now() - status.at > 30000) scheduleSync(300); });
  setTimeout(auto, 200);

  /* ---------- data contoh (tombol "Isi data contoh") ---------- */
  DB.loadDemo = function () {
    var d = new Date(), day = function (n, h, m) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, h || 0, m || 0); return x; };
    var T = function (name, n, time, pr, desc, done) { return { name: name, date: ymd(day(n)), time: time, priority: pr, description: desc, done: !!done }; };
    [T('Laporan praktikum Basis Data', 2, '23:59', 'red', 'Bab 3–5 + screenshot query. Kirim lewat LMS.'), T('Bayar UKT semester genap', 9, '16:00', 'burgundy', 'Transfer lewat BSI Mobile, simpan bukti pembayaran.'),
      T('Baca jurnal untuk proposal', 5, '', 'yellow', 'Minimal 5 jurnal 3 tahun terakhir.'), T('Rapikan folder materi kuliah', 20, '', 'green', 'Pisahkan per semester.'),
      T('Presentasi kelompok Rekayasa Perangkat Lunak', 1, '08:00', 'red', 'Slide final + demo aplikasi.'), T('Daftar lomba karya tulis ilmiah', 45, '23:59', 'yellow', 'Cek persyaratan & tema di website panitia.'),
      T('Revisi CV untuk magang', -1, '', 'burgundy', 'Tambahkan proyek terbaru. (terlewat)'), T('Beli buku statistik', -3, '', 'green', 'Sudah dibeli', true), T('Kirim tugas Algoritma', -2, '20:00', 'yellow', 'Selesai', true)
    ].forEach(function (t) { DB.add('tasks', t); });
    var tr = function (type, cat, amt, w, n, h, desc) { DB.add('transactions', { type: type, categoryId: cat, amount: amt, walletId: w, datetime: localDT(day(n, h, 15)), description: desc }); };
    tr('income', 'i-allow', 2500000, 'w-bsi', -12, 9, 'Uang saku bulanan'); tr('income', 'i-free', 750000, 'w-dana', -8, 14, 'Proyek desain poster'); tr('income', 'i-scholar', 1200000, 'w-bsi', -20, 10, 'Beasiswa semester ini');
    tr('expense', 'x-food', 28000, 'w-gopay', 0, 12, 'Makan siang'); tr('expense', 'x-food', 45000, 'w-cash', -1, 19, 'Makan malam bersama teman'); tr('expense', 'x-food', 18000, 'w-dana', -2, 8, 'Sarapan & kopi');
    tr('expense', 'x-trans', 22000, 'w-gopay', -1, 7, 'Ojek ke kampus'); tr('expense', 'x-trans', 150000, 'w-bsi', -6, 10, 'Isi bensin & servis'); tr('expense', 'x-edu', 185000, 'w-bsi', -4, 13, 'Buku referensi');
    tr('expense', 'x-sub', 54000, 'w-ovo', -5, 6, 'Langganan musik'); tr('expense', 'x-fun', 65000, 'w-dana', -3, 20, 'Nonton bioskop'); tr('expense', 'x-shop', 230000, 'w-bsi', -7, 16, 'Sepatu olahraga');
    tr('expense', 'x-health', 40000, 'w-cash', -9, 11, 'Vitamin'); tr('expense', 'x-food', 32000, 'w-ovo', -10, 12, 'Makan siang');
    var hb = function (name, n, cat, desc, done) { return { name: name, date: ymd(day(n)), categoryId: cat, description: desc, done: !!done }; };
    var hs = [];
    for (var i = -6; i <= 0; i++) { if (i === 0) continue; hs.push(hb('Lari pagi 30 menit', i, 'h-sport', 'Keliling lapangan kampus', true)); hs.push(hb('Belajar 2 jam fokus', i, 'h-study', 'Pomodoro 4 sesi', i !== -3)); }
    hs.push(hb('Lari pagi 30 menit', 0, 'h-sport', 'Keliling lapangan kampus', false)); hs.push(hb('Belajar 2 jam fokus', 0, 'h-study', 'Pomodoro 4 sesi', false));
    hs.push(hb('Baca buku 20 halaman', 0, 'h-read', 'Atomic Habits', false)); hs.push(hb('Rapat himpunan', 2, 'h-org', 'Bahas proker bulan depan', false));
    hs.push(hb('Gym — latihan kaki', 1, 'h-sport', 'Squat, lunges, leg press', false)); hs.push(hb('Belajar Basis Data', 3, 'h-study', 'Normalisasi & indexing', false)); hs.push(hb('Meditasi 10 menit', 4, 'h-self', '', false));
    hs.push(hb('Seminar karier online', 12, 'h-other', 'Daftar dulu lewat tautan panitia', false));
    hs.forEach(function (h) { if (h.done) h.done_at = h.date + 'T20:00'; DB.add('habits', h); });
    DB.add('notes', { name: 'Ringkasan Normalisasi Basis Data', categoryId: 'n-lect', description: '1NF: nilai atomik. 2NF: tidak ada ketergantungan parsial. 3NF: tidak ada ketergantungan transitif.\nContoh tabel mahasiswa & mata_kuliah ada di slide pertemuan 6.', file: null });
    DB.add('notes', { name: 'Ide proyek akhir', categoryId: 'n-idea', description: 'Aplikasi pencatat kegiatan organisasi dengan QR presensi.\nCek kelayakan: waktu 3 bulan, tim 3 orang.', file: null });
    DB.add('notes', { name: 'Daftar tautan beasiswa', categoryId: 'n-doc', description: 'LPDP, Djarum, Bank Indonesia — cek jadwal pendaftaran tiap bulan Januari.', file: null });
  };

  DB.merge = merge;
  global.DB = DB;
})(window);
