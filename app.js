// ═══ CONFIG ═══

// ═══ CONFIG ═══

var CONFETTI_CONFIG = {
  colors: ['#7FDAF7', '#ffffff', '#7600FF'],
  particleCount: 120,
  duration: 3000
};

function launchConfetti() {
  var end = Date.now() + CONFETTI_CONFIG.duration;
  var perFrame = Math.max(2, Math.round(CONFETTI_CONFIG.particleCount / 60));
  (function frame() {
    confetti({
      particleCount: perFrame,
      angle: 270,
      spread: 90,
      startVelocity: 20,
      gravity: 1.2,
      origin: { x: Math.random(), y: 0 },
      colors: CONFETTI_CONFIG.colors,
      zIndex: 99999
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
var SUPABASE_URL = 'https://vruwzwzokyyzwdyfnfpp.supabase.co';
var SUPABASE_KEY = 'sb_publishable_5EcH8Gb_4DKFLUUSBWMrOg_rl2ZieSR';
// AT_TOKEN et AT_BASE sont maintenant côté serveur (api/airtable.js)

// ═══ STATE ═══
var sb = null;
var currentUser = null;
var clientRecord = null;
var scriptsStore = {};
var scriptsLoaded = false;
var selectedScripts = {};
var currentEditorId = null;
var currentEditorText = '';
var filloutLoaded = false;
var isDark = true;
var genStep = 1;
var genData = { sujet: '', objectif: '', format: '', style: '', precision: '' };
var currentMode = 'standard';
var refScriptsStore = {};
var currentViewRefId = null;
var msgTimer = null;
var msgIdx = 0;
var editorTimer = null;
var genMsgs = ['Analyse de ton profil...', 'Selection du framework...', 'Calibration du ton...', 'Redaction en cours...', 'Finalisation...'];
var feedbackRating = null;
var pendingFeedbackRecordId = null;
var pendingFeedbackScriptLocalId = null;

// ═══ UTILITAIRES ═══
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ═══ NAVIGATION ═══
// Mémorise la page active avant d'ouvrir le compte
var _pageAvantCompte = 'home';

function go(id) {
  if (id === 'compte') {
    // Mémoriser quelle page est active en ce moment
    var active = document.querySelector('.screen.active:not(#screen-compte)');
    _pageAvantCompte = active ? active.id.replace('screen-', '') : 'home';
    // Ouvrir compte PAR-DESSUS sans toucher aux autres
    var compte = document.getElementById('screen-compte');
    if (compte) { compte.classList.add('active'); compte.scrollTop = 0; }
    return;
  }
  // Navigation normale entre pages
  document.querySelectorAll('.screen').forEach(function(s) {
    if (s.id !== 'screen-compte') s.classList.remove('active');
  });
  var el = document.getElementById('screen-' + id);
  if (el) { el.classList.add('active'); window.scrollTo(0, 0); }

  // ── Sync nav globale desktop ──
  var globalNav = document.getElementById('global-nav');
  if (globalNav) {
    globalNav.querySelectorAll('.ni[data-screen]').forEach(function(ni) {
      var s = ni.getAttribute('data-screen');
      var nd = ni.querySelector('.nd'), nl = ni.querySelector('.nl');
      if (nd) nd.classList.toggle('on', s === id);
      if (nl) nl.classList.toggle('on', s === id);
    });
  }
  var titles = { home: 'Accueil', sessions: 'Sessions', scripts: 'Scripts', cours: 'Cours', points: 'Fidélité' };
  var titleEl = document.getElementById('global-page-title');
  if (titleEl && titles[id]) titleEl.textContent = titles[id];
}

// Ferme le compte et revient sur la page d'où on venait
function closeCompte() {
  var compte = document.getElementById('screen-compte');
  if (compte) compte.classList.remove('active');
  // Remettre la page qui était active avant — sans écran noir
  var previous = document.getElementById('screen-' + _pageAvantCompte);
  if (previous && !previous.classList.contains('active')) {
    document.querySelectorAll('.screen').forEach(function(s) {
      if (s.id !== 'screen-compte') s.classList.remove('active');
    });
    previous.classList.add('active');
  }
}

function showTab(tab) {
  document.getElementById('sess-passees').style.display = tab === 'passees' ? 'block' : 'none';
  document.getElementById('sess-avenir').style.display = tab === 'avenir' ? 'block' : 'none';
  document.getElementById('tab-p').className = 'tab-btn' + (tab === 'passees' ? ' active' : '');
  document.getElementById('tab-a').className = 'tab-btn' + (tab === 'avenir' ? ' active' : '');
}

function toggleFiles(h) { var f = h.nextElementSibling; if (f) f.classList.toggle('open'); }

function selOpt(el) {
  el.parentNode.querySelectorAll('.ob-opt').forEach(function(o) { o.classList.remove('sel'); });
  el.classList.add('sel');
}

function selGen(el, key, val) {
  el.parentNode.querySelectorAll('.gen-opt').forEach(function(o) { o.classList.remove('sel'); });
  el.classList.add('sel');
  genData[key] = val;
}

function selGenChip(el, key, val) {
  el.parentNode.querySelectorAll('.gen-chip').forEach(function(o) { o.classList.remove('sel'); });
  el.classList.add('sel');
  genData[key] = val;
}

function toggleTheme() {
  isDark = !isDark;
  var r = document.documentElement.style;
  if (!isDark) {
    r.setProperty('--bg', '#f2f2f2'); r.setProperty('--bg2', '#fff'); r.setProperty('--bg3', '#e8e8e8');
    r.setProperty('--border', 'rgba(0,0,0,0.07)'); r.setProperty('--border2', 'rgba(0,0,0,0.12)');
    r.setProperty('--text', '#111'); r.setProperty('--text2', 'rgba(0,0,0,0.5)'); r.setProperty('--text3', 'rgba(0,0,0,0.25)');
  } else {
    r.setProperty('--bg', '#000000'); r.setProperty('--bg2', '#111113'); r.setProperty('--bg3', '#1c1c1e');
    r.setProperty('--border', 'rgba(255,255,255,0.06)'); r.setProperty('--border2', 'rgba(255,255,255,0.13)');
    r.setProperty('--text', '#fff'); r.setProperty('--text2', 'rgba(255,255,255,0.55)'); r.setProperty('--text3', 'rgba(255,255,255,0.28)');
  }
}

// ═══ MODALS ═══
function openHub() { document.getElementById('modal-hub').classList.add('open'); }
function closeHub() { document.getElementById('modal-hub').classList.remove('open'); }
function openStory() { document.getElementById('modal-story').classList.add('open'); }
function closeStory() { document.getElementById('modal-story').classList.remove('open'); }
function openRegen() { document.getElementById('modal-regen').classList.add('open'); }
function closeRegen() { document.getElementById('modal-regen').classList.remove('open'); }
function closeEditor() { document.getElementById('modal-editor').classList.remove('open'); }

function openResa() {
  document.getElementById('modal-resa').classList.add('open');
  if (!filloutLoaded) {
    filloutLoaded = true;
    var iframe = document.createElement('iframe');
    iframe.src = 'https://septup.fillout.com/reservations';
    iframe.style.cssText = 'width:100%;height:100%;border:none;';
    iframe.setAttribute('allow', 'camera; microphone; geolocation');
    iframe.onload = function() { var l = document.getElementById('fl-loading'); if (l) l.classList.add('hidden'); };
    document.getElementById('fl-container').appendChild(iframe);
  } else {
    var l = document.getElementById('fl-loading'); if (l) l.classList.add('hidden');
  }
}
function closeResa() { document.getElementById('modal-resa').classList.remove('open'); }

function openCours(vid, title, cardId) {
  document.getElementById('cours-title').textContent = title;
  document.getElementById('cours-iframe').src = 'https://player.vimeo.com/video/' + vid + '?autoplay=1';
  document.getElementById('modal-cours').classList.add('open');
  try { localStorage.setItem('seen_' + cardId, '1'); } catch(e) {}
  if (clientRecord) {
    atCreate('Cours_vus', { 'Video_id': vid, 'Client': [clientRecord.id], 'Date_vue': new Date().toISOString() });
  }
  var card = document.getElementById(cardId);
  var badge = document.getElementById('seen-' + cardId);
  if (card) card.classList.add('seen');
  if (badge) badge.style.display = 'flex';
}
function closeCours() {
  document.getElementById('modal-cours').classList.remove('open');
  document.getElementById('cours-iframe').src = '';
}

function copyStory() {
  var txt = "Shooting day avec l equipe Septup ! 🎬\n#septup #contenu #tournage #lyon @septup_studio";
  try { navigator.clipboard.writeText(txt); } catch(e) {}
  var btn = document.getElementById('copy-btn');
  btn.textContent = 'Copie !';
  setTimeout(function() { btn.textContent = 'Copier le texte'; }, 2000);
}

// ═══ AIRTABLE (via proxy serveur /api/airtable) ═══
async function atFetch(table, filter, sort) {
  var params = [];
  if (filter) params.push('filterByFormula=' + encodeURIComponent(filter));
  if (sort) params.push(sort);
  var res = await fetch('/api/airtable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'GET', table: table, params: params.join('&') })
  });
  var data = await res.json();
  if (data.error) console.error('[atFetch]', table, data.error);
  return data.records || [];
}

async function atCreate(table, fields) {
  var res = await fetch('/api/airtable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'POST', table: table, fields: fields })
  });
  var rec = await res.json();
  if (rec.error) console.error('[atCreate]', table, rec.error);
  return rec;
}

async function atDelete(table, recordId) {
  var res = await fetch('/api/airtable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'DELETE', table: table, recordId: recordId })
  });
  if (!res.ok) console.error('[atDelete]', table, recordId, '| status:', res.status);
}

// ═══ DATA LOADING ═══
async function loadClientData(email) {
  var records = await atFetch('Client', '{Email}="' + email + '"');
  return records.length ? records[0] : null;
}

async function loadSessions(email) {
  var filter = encodeURIComponent('{Email_reservation}="' + email + '"');
  var params = 'filterByFormula=' + filter + '&sort[0][field]=Date&sort[0][direction]=desc';
  var res = await fetch('/api/airtable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'GET', table: 'Réservation', params: params })
  });
  var data = await res.json();
  return data.records || [];
}

async function loadScripts(clientId, email) {
  var filter = email ? '{Email_client}="' + email + '"' : 'FALSE()';
  var records = await atFetch('Scripts', filter, 'sort[0][field]=Date_creation&sort[0][direction]=desc');
  scriptsStore = {};
  scriptsLoaded = false;
  var months = ['jan.','fev.','mars','avr.','mai','juin','juil.','aout','sep.','oct.','nov.','dec.'];
  records.forEach(function(r) {
    var f = r.fields;
    var d = f['Date_creation'] ? new Date(f['Date_creation']) : new Date();
    var dateStr = d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    var statut = f['Statut'] || 'Brouillon';
    var statusMap = { 'Validé': 'st-valid', 'Utilisé': 'st-used', 'Brouillon': 'st-draft', 'Tourné': 'st-tourne', 'Tourne': 'st-tourne' };
    var getStatus = function(statut) {
      if (!statut) return 'st-draft';
      var s = statut.toLowerCase().replace(/[éè]/g, 'e');
      if (s === 'tourne') return 'st-tourne';
      if (s === 'valide') return 'st-valid';
      if (s === 'utilise') return 'st-used';
      return statusMap[statut] || 'st-draft';
    };
    scriptsStore[r.id] = {
      title: f['Titre'] || 'Sans titre',
      content: f['Contenu'] || '',
      meta: (f['Format'] || '') + ' · ' + (f['Angle'] || '') + ' · ' + dateStr,
      status: getStatus(statut),
      statusLabel: statut,
      airtableId: r.id
    };
  });
  scriptsLoaded = true;
  renderScriptsList();
  var el = document.getElementById('home-nb-scripts');
  if (el) el.textContent = records.length;
  // Met à jour le widget "Vidéos tournées" depuis les données réelles Airtable
  updateHomeTourneCount();
}

// ═══ RENDER ═══
function renderAll(client, email) {
  var f = client.fields;
  var nom = (f['Nom_complet'] || email).split(' ')[0];
  var pts = f['Pnts_fidelite'] || 0;
  var palier = f['Niv_fidelite_badge'] || 'Bronze';
  var initials = (f['Nom_complet'] || email).split(' ').map(function(w) { return w[0] || ''; }).slice(0,2).join('').toUpperCase();
  var seuils = { 'Bronze': [0,600], 'Silver': [600,1200], 'Gold': [1200,2000] };
  var range = seuils[palier] || [0,600];
  var pct = Math.min(100, Math.round(((pts - range[0]) / (range[1] - range[0])) * 100));
  var nextLbl = palier === 'Bronze' ? 'Silver a 600 pts' : palier === 'Silver' ? 'Gold a 1200 pts' : 'Palier max';

  // Home
  var el;
  el = document.getElementById('home-name'); if (el) el.textContent = nom + ' 👋';
  el = document.getElementById('home-pts'); if (el) el.textContent = pts;
  el = document.getElementById('home-palier'); if (el) el.textContent = palier;
  el = document.getElementById('home-bar'); if (el) el.style.width = pct + '%';
  el = document.getElementById('home-bar-left'); if (el) el.textContent = palier + ' · ' + pts + ' pts';
  el = document.getElementById('home-bar-right'); if (el) el.textContent = nextLbl;
  // Mettre à jour tous les avatars de l'app
  document.querySelectorAll('.av').forEach(function(av) { av.textContent = initials; });

  // Points
  el = document.getElementById('pts-big'); if (el) el.textContent = pts;
  el = document.getElementById('pts-lbl'); if (el) el.textContent = 'points · Palier ' + palier;
  el = document.getElementById('pts-bar'); if (el) el.style.width = pct + '%';
  el = document.getElementById('pts-bar-left'); if (el) el.textContent = pts + ' pts';
  var ptsDiff = palier === 'Bronze' ? 600 - pts : palier === 'Silver' ? 1200 - pts : 0;
  el = document.getElementById('pts-bar-right'); if (el) el.textContent = ptsDiff > 0 ? nextLbl.replace('a ', 'dans ' + ptsDiff + ' pts - ') : 'Palier maximum';
  ['bronze','silver','gold'].forEach(function(p) { var c = document.getElementById('pal-' + p); if (c) c.classList.remove('active'); });
  var palierEl = document.getElementById('pal-' + palier.toLowerCase()); if (palierEl) palierEl.classList.add('active');

  // Compte
  el = document.getElementById('compte-av'); if (el) el.textContent = initials;
  el = document.getElementById('compte-name'); if (el) el.textContent = f['Nom_complet'] || email;
  el = document.getElementById('compte-email'); if (el) el.textContent = email;
  el = document.getElementById('compte-palier'); if (el) el.textContent = palier;
  el = document.getElementById('compte-palier2'); if (el) el.textContent = palier;
  el = document.getElementById('sess-av'); if (el) el.textContent = initials;
  renderAdnSection();
}

function renderSessions(records) {
  if (!records || !Array.isArray(records)) {
    var p = document.getElementById('sess-passees');
    if (p) p.innerHTML = '<div style="padding:20px 16px;font-size:13px;color:var(--red);">Erreur de chargement des sessions</div>';
    return;
  }
  var now = new Date();
  var months = ['jan.','fev.','mars','avr.','mai','juin','juil.','aout','sep.','oct.','nov.','dec.'];
  var passees = records.filter(function(r) { return new Date(r.fields['Date']) < now; });
  var avenir = records.filter(function(r) { return new Date(r.fields['Date']) >= now; });

  function makeCard(r, isUp) {
    var f = r.fields;
    var d = new Date(f['Date']);
    var dateStr = d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    var formule = f['Formule choisi'] || '';
    var duree = f['Durée'] || f['Duree'] || 1;
    var pts = formule === 'Essentielle' ? duree * 75 : duree * 60;
    var tag = isUp ? '<div class="tag-up">A venir</div>' : '<div class="tag-done">Termine</div>';
    return '<div class="sblock"><div class="sblock-hdr" onclick="toggleFiles(this)">'
      + '<div><div class="sb-date">' + dateStr + '</div><div class="sb-meta">Formule ' + formule + ' · ' + duree + 'h</div></div>'
      + '<div class="sb-r"><div class="sb-pts">+' + pts + ' pts</div>' + tag + '</div>'
      + '</div><div class="sfiles"><div style="font-size:12px;color:var(--text3);">Fichiers disponibles prochainement</div></div></div>';
  }

  var passEl = document.getElementById('sess-passees');
  var avenirEl = document.getElementById('sess-avenir');
  var emptyPassees = '<div style="padding:32px 16px;text-align:center;">'
    + '<div style="font-size:17px;font-weight:700;margin-bottom:8px;">Aucune session pass\u00e9e</div>'
    + '<div style="font-size:13px;color:var(--text3);margin-bottom:20px;">Pas encore de tournage \u00e0 ton actif. Il faut bien commencer quelque part.</div>'
    + '<button class="btn" onclick="openResa()" style="width:auto;padding:13px 24px;"><span class="btn-txt">R\u00e9server une session</span><span class="btn-arr">\u2192</span></button>'
    + '</div>';
  var emptyAvenir = '<div style="padding:32px 16px;text-align:center;">'
    + '<div style="font-size:17px;font-weight:700;margin-bottom:8px;">Aucune session pr\u00e9vue</div>'
    + '<div style="font-size:13px;color:var(--text3);margin-bottom:20px;">Ton agenda studio est un peu trop calme l\u00e0\u2026 on r\u00e9serve \u00e7a\u00a0?</div>'
    + '<button class="btn" onclick="openResa()" style="width:auto;padding:13px 24px;"><span class="btn-txt">R\u00e9server une session</span><span class="btn-arr">\u2192</span></button>'
    + '</div>';
  if (passEl) passEl.innerHTML = passees.length ? passees.map(function(r) { return makeCard(r, false); }).join('') : emptyPassees;
  if (avenirEl) avenirEl.innerHTML = avenir.length ? avenir.map(function(r) { return makeCard(r, true); }).join('') : emptyAvenir;

  // Mettre à jour home
  var el = document.getElementById('home-nb-sess'); if (el) el.textContent = records.length;
  el = document.getElementById('home-sess-sub'); if (el) el.textContent = avenir.length + ' a venir';
  updateHomeHeures(records);

  // Historique des points
  var histEl = document.getElementById('pts-history');
  if (histEl) {
    if (passees.length === 0) {
      histEl.innerHTML = '<div class="lrow"><div><div class="lmotif" style="color:var(--text3);">Aucune session pour le moment</div></div></div>';
    } else {
      var histHtml = '';
      passees.slice(0, 5).forEach(function(r) {
        var f = r.fields;
        var d = new Date(f['Date']);
        var dateStr = d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
        var formule = f['Formule choisi'] || '';
        var duree = f['Durée'] || 1;
        var pts = formule === 'Essentielle' ? duree * 75 : duree * 60;
        histHtml += '<div class="lrow"><div><div class="lmotif">Session ' + formule + ' ' + duree + 'h</div><div class="ldate">' + dateStr + '</div></div><div class="lpts">+' + pts + '</div></div>';
      });
      histEl.innerHTML = histHtml;
    }
  }

  // Prochaines sessions — toutes listées
  var nextEl = document.getElementById('home-next-sessions');
  if (nextEl) {
    if (avenir.length === 0) {
      nextEl.innerHTML = '<div class="next-sess"><div class="tag-done">Aucune session a venir</div><div class="sess-date" style="font-size:14px;color:var(--text3);">Reserve ta prochaine session</div></div>';
    } else {
      var nextHtml = '';
      avenir.forEach(function(r) {
        var f = r.fields;
        var d = new Date(f['Date']);
        var dateStr = d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
        var hh = d.getHours();
        var mm = d.getMinutes() ? d.getMinutes() : '00';
        nextHtml += '<div class="next-sess" style="margin-bottom:10px;">'
          + '<div class="tag-up">A venir</div>'
          + '<div class="sess-date">' + dateStr + '</div>'
          + '<div class="sess-meta">🕐 ' + hh + 'h' + mm + ' · Formule ' + (f['Formule choisi'] || '') + ' · ' + (f['Durée'] || f['Duree'] || '') + 'h</div>'
          + '</div>';
      });
      nextEl.innerHTML = nextHtml;
    }
  }

  var el = document.getElementById('home-nb-sess'); if (el) el.textContent = records.length;
  el = document.getElementById('home-sess-sub'); if (el) el.textContent = avenir.length + ' a venir';

  if (avenir.length > 0) {
    var nextF = avenir[0].fields;
    var d = new Date(nextF['Date']);
    el = document.getElementById('home-next-sess'); if (el) el.textContent = d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    el = document.getElementById('home-next-meta'); if (el) el.textContent = 'Formule ' + (nextF['Formule choisi'] || '') + ' · ' + (nextF['Durée'] || nextF['Duree'] || '') + 'h';
  }
}

function renderScriptsList() {
  var list = document.getElementById('scripts-list');
  if (!list) return;
  var keys = Object.keys(scriptsStore);
  if (keys.length === 0) {
    if (!scriptsLoaded) {
      list.innerHTML = '<div style="padding:24px 16px;text-align:center;font-size:13px;color:var(--text3);">Chargement...</div>';
    } else {
      list.innerHTML = '<div style="padding:32px 16px;text-align:center;">'
        + '<div style="font-size:17px;font-weight:700;margin-bottom:8px;">Aucun script pour le moment</div>'
        + '<div style="font-size:13px;color:var(--text3);margin-bottom:20px;">Votre biblioth\u00e8que est encore vide. On cr\u00e9e le premier\u00a0?</div>'
        + '<button class="btn" onclick="openGen()" style="width:auto;padding:13px 24px;"><span class="btn-txt">G\u00e9n\u00e9rer un script</span><span class="btn-arr">\u2192</span></button>'
        + '</div>';
    }
    return;
  }
  var html = '';
  keys.forEach(function(id) {
    var s = scriptsStore[id];
    html += '<div class="script-card">'
      + '<div class="script-cb" id="cb-' + id + '" onclick="toggleScriptSel(this,\'' + id + '\')"></div>'
      + '<div class="script-info" onclick="openScriptById(\'' + id + '\')">'
      + '<div class="script-title">' + escapeHtml(s.title) + '</div>'
      + '<div class="script-meta">' + escapeHtml(s.meta) + '</div>'
      + '<div class="script-status ' + s.status + '">' + s.statusLabel + '</div>'
      + '</div>'
      + '<div class="script-arrow" onclick="openScriptById(\'' + id + '\')">›</div>'
      + '</div>';
  });
  list.innerHTML = html;
}

// ═══ SCRIPTS ═══
function openScriptById(id) {
  var s = scriptsStore[id];
  if (!s) return;
  // Fermer tout autre modal ouvert
  document.querySelectorAll('.modal-overlay.open').forEach(function(m) {
    if (m.id !== 'modal-editor') m.classList.remove('open');
  });
  currentEditorId = id;
  currentEditorText = s.content;
  document.getElementById('editor-title').textContent = s.title;
  document.getElementById('editor-ta').innerHTML = renderEditorContent(s.content);
  document.getElementById('modal-editor').classList.add('open');
  updateEditorVirality();
  // Activer le bon bouton de statut
  var labelToStatut = { 'st-draft': 'Brouillon', 'st-valid': 'Validé', 'st-tourne': 'Tourné' };
  if (typeof updateStatusBtns === 'function') updateStatusBtns(labelToStatut[s.status] || 'Brouillon');
}

function renderEditorContent(raw) {
  if (!raw) return '';
  var lines = raw.split('\n');
  var html = '';
  lines.forEach(function(line) {
    if (isSectionLabel(line)) {
      html += '<span class="script-section-title">' + escapeHtml(line.trim()) + '</span>\n';
    } else {
      html += escapeHtml(line) + '\n';
    }
  });
  return html;
}

function getEditorText() {
  var el = document.getElementById('editor-ta');
  return el ? (el.innerText || el.textContent || '') : '';
}

function copyScriptContent() {
  var text = getEditorText();
  try { navigator.clipboard.writeText(text); } catch(e) {}
  var btn = document.getElementById('copy-script-btn');
  btn.textContent = 'Copie !';
  setTimeout(function() { btn.textContent = 'Copier le script'; }, 2000);
}

async function deleteCurrentScript() {
  if (!currentEditorId) return;
  if (!confirm('Supprimer ce script ? Action irreversible.')) return;
  var s = scriptsStore[currentEditorId];
  if (s && s.airtableId) {
    try { await atDelete('Scripts', s.airtableId); } catch(e) {}
  }
  delete scriptsStore[currentEditorId];
  selectedScripts = {};
  document.getElementById('export-bar').style.display = 'none';
  renderScriptsList();
  closeEditor();
}

async function saveEditor() {
  var title = document.getElementById('editor-title').textContent;
  var content = getEditorText();
  var score = document.getElementById('editor-vir-score').textContent;
  if (clientRecord) {
    var s = currentEditorId ? scriptsStore[currentEditorId] : null;
    if (s && s.airtableId) {
      // Mise a jour
      await fetch('/api/airtable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'PATCH', table: 'Scripts', recordId: s.airtableId, fields: { 'Contenu': content, 'Score_viralite': parseFloat(score) || 0 } })
      });
    } else {
      // Creation
      await atCreate('Scripts', {
        'Titre': title, 'Contenu': content,
        'Score_viralite': parseFloat(score) || 0,
        'Statut': 'Brouillon', 'Client': [clientRecord.id],
        'Email_client': currentUser ? currentUser.email : '',
        'Date_creation': new Date().toISOString()
      });
    }
    await loadScripts(clientRecord.id);
  }
  alert('Script sauvegarde !');
  closeEditor();
}

function toggleScriptSel(cb, id) {
  if (selectedScripts[id]) { delete selectedScripts[id]; cb.classList.remove('checked'); }
  else { selectedScripts[id] = true; cb.classList.add('checked'); }
  var count = Object.keys(selectedScripts).length;
  var bar = document.getElementById('export-bar');
  if (count > 0) { bar.style.display = 'flex'; document.getElementById('export-count').textContent = count + ' selectionne' + (count > 1 ? 's' : ''); }
  else { bar.style.display = 'none'; }
}

function exportScripts(fmt) {
  alert(Object.keys(selectedScripts).length + ' script(s) exporte(s) en ' + fmt.toUpperCase() + '.\n(Disponible en production)');
}

// Supprimer tous les scripts sélectionnés (dans le store local + Airtable)
async function deleteSelectedScripts() {
  var ids = Object.keys(selectedScripts);
  if (ids.length === 0) return;

  var msg = ids.length === 1
    ? 'Supprimer ce script ? Action irreversible.'
    : 'Supprimer ces ' + ids.length + ' scripts ? Action irreversible.';
  if (!confirm(msg)) return;

  // Désactiver le bouton pendant la suppression
  var btn = document.querySelector('.export-btns button:last-child');
  if (btn) { btn.textContent = '...'; btn.style.pointerEvents = 'none'; }

  var errors = 0;
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var s = scriptsStore[id];
    // Supprimer dans Airtable si le script a un ID Airtable
    if (s && s.airtableId) {
      try {
        await atDelete('Scripts', s.airtableId);
      } catch(e) {
        errors++;
        console.error('Erreur suppression Airtable:', id, e);
      }
    }
    // Supprimer du store local dans tous les cas
    delete scriptsStore[id];
  }

  // Réinitialiser la sélection
  selectedScripts = {};
  document.getElementById('export-bar').style.display = 'none';

  // Rafraîchir la liste et les compteurs
  renderScriptsList();
  updateHomeTourneCount();
  var el = document.getElementById('home-nb-scripts');
  if (el) el.textContent = Object.keys(scriptsStore).length;

  if (errors > 0) {
    alert(errors + ' erreur(s) lors de la suppression Airtable. Les scripts ont ete retires de la liste.');
  }
}

// ═══ VIRALITY ═══
function computeVirality(text) {
  var score = 4.5;
  var tips = [];
  if (text.includes('ACCROCHE')) { score += 1; } else { tips.push('Ajoute une section ACCROCHE forte'); }
  if (text.includes('CTA')) { score += 1; } else { tips.push('Ajoute un CTA clair'); }
  if (text.includes('CORPS')) score += 0.5;
  if (text.includes('CONCLUSION')) score += 0.5;
  if (/\d+%|\d+ fois|\d+ jours/.test(text)) { score += 1; } else { tips.push('Ajoute des chiffres concrets'); }
  if (/vous |votre |tu |ton |ta /i.test(text)) score += 0.5;
  if (/→|•|✓/.test(text)) score += 0.5;
  if (text.length > 400) score += 0.5;
  score = Math.min(10, Math.max(1, Math.round(score * 10) / 10));
  var grade = score >= 8.5 ? 'Excellent' : score >= 7 ? 'Bon' : score >= 5 ? 'Moyen' : 'Faible';
  return { score: score, tip: tips.length > 0 ? tips[0] : 'Script solide !', grade: grade };
}

function onEditorChange() {
  if (editorTimer) clearTimeout(editorTimer);
  editorTimer = setTimeout(function() {
    updateEditorVirality();
    autoSaveEditor();
  }, 800);
}

async function autoSaveEditor() {
  if (!clientRecord || !currentEditorId) return;
  var content = getEditorText();
  if (!content.trim()) return;
  var score = document.getElementById('editor-vir-score').textContent;
  var statusEl = document.getElementById('autosave-status');
  
  var s = scriptsStore[currentEditorId];
  if (s && s.airtableId) {
    if (statusEl) statusEl.textContent = 'Sauvegarde...';
    try {
      await fetch('/api/airtable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'PATCH', table: 'Scripts', recordId: s.airtableId, fields: { 'Contenu': content, 'Score_viralite': parseFloat(score) || 0 } })
      });
      s.content = content;
      if (statusEl) statusEl.textContent = 'Sauvegardé ✓';
    } catch(e) {
      console.error('[autosave PATCH]', e);
      if (statusEl) statusEl.textContent = 'Erreur de sauvegarde';
    }
  } else if (s && !s.airtableId) {
    // Créer dans Airtable si pas encore sauvegardé
    if (!clientRecord) return;
    if (statusEl) statusEl.textContent = 'Sauvegarde...';
    try {
      var rec = await atCreate('Scripts', {
        'Titre': s.title, 'Contenu': content,
        'Score_viralite': parseFloat(score) || 0,
        'Statut': 'Brouillon', 'Client': [clientRecord.id],
        'Email_client': currentUser ? currentUser.email : '',
        'Date_creation': new Date().toISOString()
      });
      if (rec.id) {
        s.airtableId = rec.id;
        s.content = content;
        if (statusEl) statusEl.textContent = 'Sauvegardé ✓';
      }
    } catch(e) {
      console.error('[autosave CREATE]', e);
      if (statusEl) statusEl.textContent = 'Erreur de sauvegarde';
    }
  }
}

function updateEditorVirality() {
  var text = getEditorText();
  var r = computeVirality(text);
  document.getElementById('editor-vir-score').textContent = r.score.toFixed(1);
  document.getElementById('editor-vir-bar').style.width = (r.score * 10) + '%';
  document.getElementById('editor-vir-tip').textContent = r.tip;
  document.getElementById('editor-vir-grade').textContent = r.grade;
}

// ═══ GENERATION ═══
function openGen() {
  genStep = 1;
  genData = { sujet: '', objectif: '', format: '', style: '', selectedHook: '', precision: '', clarifications: [] };
  document.querySelectorAll('.gen-step').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById('gen-step-1').classList.add('active');
  document.getElementById('gen-footer').style.display = 'block';
  document.getElementById('gen-next-txt').textContent = 'Suivant';
  document.getElementById('gen-sujet').value = '';
  document.getElementById('modal-gen').classList.add('open');
  updateBackBtn();
}

function goToGenStep(n) {
  document.querySelectorAll('.gen-step').forEach(function(s) { s.classList.remove('active'); });
  var el = document.getElementById('gen-step-' + n);
  if (el) el.classList.add('active');
}
function closeGen() { document.getElementById('modal-gen').classList.remove('open'); if (msgTimer) clearInterval(msgTimer); stopVoiceInput(); }

// ─── VOICE INPUT (Whisper AI) ──────────────────────────────────
var _mediaRecorder = null;
var _audioChunks = [];
var _audioCtx = null;
var _waveAnimId = null;

function toggleVoiceInput() {
  if (_mediaRecorder && _mediaRecorder.state === 'recording') {
    _mediaRecorder.stop();
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
    _audioChunks = [];
    var mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
    _mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });

    _mediaRecorder.ondataavailable = function(e) {
      if (e.data.size > 0) _audioChunks.push(e.data);
    };

    _mediaRecorder.onstop = function() {
      stopWaveform();
      stream.getTracks().forEach(function(t) { t.stop(); });

      if (_audioChunks.length === 0) { setVoiceBtn('idle'); return; }

      setVoiceBtn('loading');
      var blob = new Blob(_audioChunks, { type: mimeType });
      var reader = new FileReader();
      reader.onloadend = function() {
        var base64 = reader.result.split(',')[1];
        fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: base64, mimeType: mimeType })
        })
        .then(function(r) {
          if (!r.ok) return r.text().then(function(t) { throw new Error(t); });
          return r.json();
        })
        .then(function(data) {
          if (data.text) {
            var ta = document.getElementById('gen-sujet');
            ta.value = (ta.value ? ta.value + ' ' : '') + data.text;
          } else if (data.error) {
            console.error('[transcribe]', data.error);
          }
          setVoiceBtn('idle');
        })
        .catch(function(err) {
          console.error('[transcribe]', err);
          setVoiceBtn('error');
        });
      };
      reader.readAsDataURL(blob);
    };

    _mediaRecorder.start();
    setVoiceBtn('recording');
    startWaveform(stream);
  }).catch(function() {
    alert('Impossible d\'accéder au micro. Vérifie les permissions.');
  });
}

function startWaveform(stream) {
  var wrap = document.getElementById('waveform-wrap');
  var canvas = document.getElementById('waveform-canvas');
  wrap.classList.add('active');
  canvas.width = canvas.offsetWidth || 300;

  _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  var source = _audioCtx.createMediaStreamSource(stream);
  var analyser = _audioCtx.createAnalyser();
  analyser.fftSize = 128;
  source.connect(analyser);

  var bufferLen = analyser.frequencyBinCount;
  var dataArray = new Uint8Array(bufferLen);
  var ctx = canvas.getContext('2d');
  var W = canvas.width;
  var H = canvas.height;
  var accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7FDAF7';

  function draw() {
    _waveAnimId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, W, H);

    var barCount = bufferLen;
    var gap = 2;
    var barW = (W - gap * (barCount - 1)) / barCount;

    for (var i = 0; i < barCount; i++) {
      var val = dataArray[i] / 255;
      var barH = Math.max(3, val * H * 0.9);
      var x = i * (barW + gap);
      var y = (H - barH) / 2;
      var alpha = 0.4 + val * 0.6;
      ctx.fillStyle = accentColor.startsWith('#')
        ? hexToRgba(accentColor, alpha)
        : accentColor;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, barW / 2);
      ctx.fill();
    }
  }
  draw();
}

function stopWaveform() {
  if (_waveAnimId) { cancelAnimationFrame(_waveAnimId); _waveAnimId = null; }
  if (_audioCtx) { try { _audioCtx.close(); } catch(e) {} _audioCtx = null; }
  var wrap = document.getElementById('waveform-wrap');
  var canvas = document.getElementById('waveform-canvas');
  if (wrap) wrap.classList.remove('active');
  if (canvas) { var ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
}

function hexToRgba(hex, alpha) {
  var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function setVoiceBtn(state) {
  var btn = document.getElementById('voice-btn');
  var txt = document.getElementById('voice-btn-txt');
  if (!btn) return;
  btn.classList.remove('recording', 'loading');
  btn.disabled = false;
  if (state === 'recording') {
    btn.classList.add('recording');
    txt.textContent = 'Arrêter';
  } else if (state === 'loading') {
    btn.classList.add('loading');
    btn.disabled = true;
    txt.textContent = 'Transcription...';
  } else if (state === 'error') {
    txt.textContent = 'Erreur — réessayer';
  } else {
    txt.textContent = 'Parler';
  }
}

function stopVoiceInput() {
  if (_mediaRecorder && _mediaRecorder.state === 'recording') {
    _mediaRecorder.stop();
  }
  _mediaRecorder = null;
  setVoiceBtn('idle');
}

// ─── IDEAS ────────────────────────────────────────────────────
var ideasData = { objectif: '', format: '' };
var _ideasList = [];

function openIdeas() {
  ideasData = { objectif: '', format: '' };
  document.getElementById('ideas-step-1').style.display = 'block';
  document.getElementById('ideas-step-2').style.display = 'none';
  document.querySelectorAll('#ideas-objectif-opts .gen-opt, #ideas-format-opts .gen-opt').forEach(function(o) { o.classList.remove('sel'); });
  document.getElementById('modal-ideas').classList.add('open');
}

function closeIdeas() { document.getElementById('modal-ideas').classList.remove('open'); }

function selIdeasOpt(el, key, val) {
  var containerId = 'ideas-' + key + '-opts';
  document.querySelectorAll('#' + containerId + ' .gen-opt').forEach(function(o) { o.classList.remove('sel'); });
  el.classList.add('sel');
  ideasData[key] = val;
}

async function generateIdeas() {
  document.getElementById('ideas-step-1').style.display = 'none';
  document.getElementById('ideas-step-2').style.display = 'block';
  document.getElementById('ideas-loading').style.display = 'block';
  document.getElementById('ideas-results').style.display = 'none';

  var objectifLabels = { vues: 'faire des vues', clients: 'attirer des clients', expertise: 'montrer son expertise', inspirer: 'inspirer' };
  var formatLabels = { facecam: 'face cam', storytelling: 'storytelling', educatif: 'educatif', opinion: 'opinion / point de vue' };
  var objectifLabel = objectifLabels[ideasData.objectif] || '';
  var formatLabel = formatLabels[ideasData.format] || '';

  var objectifGuidance = {
    vues: 'Les idees doivent maximiser le potentiel viral : angles choc, contre-intuitifs, tension immediate, sujet qui divise ou surprend. Pense aux videos qui font reagir, partager, debattre.',
    clients: 'Les idees doivent attirer des prospects qualifies : problemes tres concrets de la cible, promesse de transformation claire, preuves de resultat. Chaque idee doit faire penser "c est exactement mon probleme".',
    expertise: 'Les idees doivent asseoir la credibilite professionnelle : opinions tranchees sur le metier, secrets que les experts ne partagent pas, verites contre-intuitives du secteur.',
    inspirer: 'Les idees doivent creer une connexion emotionnelle forte : moment de bascule personnel, lecon de vie inattendue, histoire qui change la perspective.'
  };
  var formatGuidance = {
    facecam: 'Format face cam — idees intimes et directes : confessions, opinions personnelles, le createur parle en son nom propre face camera.',
    storytelling: 'Format storytelling — idees qui permettent une narration : avant/apres, moment de verite, situation concrete vecue par le createur ou un client.',
    educatif: 'Format educatif — idees qui expliquent ou demystifient : mecanique cachee, comparaison surprenante, processus que personne ne comprend vraiment.',
    opinion: 'Format opinion — idees polarisantes : prise de position tranchee, affirmation que beaucoup contestent, angle que personne n ose defendre publiquement.'
  };

  var profil = '';
  if (clientRecord && clientRecord.fields) {
    var f = clientRecord.fields;
    var parts = [];
    if (f['Onboarding_secteur']) parts.push('Secteur : ' + f['Onboarding_secteur']);
    if (f['Onboarding_offre']) parts.push('Offre : ' + f['Onboarding_offre']);
    if (f['Onboarding_cible']) parts.push('Cible : ' + f['Onboarding_cible']);
    if (f['Onboarding_douleur']) parts.push('Probleme cible : ' + f['Onboarding_douleur']);
    if (f['Onboarding_transformation']) parts.push('Transformation : ' + f['Onboarding_transformation']);
    if (parts.length) profil = '\n\nPROFIL CREATEUR :\n' + parts.join('\n');
  }

  var prompt = 'MISSION :\nGenere exactement 5 idees de videos.'
    + (objectifLabel ? '\nObjectif : ' + objectifLabel : '')
    + (formatLabel ? '\nFormat : ' + formatLabel : '')
    + (objectifGuidance[ideasData.objectif] ? '\n\nCONTEXTE OBJECTIF : ' + objectifGuidance[ideasData.objectif] : '')
    + (formatGuidance[ideasData.format] ? '\nCONTEXTE FORMAT : ' + formatGuidance[ideasData.format] : '')
    + profil
    + '\n\nREGLES GENERALES :\n'
    + '- Langage naturel, parle, direct\n'
    + '- Angles que personne ne traite habituellement\n'
    + '- Chaque idee directement transformable en video\n'
    + '- Bases-toi sur le profil du createur si fourni\n\n'
    + 'IDEE 1, 2, 3 — Questions percutantes :\n'
    + '- Une seule question par idee\n'
    + '- Doit surprendre, faire reflechir, donner envie de cliquer\n'
    + '- Aucune question generique, pas de "comment faire..."\n\n'
    + 'IDEE 4, 5 — Autre format (affirmation forte, constat surprenant, declaration provocatrice) :\n'
    + '- Pas une question\n'
    + '- Une phrase directe et frappante qui annonce un point de vue ou une verite contre-intuitive\n\n'
    + 'FORMAT DE REPONSE (strict) :\n'
    + '###IDEE1###\n[question]\n\n###IDEE2###\n[question]\n\n###IDEE3###\n[question]\n\n###IDEE4###\n[affirmation ou constat]\n\n###IDEE5###\n[affirmation ou constat]';

  try {
    var res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 500, system: 'Tu es un expert en creation de contenu video viral.', messages: [{ role: 'user', content: prompt }] })
    });
    if (!res.ok) throw new Error('err');
    var data = await res.json();
    var text = data.content && data.content[0] ? data.content[0].text : '';
    if (!text) throw new Error('empty');
    showIdeasCards(text);
  } catch (e) {
    document.getElementById('ideas-loading').style.display = 'none';
    document.getElementById('ideas-cards').innerHTML = '<div style="color:var(--red);font-size:13px;text-align:center;padding:16px;">Erreur lors de la generation. Reessaie.</div>';
    document.getElementById('ideas-results').style.display = 'block';
  }
}

function showIdeasCards(rawText) {
  var ideas = [];
  var parts = rawText.split(/###IDEE\d+###/);
  parts.forEach(function(p) { var t = p.trim(); if (t && t.length > 5) ideas.push(t); });
  if (ideas.length < 2) {
    ideas = rawText.split(/\n\n+/).map(function(h) { return h.trim(); }).filter(function(h) { return h.length > 10; }).slice(0, 5);
  }
  _ideasList = ideas;
  var html = '';
  ideas.forEach(function(idea, i) {
    html += '<div class="idea-card" onclick="selectIdea(' + i + ')">'
      + escapeHtml(idea.trim())
      + '</div>';
  });
  document.getElementById('ideas-loading').style.display = 'none';
  document.getElementById('ideas-cards').innerHTML = html;
  document.getElementById('ideas-results').style.display = 'block';
}

function selectIdea(idx) {
  var text = _ideasList[idx];
  closeIdeas();

  var objectifMap = { vues: 'vues', clients: 'leads', expertise: 'autorite', inspirer: 'engagement' };
  var ideasFormatLabels = { facecam: 'face cam', storytelling: 'storytelling', educatif: 'educatif', opinion: 'opinion / point de vue' };

  genData = {
    sujet: text,
    objectif: objectifMap[ideasData.objectif] || 'vues',
    format: 'video60',
    style: 'hybride',
    selectedHook: '',
    precision: ideasFormatLabels[ideasData.format] ? 'Format video : ' + ideasFormatLabels[ideasData.format] : '',
    clarifications: []
  };
  var best = computeRecommendedStyles();
  if (best && best[0]) genData.style = best[0];

  genStep = 6;
  document.querySelectorAll('.gen-step').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById('gen-step-6').classList.add('active');
  document.getElementById('gen-footer').style.display = 'none';
  document.getElementById('gen-generating').style.display = 'block';
  document.getElementById('script-result').classList.remove('active');
  document.querySelector('#modal-gen .modal-title').textContent = 'Generation en cours...';
  document.getElementById('modal-gen').classList.add('open');

  startGenAnim();
  callAPI();
}
// ─────────────────────────────────────────────────────────────

function updateBackBtn() {
  var btn = document.getElementById('btn-back');
  if (btn) btn.style.display = (genStep === 1) ? 'none' : 'inline-flex';
}

function prevGenStep() {
  if (genStep === '1b') {
    genStep = 1;
    document.getElementById('gen-sujet').value = genData.sujet;
    document.getElementById('gen-next-txt').textContent = 'Suivant';
    goToGenStep(1);
  } else if (genStep === 2) {
    genStep = '1b';
    goToGenStep('1b');
  } else if (genStep === 3) {
    genStep = 2;
    document.querySelectorAll('#gen-step-2 .gen-opt').forEach(function(o) {
      o.classList.toggle('sel', o.getAttribute('data-value') === genData.objectif);
    });
    goToGenStep(2);
  } else if (genStep === 4) {
    genStep = 3;
    document.querySelectorAll('#gen-step-3 .gen-opt').forEach(function(o) {
      o.classList.toggle('sel', o.getAttribute('data-value') === genData.format);
    });
    goToGenStep(3);
  } else if (genStep === 5) {
    genStep = 4;
    document.getElementById('gen-next-txt').textContent = 'Suivant';
    renderRecommendedStyles();
    goToGenStep(4);
  } else if (genStep === '6h') {
    genStep = 5;
    document.getElementById('gen-footer').style.display = 'block';
    document.getElementById('btn-gen-next').style.display = '';
    document.getElementById('gen-next-txt').textContent = 'Generer ✦';
    var precEl = document.getElementById('gen-precision');
    if (precEl) precEl.value = genData.precision || '';
    genData.selectedHook = '';
    goToGenStep(5);
  }
  updateBackBtn();
}

function nextGenStep() {
  // Mode podcast — bypass du flow principal
  if (window._podcastMode) {
    var sujet = document.getElementById('gen-sujet').value;
    if (!sujet.trim()) { alert('Decris le sujet de ton episode !'); return; }
    genData.sujet = sujet;
    window._podcastMode = false;
    document.querySelector('#modal-gen .modal-title').textContent = 'Generer un script';
    document.getElementById('gen-sujet').placeholder = 'Ex: Pourquoi vos contenus ne ramenent aucun client...';
    genStep = 6;
    goToGenStep(6);
    document.getElementById('gen-footer').style.display = 'none';
    document.getElementById('gen-generating').style.display = 'block';
    document.getElementById('script-result').classList.remove('active');
    startGenAnim();
    callAPIPodcast(sujet);
    return;
  }
  if (genStep === 1) {
    genData.sujet = document.getElementById('gen-sujet').value.trim();
    if (!genData.sujet) { alert('Decris d abord le sujet !'); return; }
    genStep = '1b';
    document.querySelectorAll('.gen-step').forEach(function(s) { s.classList.remove('active'); });
    document.getElementById('gen-step-1b').classList.add('active');
    document.getElementById('gen-clarify-loading').style.display = 'block';
    document.getElementById('gen-clarify-content').style.display = 'none';
    document.getElementById('gen-next-txt').textContent = 'Suivant';
    generateClarifyingQuestions();
  } else if (genStep === '1b') {
    // Collecte des réponses (les vides sont ignorées)
    genData.clarifications = [];
    document.querySelectorAll('.clarify-item').forEach(function(item) {
      var q = item.getAttribute('data-question') || '';
      var a = (item.querySelector('.clarify-ta').value || '').trim();
      if (a) genData.clarifications.push({ q: q, a: a });
    });
    genStep = 2;
    goToGenStep(2);
  } else if (genStep === 2) {
    if (!genData.objectif) { alert('Choisis un objectif !'); return; }
    genStep = 3;
    goToGenStep(3);
  } else if (genStep === 3) {
    if (!genData.format) { alert('Choisis un format !'); return; }
    genStep = 4;
    renderRecommendedStyles();
    goToGenStep(4);
  } else if (genStep === 4) {
    if (!genData.style) { alert('Choisis un style !'); return; }
    genStep = 5;
    goToGenStep(5);
    document.getElementById('gen-next-txt').textContent = 'Generer ✦';
    var precEl = document.getElementById('gen-precision');
    if (precEl) precEl.value = '';
  } else if (genStep === 5) {
    genData.precision = (document.getElementById('gen-precision').value || '').trim();
    genStep = '6h';
    document.querySelectorAll('.gen-step').forEach(function(s) { s.classList.remove('active'); });
    document.getElementById('gen-step-6h').classList.add('active');
    document.getElementById('gen-footer').style.display = 'none';
    document.getElementById('gen-hooks-generating').style.display = 'block';
    document.getElementById('gen-hooks-result').style.display = 'none';
    document.getElementById('btn-continue-hook').style.display = 'none';
    generateHooksOnly();
  }
  updateBackBtn();
}

function startGenAnim() {
  msgIdx = 0;
  document.getElementById('gen-anim-txt').textContent = genMsgs[0];
  msgTimer = setInterval(function() { msgIdx = (msgIdx + 1) % genMsgs.length; document.getElementById('gen-anim-txt').textContent = genMsgs[msgIdx]; }, 1800);
}

// ─────────────────────────────────────────────────────────────
// GÉNÉRATION DES 4 HOOKS + SÉLECTION
// ─────────────────────────────────────────────────────────────
async function generateHooksOnly() {
  var sk = genData.style || 'hybride';
  var formatLabels = { video30: 'Video courte 30s', video60: 'Video courte 60s', linkedin: 'Post LinkedIn', ads: 'Script publicitaire' };
  var objectifLabels = { vues: 'Maximiser les vues', engagement: 'Creer de l engagement', leads: 'Generer des prospects', vente: 'Vendre une offre', autorite: 'Renforcer l image d expert' };
  var styleLabel = STYLE_LIBRARY[sk] ? STYLE_LIBRARY[sk].label : sk;

  var prompt = 'MISSION :\n'
    + 'Genere EXACTEMENT 4 hooks ultra efficaces pour capter l attention dans les 1 a 3 premieres secondes et arreter le scroll. Le hook dois donner envie de continuer à regarder la video, il dois intriguer le viewers.\n\n'
    + '---\n\n'
    + 'CONTEXTE :\n\n'
    + 'Sujet : ' + genData.sujet + '\n'
    + 'Format : ' + (formatLabels[genData.format] || genData.format) + '\n'
    + 'Objectif : ' + (objectifLabels[genData.objectif] || genData.objectif) + '\n'
    + 'Style : ' + styleLabel + '\n';
  if (genData.precision) prompt += 'Precision : ' + genData.precision + '\n';

  if (clientRecord && clientRecord.fields) {
    var f = clientRecord.fields;
    var profil = [];
    if (f['Onboarding_secteur']) profil.push('Secteur : ' + f['Onboarding_secteur']);
    if (f['Onboarding_cible'])   profil.push('Cible : ' + f['Onboarding_cible']);
    if (f['Onboarding_offre'])   profil.push('Offre : ' + f['Onboarding_offre']);
    if (profil.length) prompt += '\nPROFIL CREATEUR :\n' + profil.join('\n') + '\n';
  }

  if (genData.clarifications && genData.clarifications.length) {
    prompt += '\nCONTEXTE UTILISATEUR :\n';
    genData.clarifications.forEach(function(c) { prompt += '- ' + c.q + ' : ' + c.a + '\n'; });
  }

  prompt += '\n---\n\n'
    + 'PRINCIPE D UN BON HOOK :\n\n'
    + 'Un bon hook doit :\n'
    + '- rendre le sujet immediatement clair\n'
    + '- creer une curiosite forte (envie de continuer)\n'
    + '- parler directement au spectateur (tu / ton)\n'
    + '- donner une promesse implicite de valeur\n\n'
    + '---\n\n'
    + 'VARIATION OBLIGATOIRE :\n\n'
    + 'Avant de generer, identifie 4 angles DIFFERENTS.\n\n'
    + 'Exemples d angles possibles :\n'
    + '- une erreur frequente\n'
    + '- une croyance fausse\n'
    + '- une frustration precise\n'
    + '- un resultat surprenant\n'
    + '- une situation vecue\n\n'
    + 'Chaque hook doit etre base sur un angle DIFFERENT.\n\n'
    + '---\n\n'
    + 'REGLES DE CREATION :\n\n'
    + '- Parle directement au spectateur (tu / ton)\n'
    + '- Cree un contraste (ex : ce que tu fais vs ce que tu devrais faire)\n'
    + '- Utilise si pertinent :\n'
    + '  - chiffres\n'
    + '  - details precis\n'
    + '  - situations concretes\n\n'
    + '- Le hook doit etre comprehensible en moins de 2 secondes\n'
    + '- Aucune phrase complexe ou floue\n'
    + '- Aucune introduction inutile\n\n'
    + '---\n\n'
    + 'INTERDICTIONS :\n\n'
    + '- aucun hook generique\n'
    + '- pas de "90% des gens..."\n'
    + '- pas de phrases applicables a toutes les niches\n'
    + '- pas de blabla\n'
    + '- pas de clickbait mensonger\n\n'
    + '---\n\n'
    + 'TEST QUALITE (OBLIGATOIRE) :\n\n'
    + 'Pour chaque hook :\n'
    + '- est-ce que le sujet est clair immediatement ?\n'
    + '- est-ce que ca donne envie de continuer ?\n'
    + '- est-ce que c est specifique ?\n\n'
    + 'Si NON → recommence\n\n'
    + '---\n\n'
    + 'FORMAT DE REPONSE :\n\n'
    + '###HOOK1###\n...\n\n###HOOK2###\n...\n\n###HOOK3###\n...\n\n###HOOK4###\n...';

  try {
    var res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 700, system: buildSystemPrompt(sk), messages: [{ role: 'user', content: prompt }] })
    });
    if (!res.ok) throw new Error('err');
    var data = await res.json();
    var text = data.content && data.content[0] ? data.content[0].text : '';
    if (!text) throw new Error('empty');
    showHookOptions(text);
  } catch (e) {
    // Fallback : continuer sans hook présélectionné
    document.getElementById('gen-hooks-generating').style.display = 'none';
    var fallback = '<div style="color:var(--text2);font-size:13px;padding:8px 0">Impossible de generer les hooks. Tu peux continuer sans en selectionner un.</div>';
    document.getElementById('gen-hooks-list').innerHTML = fallback;
    document.getElementById('gen-hooks-result').style.display = 'block';
    document.getElementById('btn-continue-hook').style.display = 'block';
    genData.selectedHook = '';
  }
}

function showHookOptions(rawText) {
  // Parse ###HOOK1### ... ###HOOK2### ... ###HOOK3###
  var hooks = [];
  var parts = rawText.split(/###HOOK\d+###/);
  parts.forEach(function(p) { var t = p.trim(); if (t && t.length > 5) hooks.push(t); });
  // Fallback si le parsing echoue
  if (hooks.length < 2) {
    hooks = rawText.split(/\n\n+/).map(function(h) { return h.trim(); }).filter(function(h) { return h.length > 10; }).slice(0, 4);
  }
  document.getElementById('gen-hooks-generating').style.display = 'none';
  var html = '';
  hooks.forEach(function(h, i) {
    html += '<div class="hook-option" id="hook-opt-' + i + '" onclick="selectHookOption(this, ' + i + ')">'
      + '<div class="hook-option-num">Option ' + (i + 1) + '</div>'
      + '<div>' + escapeHtml(h.trim()) + '</div>'
      + '</div>';
  });
  document.getElementById('gen-hooks-list').innerHTML = html;
  document.getElementById('gen-hooks-result').style.display = 'block';
  document.getElementById('gen-footer').style.display = 'block';
  document.getElementById('btn-gen-next').style.display = 'none';
  updateBackBtn();
}

function selectHookOption(el, idx) {
  document.querySelectorAll('.hook-option').forEach(function(c) { c.classList.remove('sel'); });
  el.classList.add('sel');
  var txtEl = el.querySelectorAll('div');
  genData.selectedHook = txtEl.length > 1 ? txtEl[txtEl.length - 1].textContent.trim() : el.textContent.trim();
  document.getElementById('btn-continue-hook').style.display = 'block';
}

function continueWithHook() {
  document.querySelectorAll('.gen-step').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById('gen-step-6').classList.add('active');
  document.getElementById('gen-footer').style.display = 'none';
  document.getElementById('gen-generating').style.display = 'block';
  document.getElementById('script-result').classList.remove('active');
  var banner = document.getElementById('verify-banner');
  if (banner) banner.classList.remove('visible');
  genStep = 6;
  startGenAnim();
  callAPI(null, null);
}

// ─────────────────────────────────────────────────────────────
// QUESTIONS DE CLARIFICATION IA
// ─────────────────────────────────────────────────────────────
async function generateClarifyingQuestions() {
  // Système prompt léger : profil du créateur seulement
  var sys = 'Tu es un expert en creation de contenu video court (TikTok, Reels, YouTube Shorts, LinkedIn).';
  if (clientRecord) {
    var f = clientRecord.fields;
    if (f['Nom_complet'])        sys += ' Createur : ' + f['Nom_complet'] + '.';
    if (f['Onboarding_secteur']) sys += ' Secteur : ' + f['Onboarding_secteur'] + '.';
    if (f['Onboarding_cible'])   sys += ' Cible : ' + f['Onboarding_cible'] + '.';
    if (f['Onboarding_offre'])   sys += ' Offre : ' + f['Onboarding_offre'] + '.';
  }

  var prompt = 'Le createur veut faire un contenu sur ce sujet precis :\n\n'
    + '« ' + genData.sujet + ' »\n\n'
    + 'Genere ' + (genData.sujet.trim().split(/\s+/).length < 8 ? '4' : '3') + ' questions courtes et directes pour extraire des informations concretes sur CE sujet specifiquement.\n\n'
    + 'Chaque question doit viser a obtenir :\n'
    + '- un exemple reel ou une anecdote personnelle liee a CE sujet\n'
    + '- un chiffre, resultat ou fait precis sur CE sujet\n'
    + '- la position ou opinion du createur sur CE sujet\n'
    + '- le declencheur ou la cause racine de CE sujet\n\n'
    + 'Interdit : questions generiques non liees au sujet, questions sur la cible ou le format.\n\n'
    + 'FORMAT : ###Q1###\n[question]\n###Q2###\n[question]\n(etc.)';

  try {
    var res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 350, system: sys, messages: [{ role: 'user', content: prompt }] })
    });
    if (!res.ok) throw new Error('err');
    var data = await res.json();
    var text = data.content && data.content[0] ? data.content[0].text : '';
    if (!text) throw new Error('empty');
    showClarifyingQuestions(text);
  } catch (e) {
    // Fallback silencieux : sauter l étape
    skipClarify();
  }
}

function showClarifyingQuestions(rawText) {
  var questions = [];
  var parts = rawText.split(/###Q\d+###/);
  parts.forEach(function(p) { var t = p.trim(); if (t && t.length > 4) questions.push(t); });
  // Fallback si le parsing échoue
  if (questions.length === 0) { skipClarify(); return; }

  var html = '';
  questions.forEach(function(q, i) {
    html += '<div class="clarify-item" data-question="' + q.replace(/"/g, '&quot;') + '">'
      + '<div class="clarify-q-num">Question ' + (i + 1) + '</div>'
      + '<div class="clarify-q-txt">' + escapeHtml(q) + '</div>'
      + '<textarea class="clarify-ta" placeholder="Ta reponse..." rows="2"></textarea>'
      + '</div>';
  });

  document.getElementById('gen-clarify-questions').innerHTML = html;
  document.getElementById('gen-clarify-loading').style.display = 'none';
  document.getElementById('gen-clarify-content').style.display = 'block';
}

function skipClarify() {
  genData.clarifications = [];
  genStep = 2;
  goToGenStep(2);
}

// ─────────────────────────────────────────────────────────────
// BIBLIOTHEQUE DE STYLES — 9 styles narratifs
// ─────────────────────────────────────────────────────────────
var STYLE_LIBRARY = {
  edu:      { label: 'Educatif',      desc: 'Valeur immediate, pedagogie, retention maximale' },
  story:    { label: 'Storytelling',  desc: 'Narration addictive, tension, declencheur emotionnel' },
  direct:   { label: 'Direct / Cash', desc: 'Verite brute, rythme eleve, zero fioriture' },
  autorite: { label: 'Autorite',      desc: 'Expert qui decrypte, credibilite, insights rares' },
  vente:    { label: 'Vente',         desc: 'Probleme, agitation, solution, passage a l action' },
  temo:     { label: 'Temoignage',    desc: 'Resultat reel, narration vivante, preuve sociale' },
  avis:     { label: 'Avis tranche',  desc: 'Position forte, debat, opinion qui divise' },
  cas:      { label: 'Etude de cas',  desc: 'Contexte, probleme, action, resultat, lecon' },
  hybride:  { label: 'Hybride',       desc: 'Hook + insight + story + lecon — le plus polyvalent' }
};

// Mapping format → styles compatibles
var STYLE_FORMAT_COMPAT = {
  video30: ['edu', 'story', 'direct', 'avis', 'temo', 'hybride'],
  video60: ['edu', 'story', 'direct', 'autorite', 'avis', 'cas', 'temo', 'hybride', 'vente'],
  linkedin: ['edu', 'autorite', 'story', 'avis', 'cas', 'temo', 'hybride'],
  ads:     ['vente', 'temo', 'cas', 'direct', 'hybride']
};

// Mapping objectif → styles prioritaires
var STYLE_OBJECTIVE_PRIORITY = {
  vues:      ['avis', 'direct', 'story', 'hybride', 'edu'],
  engagement:['story', 'avis', 'temo', 'hybride', 'edu'],
  leads:     ['autorite', 'cas', 'temo', 'hybride', 'edu', 'vente'],
  vente:     ['vente', 'temo', 'cas', 'direct', 'hybride'],
  autorite:  ['autorite', 'edu', 'cas', 'hybride', 'avis']
};

// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// FRAMEWORKS — 9 styles narratifs complets
// ─────────────────────────────────────────────────────────────
var FRAMEWORKS = {
  edu: {
    label: 'Educatif',
    sections: ['HOOK', 'PROMESSE', 'MICRO-VALUE', 'REHOOK 1', 'DEMO', 'REHOOK 2', 'RESULTAT', 'CTA'],
    structure: 'HOOK → PROMESSE → MICRO-VALUE → REHOOK 1 → DEMO → REHOOK 2 → RESULTAT → CTA',
    logique: "Donner de la valeur TRES TOT pour eviter la fuite — reward immediat des les premieres secondes.",
    rules: [
      "Micro-value des les 5 premieres secondes : un insight concret, une info utile, un chiffre surprenant — le viewer doit deja avoir appris quelque chose avant le rehook.",
      "REHOOK 1 :  oblige a rester.",
      "REHOOK 2 : accelere la tension avant la resolution. Demo = cas concret ou etape actionnable. Resultat = benefice chiffre ou transformationnel. CTA = une seule action precise."
    ]
  },
  story: {
    label: 'Storytelling',
    sections: ['HOOK', 'SETUP', 'TENSION', 'REHOOK 1', 'ESCALADE', 'REHOOK 2', 'TWIST', 'RESOLUTION'],
    structure: 'HOOK → SETUP → TENSION → REHOOK 1 → ESCALADE → REHOOK 2 → TWIST → RESOLUTION',
    logique: "Chaque rehook = mini cliffhanger. Le viewer ne peut pas partir sans connaitre la suite.",
    rules: [
      "REHOOK 1 (apres tension) :pas une transition douce, un vrai choc narratif.",
      "REHOOK 2 (apres escalade) :suspense maximum avant le twist. Pause mentale obligatoire.",
      "Setup = UNE phrase max, contexte minimum. Twist = inattendu mais logique retrospectivement. Resolution = lecon ou resultat clair, jamais vague."
    ]
  },
  direct: {
    label: 'Direct / Cash',
    sections: ['HOOK', 'VERITE', 'REHOOK 1', 'EXPLICATION', 'REHOOK 2', 'SOLUTION', 'CTA'],
    structure: 'HOOK → VERITE → REHOOK 1 → EXPLICATION → REHOOK 2 → SOLUTION → CTA',
    logique: "Une verite tranchante toutes les 10 secondes. Pas de nuance, pas de politesse. Chaque phrase se tient seule.",
    rules: [
      "Verite = statement choc, assertion forte, jamais une question ouverte",
      "REHOOK 1 : enfoncer le clou, Phrase courte, impact maximal.",
      "Pas de conditionnel, pas de peut-etre, pas de 'on pourrait dire'. Solution = directe et actionnable. CTA = tranchant, une seule action."
    ]
  },
  autorite: {
    label: 'Autorite',
    sections: ['HOOK', 'CONSTAT', 'REHOOK', 'DECRYPTAGE', 'PREUVE', 'SYNTHESE', 'CTA'],
    structure: 'HOOK → CONSTAT → REHOOK → DECRYPTAGE → PREUVE → SYNTHESE → CTA',
    logique: "Positionner le createur comme la reference incontournable de son domaine. Chaque section doit exsuder une expertise que personne d autre ne possede.",
    rules: [
      "Constat = observation contre-intuitive ou contre-courante — pas une evidence que tout le monde connait. ",
      "REHOOK : 'Et c est la que ca devient interessant.' — promesse que le decryptage va tout changer.",
      "Decryptage = la vraie valeur unique du createur, ce que 95% ne voient pas. Preuve = donnee precise, cas reel, experience vecue. CTA = invitation douce, pas injonction."
    ]
  },
  vente: {
    label: 'Vente',
    sections: ['HOOK', 'PROBLEME', 'REHOOK 1', 'AGITATION', 'REHOOK 2', 'SOLUTION', 'PREUVE', 'CTA'],
    structure: 'HOOK → PROBLEME → REHOOK 1 → AGITATION → REHOOK 2 → SOLUTION → PREUVE → CTA',
    logique: "Alternance douleur / espoir = maintien d attention. Le viewer doit sentir la douleur avant de vouloir la solution.",
    rules: [
      "REHOOK 1 (apres probleme) : intensifier Pas d espoir encore.",
      "REHOOK 2 (apres agitation) : pivot espoir puis la solution arrive comme un soulagement.",
      "Agitation = cout de l inaction, pas juste nommer le probleme. Preuve = chiffre precis + delai reel + resultat client — rien de vague. CTA = urgence reelle, une seule action."
    ]
  },
  temo: {
    label: 'Temoignage',
    sections: ['HOOK', 'AVANT', 'REHOOK 1', 'EXPERIENCE', 'REHOOK 2', 'RESULTAT', 'VALIDATION'],
    structure: 'HOOK → AVANT → REHOOK 1 → EXPERIENCE → REHOOK 2 → RESULTAT → VALIDATION',
    logique: "Narration vivante et specifique — pas un temoignage plat et corporate. Le personnage doit etre identifiable.",
    rules: [
      "Commence par un hint du resultat ou une question sur le resultat — pas par la presentation du probleme. Le viewer doit vouloir savoir comment on est arrive la.",
      "REHOOK 1 : suspense narratif. Personnage clairement identifiable, situation precise.",
      "REHOOK 2 :  Resultat = CONCRET avec chiffres si possible (pas 'ca a bien marche'). Validation = recommandation directe et sincere, pas corporate."
    ]
  },
  avis: {
    label: 'Avis tranche',
    sections: ['HOOK', 'POSITION', 'REHOOK 1', 'JUSTIFICATION', 'REHOOK 2', 'EXEMPLE', 'CONCLUSION', 'CTA'],
    structure: 'HOOK → POSITION → REHOOK 1 → JUSTIFICATION → REHOOK 2 → EXEMPLE → CONCLUSION → CTA',
    logique: "Provoquer une reaction, pas juste informer. La position doit diviser — ceux qui sont d accord et ceux qui ne le sont pas.",
    rules: [
      "Position = statement tranche, pas nuance.",
      "REHOOK 1 : anticiper l objection puis la retourner. REHOOK 2 : exemple concret qui ecrase le doute.",
      "Justification = factuelle et specifique, pas emotionnelle. CTA = provoquer une reaction : commentaire, desaccord bienvenu, partage."
    ]
  },
  cas: {
    label: 'Etude de cas',
    sections: ['HOOK', 'CONTEXTE', 'PROBLEME', 'REHOOK', 'ACTION', 'RESULTAT', 'LECON', 'CTA'],
    structure: 'HOOK → CONTEXTE → PROBLEME → REHOOK → ACTION → RESULTAT → LECON → CTA',
    logique: "Raconter un cas reel avec des details specifiques — le viewer doit pouvoir s identifier et voir comment reproduire le resultat.",
    rules: [
      "Contexte = 1-2 phrases max, juste assez pour que l audience s identifie. Pas de biographie, pas d introduction.",
      "REHOOK (apres probleme) : Tension narrative maintenue.",
      "Action = etapes reelles et specifiques — pas des generalites. Resultat = chiffre, date, delai precis. Lecon = extractible, actionnable par le viewer."
    ]
  },
  hybride: {
    label: 'Hybride',
    sections: ['HOOK', 'INSIGHT', 'REHOOK 1', 'STORY', 'REHOOK 2', 'LECON', 'CTA'],
    structure: 'HOOK → INSIGHT → REHOOK 1 → STORY → REHOOK 2 → LECON → CTA',
    logique: "Melange educatif + storytelling + persuasion. Le meilleur format pour 2026 — cree une connexion ET delivre de la valeur.",
    rules: [
      "Insight = observation contre-intuitive et immediate — la valeur qui justifie de rester. Pas un recap, une vraie revelation courte.",
      "REHOOK 1 :  Story = UNE mini anecdote concrete : client reel / perso / cas public — une scene precise, pas un resume.",
      "REHOOK 2 : Puis la lecon. Lecon = conseil concret et actionnable, extractible en 1 phrase. Pas philosophique."
    ]
  }
};

// ─────────────────────────────────────────────────────────────
// RÈGLES INVISIBLES — niveau expert, toujours injectées
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// MOTEUR DE RECOMMANDATION DE STYLES
// ─────────────────────────────────────────────────────────────
function computeRecommendedStyles() {
  var format = genData.format;
  var objectif = genData.objectif;
  var profil = clientRecord ? clientRecord.fields : {};
  var ton = (profil['Onboarding_ton'] || '').toLowerCase();
  var intensite = (profil['Onboarding_intensite'] || '').toLowerCase();
  var langage = (profil['Onboarding_langage'] || '').toLowerCase();
  var maturite = (profil['Onboarding_maturite'] || '').toLowerCase();

  // Etape A : styles compatibles avec le format
  var compatible = STYLE_FORMAT_COMPAT[format] || Object.keys(STYLE_LIBRARY);

  // Etape B : score selon l objectif
  var priority = STYLE_OBJECTIVE_PRIORITY[objectif] || [];
  var scores = {};
  compatible.forEach(function(s) { scores[s] = 0; });
  priority.forEach(function(s, i) {
    if (scores[s] !== undefined) scores[s] += (priority.length - i) * 2;
  });

  // Etape C : ajustement selon profil
  function boost(keys, val) { keys.forEach(function(s) { if (scores[s] !== undefined) scores[s] += val; }); }

  if (ton.indexOf('serieux') >= 0 || ton.indexOf('professionnel') >= 0) {
    boost(['direct','avis'], -2); boost(['autorite','edu','cas','temo'], 1);
  }
  if (ton.indexOf('premium') >= 0 || ton.indexOf('inspire') >= 0) {
    boost(['direct'], -1); boost(['story','autorite','hybride','temo'], 1);
  }
  if (ton.indexOf('provocateur') >= 0 || ton.indexOf('direct') >= 0) {
    boost(['direct','avis','vente'], 2);
  }
  if (ton.indexOf('inspirant') >= 0 || ton.indexOf('humain') >= 0) {
    boost(['story','temo','hybride'], 1); boost(['vente'], -1);
  }
  if (ton.indexOf('fun') >= 0 || ton.indexOf('accessible') >= 0) {
    boost(['edu','story','hybride'], 1);
  }
  if (intensite.indexOf('calme') >= 0 || intensite.indexOf('pose') >= 0) {
    boost(['direct','avis'], -2); boost(['edu','autorite','story'], 1);
  }
  if (intensite.indexOf('energique') >= 0) {
    boost(['direct','hybride','avis'], 1);
  }
  if (intensite.indexOf('punchy') >= 0 || intensite.indexOf('impactant') >= 0) {
    boost(['direct','vente','avis','hybride'], 2);
  }
  if (langage.indexOf('simple') >= 0 || langage.indexOf('vulgar') >= 0) {
    boost(['edu','story','hybride','temo'], 1); boost(['autorite'], -1);
  }
  if (langage.indexOf('expert') >= 0 || langage.indexOf('technique') >= 0) {
    boost(['autorite','cas','edu'], 1); boost(['story'], -1);
  }
  if (maturite.indexOf('debut') >= 0) {
    boost(['edu','story','hybride'], 1); boost(['vente','avis','direct'], -1);
  }
  if (maturite.indexOf('avance') >= 0 || maturite.indexOf('expert') >= 0) {
    boost(['autorite','cas','vente','avis','hybride'], 1);
  }

  // Etape D : top 4 styles
  var sorted = Object.keys(scores).sort(function(a, b) { return scores[b] - scores[a]; });
  return sorted.slice(0, 4);
}

function renderRecommendedStyles() {
  var recommended = computeRecommendedStyles();
  var objectifReasons = {
    vues:       'fort potentiel de vues',
    engagement: 'ideal pour l engagement',
    leads:      'efficace pour generer des leads',
    vente:      'optimise pour la conversion',
    autorite:   'renforce votre image d expert'
  };
  var reason = objectifReasons[genData.objectif] || 'adapte a votre profil';
  var container = document.getElementById('gen-styles-list');
  if (!container) return;
  genData.style = '';
  var html = '';
  recommended.forEach(function(key) {
    var s = STYLE_LIBRARY[key];
    if (!s) return;
    html += '<div class="style-card" onclick="selStyle(this,\'' + key + '\')">'
      + '<div class="style-card-name">' + escapeHtml(s.label) + '</div>'
      + '<div class="style-card-desc">' + escapeHtml(s.desc) + '</div>'
      + '<div class="style-card-reason">Recommande — ' + reason + '</div>'
      + '</div>';
  });
  container.innerHTML = html;
}

function selStyle(el, key) {
  document.querySelectorAll('.style-card').forEach(function(c) { c.classList.remove('sel'); });
  el.classList.add('sel');
  genData.style = key;
}

var INVISIBLE_RULES = [
  "COURBE D'ATTENTION : Une video = une courbe. Pic (hook) → baisse → remontee (rehook) → baisse → remontee → fin forte. Sans rehooks = chute garantie. Visualise la courbe en ecrivant.",
  "RYTHME 5-8 SECONDES : Toutes les 5 a 8 secondes, tu dois SURPRENDRE, PROMETTRE ou RELANCER. Jamais de zone plate. Si une phrase n'apporte pas de tension ou de valeur, elle n'existe pas.",
  "BOUCLES OUVERTES : Plante des promesses en cours de route. 'Je t'explique ca a la fin.' / 'Le plus important arrive.' / 'Retiens bien ca.' Le cerveau reste accroche pour la resolution.",
  "MONTAGE PENSE : Chaque coupe = nouveau rehook. Chaque pause = impact. Ce script est ecrit pour etre tourne — anticipe les zooms, les silences, les gestes.",
  "DENSITE MAXIMALE : Pas un mot de trop. Chaque phrase justifie sa presence. Si elle peut etre coupee sans rien perdre, elle est coupee.",
  "ORAL AVANT TOUT : Lis a voix haute. Si ca sonne ecrit, recris. Contractions naturelles, phrases courtes, rythme oral. Zero jargon sauf si le profil l'exige explicitement."
];

// ─────────────────────────────────────────────────────────────
// buildSystemPrompt — v3 : profil + framework + hooks + regles
// ─────────────────────────────────────────────────────────────
function buildSystemPrompt(styleKey) {
  if (!clientRecord) return '';
  var f = clientRecord.fields;

  var parts = [

    "Script PARLé face caméra, comme si l'utilisateur faisait un vocal à un amie",
    "Chiffres absents du profil : marque [?]la donnee[/?]. Donnees du profil : utilisables directement.",
    "\nPROFIL :"
  ];

  if (f['Nom_complet'])               parts.push("Createur : " + f['Nom_complet']);
  if (f['Onboarding_secteur'])        parts.push("Secteur : " + f['Onboarding_secteur']);
  if (f['Onboarding_offre'])          parts.push("Offre : " + f['Onboarding_offre']);
  if (f['Onboarding_prix'])           parts.push("Prix : " + f['Onboarding_prix']);
  if (f['Onboarding_maturite'])       parts.push("Maturite : " + f['Onboarding_maturite']);
  if (f['Onboarding_cible'])          parts.push("Cible : " + f['Onboarding_cible']);
  if (f['Onboarding_douleur'])        parts.push("Douleur n1 : " + f['Onboarding_douleur']);
  if (f['Onboarding_transformation']) parts.push("Transformation : " + f['Onboarding_transformation']);
  if (f['Onboarding_objectif'])       parts.push("Objectif : " + f['Onboarding_objectif']);
  if (f['Onboarding_kpi'])            parts.push("KPI : " + f['Onboarding_kpi']);
  if (f['Onboarding_ton'])            parts.push("Ton : " + f['Onboarding_ton']);
  if (f['Onboarding_intensite'])      parts.push("Intensite : " + f['Onboarding_intensite']);
  if (f['Onboarding_langage'])        parts.push("Langage : " + f['Onboarding_langage']);

  if (f['ADN_profil']) {
    parts.push("\n=== ADN DE COMMUNICATION OBSERVE (PRIORITAIRE) ===");
    parts.push(f['ADN_profil']);
    parts.push("Ce profil est issu de vrais scripts. Il prime sur toutes les preferences declarees ci-dessus.");
  }

  return parts.join("\n");
}

// ─────────────────────────────────────────────────────────────
// callAPI — prompt 4 couches
// ─────────────────────────────────────────────────────────────
async function callAPI(prevScript, instruction) {
  var formatLabels = {
    video30: 'Video courte 30s (50 a 90 mots max — chaque mot compte, rythme tres eleve)',
    video60: 'Video courte 60s (110 a 180 mots — au moins un vrai rehook, structure nerveuse)',
    linkedin: 'Post LinkedIn (180 a 260 mots — premiere ligne forte, paragraphes courts, logique conservee)',
    ads:     'Script publicitaire (tension rapide, promesse claire, preuve credible, CTA direct — pas de digression)',
    podcast: 'Intro et Outro podcast (max 400 mots — chaleureux, naturel, fluide)'
  };
  var objectifLabels = {
    vues:       'Maximiser les vues',
    engagement: 'Creer de l engagement',
    leads:      'Generer des prospects',
    vente:      'Vendre une offre',
    autorite:   'Renforcer l image d expert'
  };

  var sk = genData.style || 'hybride';
  var fw = FRAMEWORKS[sk] || FRAMEWORKS['hybride'];
  var prompt;

  if (prevScript && instruction) {
    // Mode regeneration
    var styleLabel = STYLE_LIBRARY[sk] ? STYLE_LIBRARY[sk].label : sk;
    prompt = 'Script existant :\n\n' + prevScript
      + '\n\nInstruction de modification : ' + instruction
      + '\n\nApplique cette modification. Conserve le style ' + styleLabel + ' et la dynamique narrative : ' + fw.structure
      + '\n\nPas de labels de section. Direct, percutant, oral. Aucun effet template.';
  } else {
    // Generation initiale
    prompt = 'Sujet : ' + genData.sujet + '\n'
      + 'Objectif : ' + (objectifLabels[genData.objectif] || genData.objectif) + '\n'
      + 'Format : ' + (formatLabels[genData.format] || genData.format) + '\n';
    if (genData.precision) {
      prompt += 'Precision : ' + genData.precision + '\n';
    }
    if (genData.clarifications && genData.clarifications.length) {
      prompt += '\n=== CONTEXTE UTILISATEUR ===\n';
      genData.clarifications.forEach(function(c) {
        prompt += '- ' + c.q + ' : ' + c.a + '\n';
      });
    }
    if (genData.selectedHook) {
      prompt += '\nCommence exactement par ce hook (mot pour mot) :\n' + genData.selectedHook + '\n';
    }
    prompt += '\nHOOK : construis-le depuis le sujet et le profil, pas depuis un template.\n'
      + '• Fort : tension immediate, specificite concrete, casse une attente\n'
      + '• Faible : introduction, "aujourd hui on va voir", formule deja entendue\n'
      + '• Objectif : les 2 premieres secondes rendent impossible de scroller\n';
    prompt += '\nLogique interne (ne l affiche pas) : ' + fw.logique + '\n'
      + 'Sequence narrative : ' + fw.structure + '\n'
      + 'Applique cette dynamique de facon fluide et invisible — aucun label de section dans le script final.\n';
    prompt += '\nREGLES NARRATIVES :\n';
    INVISIBLE_RULES.forEach(function(r) { prompt += '• ' + r + '\n'; });
    prompt += '\nCONTRAINTES :\n'
      + '• Langage 100% parle : t as / c est / y a / j ai / on a — jamais de francais ecrit formel\n'
      + '• Zero formules IA : interdit "Bien sur", "Absolument", "En conclusion", "Il est important de noter"\n'
      + '• Phrases de longueurs variees — tres courtes pour l impact, un peu plus longues pour installer\n'
      + '• Transitions naturelles entre les moments — pas de coupures nettes\n'
      + '• Imperfections legeres bienvenues si elles sonnent vrai a l oral\n'
      + '• Longueur respectee selon le format — ni trop court ni trop long\n'
      + '• CTA unique, direct, une seule action\n'
      + '• Aucune phrase cliche, aucun ton "formation", aucune intro "aujourd hui on va parler de"\n'
      + '• VERIFICATION FAITS : tout chiffre ou resultat invente (absent du profil) marque [?]la donnee[/?]\n'
      + '\nTON HUMAIN :\n'
      + '• Ecris comme si tu parlais a une seule personne, face camera — pas a une audience, a quelqu un juste en face de toi\n'
      + '• Donne une sensation d improvisation controlee : fluide, vivant, jamais recite\n'
      + '• Evite toute formulation trop parfaite ou trop propre — une phrase un peu plus brute peut sonner plus vrai\n'
      + '• Tu peux casser legerement le rythme si ca rend le texte plus humain a l oral\n'
      + '• Si t as le choix entre naturel et structure : choisis naturel\n'
      + '\nTENSION & IMPACT :\n'
      + '• Cree du contraste des le debut (avant/apres, erreur/realite, croyance/verite)\n'
      + '• Evite les explications longues — privilegia les punchlines\n'
      + '• Le script doit faire ressentir un shift chez l auditeur\n'
      + '• Capte immediatement l attention et donne envie d ecouter jusqu au bout\n'
      + '\nPRIORITE ABSOLUE : naturel > structure, impact > perfection.\n'
      + 'Si le script est generique, trop propre ou ressemble a un template — recommence.\n'
      + '\nUTILISATION DU CONTEXTE UTILISATEUR :\n'
      + '• Analyse les reponses utilisateur fournies\n'
      + '• Utilise ces informations uniquement si elles apportent un contexte pertinent, concret ou differenciant\n'
      + '• Si une reponse permet de rendre le script plus specifique ou plus realiste → integre-la naturellement\n'
      + '• Si une reponse n apporte pas de valeur claire → ignore-la\n'
      + '• Ne jamais forcer l integration d une reponse si elle ne s integre pas naturellement\n'
      + '• Ne pas copier-coller les reponses → toujours reformuler\n'
      + '\nOBJECTIF :\n'
      + '• Le script doit sembler naturel et fluide\n'
      + '• Le contexte utilisateur doit enrichir le contenu, pas le rendre artificiel\n'
      + '• Profil createur : utilise le secteur, la cible et l offre pour adapter le script\n'
      + '• Le script doit etre coherent avec l activite du createur\n'
      + '• Qualite avant tout — ne pas raccourcir, simplifier ou sacrifier la precision pour economiser des tokens\n'
      + '\nFORMAT DU SCRIPT : une ligne vide entre chaque phrase ou groupe de 2-3 phrases courtes — ne jamais ecrire le script en bloc continu.\n'
      + '\nGenere uniquement le script.';
  }

  try {
    var res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, system: buildSystemPrompt(sk), messages: [{ role: 'user', content: prompt }] })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    var text = data.content && data.content[0] ? data.content[0].text : 'Erreur de generation.';
    showScript(text);
  } catch(e) {
    showScript('HOOK\n\n' + genData.sujet + '. Voici ce que personne ne vous dit.\n\nINSIGHT\n\nApres des annees dans ce domaine, un seul principe change tout.\n\nREHOOK 1\n\nMais le vrai probleme, c est ca.\n\nSTORY\n\nUn de mes clients etait exactement dans cette situation. Il a applique une chose. Resultat : transformation complete.\n\nREHOOK 2\n\nEt ce n est pas tout.\n\nLECON\n\nAppliquez ce principe des aujourd hui.\n\nCTA\n\nSauvegardez ce script.');
  }
}

function isSectionLabel(line) {
  var t = line.trim();
  if (!t || t.length < 2 || t.length > 25) return false;
  return /^[A-Z0-9\u00C0-\u00D6\u00D8-\u00DE /\-]+$/.test(t);
}

function markVerify(line) {
  // Highlight [?]...[/?] markers as warnings (called AFTER escapeHtml)
  return line.replace(/\[\?](.*?)\[\/\?]/g, '<span class="verify-marker" title="A verifier et adapter">⚠ $1</span>');
}

function renderScript(text) {
  if (!text) return '';
  var lines = text.split('\n');
  var html = ''; var cur = null; var body = [];
  function flush() {
    if (body.length > 0) {
      var joined = body.join('\n').trim();
      if (joined) {
        var isCta = cur && (cur === 'CTA' || cur.indexOf('CTA') === 0);
        html += '<div class="section-body' + (isCta ? ' cta-body' : '') + '">' + joined + '</div>';
      }
      body = [];
    }
  }
  for (var i = 0; i < lines.length; i++) {
    var t = lines[i].trim();
    if (t && isSectionLabel(t)) {
      flush(); cur = t;
      var isAccent = (t === 'HOOK' || t === 'ACCROCHE' || t === 'CTA' || t.indexOf('CTA') === 0);
      html += '<span class="section-label' + (isAccent ? ' hook' : '') + '">' + escapeHtml(t) + '</span>';
    } else {
      if (t || cur) body.push(t ? markVerify(escapeHtml(lines[i])) : '');
    }
  }
  flush(); return html;
}

function showScript(text) {
  if (msgTimer) clearInterval(msgTimer);
  document.getElementById('gen-generating').style.display = 'none';
  document.getElementById('gen-footer').style.display = 'none';
  document.getElementById('script-rendered').innerHTML = renderScript(text);
  document.getElementById('script-result').classList.add('active');
  document.getElementById('script-result').setAttribute('data-raw', text);
  // Bannière de vérification si des marqueurs [?]...[/?] sont présents
  var verifyCount = (text.match(/\[\?]/g) || []).length;
  var banner = document.getElementById('verify-banner');
  if (banner) { verifyCount > 0 ? banner.classList.add('visible') : banner.classList.remove('visible'); }
  var v = computeVirality(text);
  document.getElementById('gen-vir-score').textContent = v.score.toFixed(1);
}

function validateScript() {
  var text = document.getElementById('script-result').getAttribute('data-raw') || '';
  var title = (genData.sujet || 'Script').substring(0, 45);
  var formatLabels = { video30: 'Video 30s', video60: 'Video 60s', linkedin: 'LinkedIn', ads: 'Publicite', podcast: 'Podcast' };
  var now = new Date();
  var months = ['jan.','fev.','mars','avr.','mai','juin','juil.','aout','sep.','oct.','nov.','dec.'];
  var dateStr = now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
  var id = 'local_' + Date.now();
  var styleLabel = genData.style && STYLE_LIBRARY[genData.style] ? STYLE_LIBRARY[genData.style].label : (genData.style || 'Script');
  var meta = (formatLabels[genData.format] || 'Script') + ' · ' + styleLabel + ' · ' + dateStr;
  scriptsStore[id] = { title: title, content: text, meta: meta, status: 'st-draft', statusLabel: 'Brouillon', airtableId: null };
  pendingFeedbackRecordId = null;
  pendingFeedbackScriptLocalId = id;
  window._pendingFeedbackData = null;
  if (clientRecord) {
    atCreate('Scripts', {
      'Titre': title, 'Contenu': text,
      'Score_viralite': 0,
      'Statut': 'Brouillon', 'Client': [clientRecord.id],
      'Email_client': currentUser ? currentUser.email : '',
      'Date_creation': new Date().toISOString()
    }).then(function(rec) {
      if (rec.id && scriptsStore[id]) {
        scriptsStore[id].airtableId = rec.id; scriptsStore[rec.id] = scriptsStore[id]; delete scriptsStore[id];
        if (currentEditorId === id) currentEditorId = rec.id;
        renderScriptsList();
        pendingFeedbackRecordId = rec.id;
        if (window._pendingFeedbackData) {
          var d = window._pendingFeedbackData;
          window._pendingFeedbackData = null;
          fetch('/api/airtable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'PATCH', table: 'Scripts', recordId: rec.id, fields: { 'Score_viralite': d.score, 'Commentaire_feedback': d.comment } }) }).catch(function(e) { console.error('[feedback] deferred PATCH:', e); });
        }
      }
    }).catch(function(err) { console.error('[validateScript] atCreate error:', err); });
  }
  renderScriptsList();
  var el = document.getElementById('home-nb-scripts');
  if (el) el.textContent = Object.keys(scriptsStore).length;
  openFeedbackModal();
}

// ═══ FEEDBACK ═══
function openFeedbackModal() {
  feedbackRating = null;
  document.getElementById('feedback-comment').value = '';
  document.querySelectorAll('.fkey').forEach(function(k) { k.classList.remove('sel'); });
  var btn = document.getElementById('btn-submit-feedback');
  btn.classList.add('fb-disabled');
  document.getElementById('modal-feedback').classList.add('open');
}

function selectFeedbackRating(n) {
  feedbackRating = n;
  document.querySelectorAll('.fkey').forEach(function(k) { k.classList.toggle('sel', parseInt(k.textContent) === n); });
  document.getElementById('btn-submit-feedback').classList.remove('fb-disabled');
}

async function submitFeedback() {
  if (!feedbackRating) return;
  var comment = document.getElementById('feedback-comment').value.trim();
  if (pendingFeedbackRecordId) {
    fetch('/api/airtable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'PATCH', table: 'Scripts', recordId: pendingFeedbackRecordId, fields: { 'Score_viralite': feedbackRating, 'Commentaire_feedback': comment } }) }).catch(function(e) { console.error('[feedback] PATCH:', e); });
  } else {
    window._pendingFeedbackData = { score: feedbackRating, comment: comment };
  }
  closeFeedbackModal();
}

function skipFeedback() {
  closeFeedbackModal();
}

function closeFeedbackModal() {
  document.getElementById('modal-feedback').classList.remove('open');
  launchConfetti();
  closeGen();
  go('scripts');
}

// ═══ REGEN ═══
function setRegen(el, txt) {
  document.querySelectorAll('.regen-chip').forEach(function(c) { c.classList.remove('sel'); });
  el.classList.add('sel');
  document.getElementById('regen-instruction').value = txt;
}

function openRegenFromEditor() {
  currentEditorText = getEditorText();
  openRegen();
}

function doRegen() {
  var instruction = document.getElementById('regen-instruction').value;
  if (!instruction.trim()) { alert('Decris le changement souhaite !'); return; }
  var prevScript = currentEditorText || document.getElementById('script-result').getAttribute('data-raw') || '';
  if (!prevScript.trim()) { alert('Aucun script a regenerer'); return; }
  closeRegen();
  closeEditor();
  document.getElementById('modal-gen').classList.add('open');
  genStep = 6;
  goToGenStep(6);
  document.getElementById('gen-footer').style.display = 'none';
  document.getElementById('gen-generating').style.display = 'block';
  document.getElementById('script-result').classList.remove('active');
  document.getElementById('gen-anim-txt').textContent = genMsgs[0];
  startGenAnim();
  callAPI(prevScript, instruction);
}

// ═══ ONBOARDING MODE ═══
function goToObMode() {
  var nom = (document.getElementById('ob-nom') || {}).value || '';
  var email = ((document.getElementById('ob-email') || {}).value || '').trim();
  var password = (document.getElementById('ob-password') || {}).value || '';
  if (!nom) { alert('Ton nom est requis'); return; }
  if (!email) { alert('Un email est requis'); return; }
  if (password.length < 8) { alert('Mot de passe trop court (min. 8 caracteres)'); return; }
  go('ob-mode');
}

function selectMode(mode) {
  currentMode = mode;
  if (mode === 'standard') {
    doSignup();
  } else {
    go('ob2');
  }
}

function goToOb5() {
  if (currentMode === 'expert') {
    initRefScriptFields();
    go('ob5-expert');
  } else {
    go('ob5');
  }
}

// ═══ OB5-EXPERT : SCRIPTS ═══
function initRefScriptFields() {
  var container = document.getElementById('ref-scripts-fields-ob');
  if (!container) return;
  container.innerHTML = '';
  addRefScriptField();
}

function addRefScriptField() {
  var container = document.getElementById('ref-scripts-fields-ob');
  if (!container) return;
  var idx = container.querySelectorAll('.ref-script-block').length + 1;
  var div = document.createElement('div');
  div.className = 'ref-script-block';
  div.style.marginBottom = '16px';
  div.innerHTML = '<label class="field-lbl">Script ' + idx + '</label>'
    + '<textarea class="field-ta ref-script-ta" rows="6" placeholder="Colle ton script ici... (100 a 400 mots)"></textarea>'
    + '<input class="field-input ref-script-title-input" style="margin-top:8px;" placeholder="Titre (optionnel) — ex: Script Janvier 2025">';
  container.appendChild(div);
}

async function saveExpertScripts() {
  var scripts = [];
  document.querySelectorAll('.ref-script-ta').forEach(function(ta, i) {
    var content = ta.value.trim();
    if (content) {
      var titleInput = ta.nextElementSibling;
      scripts.push({ content: content, title: titleInput ? titleInput.value.trim() : '' });
    }
  });
  if (scripts.length > 0) {
    window._expertScriptsPending = scripts;
    var btn = document.getElementById('btn-save-expert');
    var loading = document.getElementById('ob5-expert-loading');
    if (btn) { btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }
    if (loading) loading.style.display = 'block';
  }
  await doSignup();
}

// ═══ ADN PROFIL ═══
async function generateAdnProfile(scripts) {
  var scriptsText = scripts.map(function(s, i) {
    return 'SCRIPT ' + (i + 1) + (s.title ? ' — ' + s.title : '') + ' :\n' + s.content;
  }).join('\n\n---\n\n');

  var system = 'Tu es un expert en analyse de style d ecriture et de communication video orale. Tu analyses des scripts video pour extraire un profil ADN de communication precis et actionnable.';
  var prompt = 'Analyse ces scripts video et genere un profil ADN de communication. Ce profil sera utilise pour generer de futurs scripts qui correspondent exactement au style de ce createur.\n\n'
    + 'SCRIPTS :\n\n' + scriptsText + '\n\n'
    + 'PROFIL ADN A GENERER :\n'
    + 'En 6 a 10 lignes, synthetise :\n'
    + '- Ton dominant observe (direct, chaleureux, autoritaire, humain, provocateur...)\n'
    + '- Niveau d energie et rythme (calme, energique, tres punchy...)\n'
    + '- Structures narratives recurrentes\n'
    + '- Niveau de langage (familier, professionnel, hybride...)\n'
    + '- Formulations ou expressions caracteristiques\n'
    + '- Longueur typique des phrases\n'
    + '- Points forts du style\n\n'
    + 'FORMAT : texte court et dense, sans tirets ni JSON. Ecris comme si tu decrivais la voix de ce createur a quelqu un qui doit l imiter.';

  try {
    var res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 500, system: system, messages: [{ role: 'user', content: prompt }] })
    });
    var data = await res.json();
    return data.content && data.content[0] ? data.content[0].text : '';
  } catch(e) {
    console.error('[generateAdnProfile]', e);
    return '';
  }
}

var _adnExpanded = false;
var _adnEditMode = false;

function renderAdnSection() {
  var section = document.getElementById('compte-adn-section');
  if (!section) return;
  var f = clientRecord ? clientRecord.fields : {};
  var adn = f['ADN_profil'] || '';
  var mode = f['Onboarding_mode'] || '';
  var modeLabels = { expert: 'Mode Expert', avance: 'Mode Avance', standard: '' };
  var modeLabel = modeLabels[mode] || '';

  var header = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">'
    + '<div style="display:flex;align-items:center;gap:8px;">'
    + '<div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;">ADN de communication</div>'
    + (modeLabel ? '<div style="font-size:10px;color:var(--accent);background:var(--adim2);border:1px solid var(--aborder);border-radius:100px;padding:2px 8px;">' + escapeHtml(modeLabel) + '</div>' : '')
    + '</div>';

  if (adn && !_adnEditMode) {
    header += '<div style="font-size:12px;color:var(--accent);cursor:pointer;" onclick="_adnEditMode=true;renderAdnSection()">Modifier ›</div>';
  } else if (_adnEditMode) {
    header += '<div style="font-size:12px;color:var(--text3);cursor:pointer;" onclick="_adnEditMode=false;_adnExpanded=false;renderAdnSection()">Annuler</div>';
  }
  header += '</div>';

  var body = '';
  if (_adnEditMode) {
    body = '<textarea class="field-ta" id="adn-edit-ta" rows="6" style="margin-bottom:8px;">' + escapeHtml(adn) + '</textarea>'
      + '<button class="btn" style="width:100%;margin-bottom:8px;" onclick="saveAdnEdit()"><span class="btn-txt">Sauvegarder</span><span class="btn-arr">→</span></button>';
  } else if (adn) {
    var PREVIEW_LEN = 150;
    var isLong = adn.length > PREVIEW_LEN;
    var displayed = (_adnExpanded || !isLong) ? adn : adn.slice(0, PREVIEW_LEN) + '…';
    body = '<div class="adn-card">' + escapeHtml(displayed) + '</div>';
    if (isLong) {
      body += '<div style="font-size:12px;color:var(--accent);cursor:pointer;margin-top:4px;" onclick="toggleAdnExpand()">'
        + (_adnExpanded ? '← Afficher moins' : 'Afficher plus ›')
        + '</div>';
    }
  } else {
    body = '<div class="adn-empty">Profil ADN non configure — ajoute des scripts de reference pour le generer.</div>';
  }

  section.innerHTML = header + body;
}

function toggleAdnExpand() {
  _adnExpanded = !_adnExpanded;
  renderAdnSection();
}

async function saveAdnEdit() {
  var ta = document.getElementById('adn-edit-ta');
  if (!ta || !clientRecord) return;
  var newAdn = ta.value.trim();
  await fetch('/api/airtable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'PATCH', table: 'Client', recordId: clientRecord.id, fields: { 'ADN_profil': newAdn } })
  });
  clientRecord.fields['ADN_profil'] = newAdn;
  _adnEditMode = false;
  _adnExpanded = false;
  renderAdnSection();
}

// ═══ REF SCRIPTS CRUD ═══
async function loadRefScripts(email) {
  var records = await atFetch('ScriptsRef', '{User_email}="' + email + '"', 'sort[0][field]=Date_ajout&sort[0][direction]=desc');
  refScriptsStore = {};
  records.forEach(function(r) {
    refScriptsStore[r.id] = { title: r.fields['Titre'] || 'Sans titre', content: r.fields['Contenu'] || '', date: r.fields['Date_ajout'] || '', airtableId: r.id };
  });
}

function openRefScripts() {
  renderRefScriptsList();
  document.getElementById('modal-ref-scripts').classList.add('open');
}
function closeRefScripts() { document.getElementById('modal-ref-scripts').classList.remove('open'); }

function renderRefScriptsList() {
  var list = document.getElementById('ref-scripts-list-modal');
  if (!list) return;
  var keys = Object.keys(refScriptsStore);
  if (keys.length === 0) {
    list.innerHTML = '<div style="font-size:13px;color:var(--text3);padding:4px 0 16px;">Aucun script de reference. Ajoute-en un pour enrichir ton profil ADN.</div>';
    return;
  }
  var months = ['jan.','fev.','mars','avr.','mai','juin','juil.','aout','sep.','oct.','nov.','dec.'];
  var html = '';
  keys.forEach(function(id) {
    var s = refScriptsStore[id];
    var d = s.date ? new Date(s.date) : null;
    var dateStr = d ? d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear() : '';
    html += '<div class="card-sm" style="margin-bottom:10px;">'
      + '<div class="crow" style="border-bottom:none;" onclick="openViewRefScript(\'' + id + '\')">'
      + '<div><div class="crow-lbl">' + escapeHtml(s.title) + '</div>'
      + (dateStr ? '<div style="font-size:12px;color:var(--text3);margin-top:2px;">' + dateStr + '</div>' : '')
      + '</div><div style="font-size:12px;color:var(--accent);">Editer ›</div>'
      + '</div></div>';
  });
  list.innerHTML = html;
}

function openAddRefScript() {
  document.getElementById('add-ref-titre').value = '';
  document.getElementById('add-ref-contenu').value = '';
  document.getElementById('modal-add-ref-script').classList.add('open');
}
function closeAddRefScript() { document.getElementById('modal-add-ref-script').classList.remove('open'); }

async function saveAddRefScript() {
  if (!currentUser) return;
  var title = document.getElementById('add-ref-titre').value.trim();
  var content = document.getElementById('add-ref-contenu').value.trim();
  if (!content) { alert('Le contenu du script est requis'); return; }
  var rec = await atCreate('ScriptsRef', {
    'User_email': currentUser.email,
    'Titre': title || 'Sans titre',
    'Contenu': content,
    'Date_ajout': new Date().toISOString()
  });
  if (rec.id) {
    refScriptsStore[rec.id] = { title: title || 'Sans titre', content: content, date: new Date().toISOString(), airtableId: rec.id };
    renderRefScriptsList();
    renderAdnSection();
  }
  closeAddRefScript();
}

function openViewRefScript(id) {
  currentViewRefId = id;
  var s = refScriptsStore[id];
  if (!s) return;
  document.getElementById('view-ref-title').textContent = s.title || 'Script';
  document.getElementById('view-ref-titre').value = s.title || '';
  document.getElementById('view-ref-contenu').value = s.content || '';
  document.getElementById('modal-view-ref-script').classList.add('open');
}
function closeViewRefScript() { document.getElementById('modal-view-ref-script').classList.remove('open'); }

async function saveViewRefScript() {
  if (!currentViewRefId) return;
  var s = refScriptsStore[currentViewRefId];
  if (!s || !s.airtableId) return;
  var title = document.getElementById('view-ref-titre').value.trim();
  var content = document.getElementById('view-ref-contenu').value.trim();
  await fetch('/api/airtable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'PATCH', table: 'ScriptsRef', recordId: s.airtableId, fields: { 'Titre': title, 'Contenu': content } })
  });
  s.title = title;
  s.content = content;
  renderRefScriptsList();
  closeViewRefScript();
}

async function deleteCurrentRefScript() {
  if (!currentViewRefId) return;
  if (!confirm('Supprimer ce script ? Action irreversible.')) return;
  var s = refScriptsStore[currentViewRefId];
  if (s && s.airtableId) await atDelete('ScriptsRef', s.airtableId);
  delete refScriptsStore[currentViewRefId];
  currentViewRefId = null;
  renderRefScriptsList();
  renderAdnSection();
  closeViewRefScript();
}

async function reanalyzeStyle() {
  var scripts = Object.values(refScriptsStore);
  if (scripts.length === 0) { alert('Ajoute au moins un script de reference d abord.'); return; }
  var btn = document.getElementById('btn-reanalyze');
  if (btn) { btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; btn.querySelector('.btn-txt').textContent = 'Analyse en cours...'; }
  var adn = await generateAdnProfile(scripts.map(function(s) { return { content: s.content, title: s.title }; }));
  if (adn && clientRecord) {
    await fetch('/api/airtable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'PATCH', table: 'Client', recordId: clientRecord.id, fields: { 'ADN_profil': adn, 'ADN_date': new Date().toISOString() } })
    });
    clientRecord.fields['ADN_profil'] = adn;
    clientRecord.fields['ADN_date'] = new Date().toISOString();
    renderAdnSection();
  }
  if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; btn.querySelector('.btn-txt').textContent = 'Reanalyser mon style'; }
  closeRefScripts();
}

// ═══ AUTH ═══
function initSupabase() {
  if (window.supabase) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    sb.auth.onAuthStateChange(async function(event, session) {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && !currentUser) {
        window.history.replaceState({}, document.title, window.location.pathname);
        currentUser = session.user;
        var email = currentUser.email;
        var nom = session.user.user_metadata && session.user.user_metadata.full_name
          ? session.user.user_metadata.full_name : email;
        var isGoogle = session.user.app_metadata && session.user.app_metadata.provider === 'google';
        renderAll({ fields: { Nom_complet: nom, Email: email, Points: 0 } }, email);
        var client = await loadClientData(email);
        if (!client) {
          await atCreate('Client', { 'Nom_complet': nom, 'Email': email });
          client = await loadClientData(email);
          if (isGoogle) {
            clientRecord = client;
            window._googleNewUser = true;
            go('ob-mode');
            return;
          }
        }
        go('home');
        if (client) {
          clientRecord = client;
          renderAll(clientRecord, email);
          var sessions = [];
          try { sessions = await loadSessions(email); } catch(e) {}
          renderSessions(sessions);
          await loadScripts(clientRecord.id, email);
        } else {
          go('ob1');
        }
      }
    });
  } else {
    setTimeout(initSupabase, 200);
  }
}

async function loadUserData(email) {
  // Reset complet avant de charger les nouvelles données
  clientRecord = null;
  scriptsStore = {};
  selectedScripts = {};
  renderScriptsList();

  var client = await loadClientData(email);
  if (!client) { go('ob1'); return; }
  clientRecord = client;
  renderAll(clientRecord, email);
  var sessions = [];
  try { sessions = await loadSessions(email); } catch(e) { console.error('Sessions error:', e); }
  renderSessions(sessions);
  await loadScripts(clientRecord.id, email);
  await loadRefScripts(email);
  go('home');
}

async function doLogin() {
  var email = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;
  if (!email || !password) { alert('Email et mot de passe requis'); return; }
  // Affiche le spinner et désactive le bouton pendant la connexion
  var spinner = document.getElementById('login-spinner');
  var btn = document.getElementById('login-btn');
  if (spinner) spinner.classList.add('visible');
  if (btn) { btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }
  var result = await sb.auth.signInWithPassword({ email: email, password: password });
  // Cache le spinner et réactive le bouton
  if (spinner) spinner.classList.remove('visible');
  if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; }
  if (result.error) { alert('Erreur : ' + result.error.message); return; }
  currentUser = result.data.user;
  await loadUserData(currentUser.email);
}

async function doLoginGoogle() {
  // redirectTo = URL de base sans paramètres pour éviter les boucles
  var baseUrl = window.location.origin + window.location.pathname;
  await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: baseUrl } });
}

async function doLogout() {
  await sb.auth.signOut();
  currentUser = null;
  clientRecord = null;
  scriptsStore = {};
  scriptsLoaded = false;
  selectedScripts = {};
  currentEditorId = null;
  currentEditorText = '';
  refScriptsStore = {};
  currentViewRefId = null;
  currentMode = 'standard';
  // Reset UI
  document.getElementById('scripts-list').innerHTML = '<div style="padding:24px 16px;text-align:center;font-size:13px;color:var(--text3);">Chargement...</div>';
  document.getElementById('sess-passees').innerHTML = '<div style="padding:20px 16px;font-size:13px;color:var(--text3);">Chargement...</div>';
  document.getElementById('sess-avenir').innerHTML = '';
  closeCompte();
  go('login');
}

async function doSignup() {
  if (window._googleNewUser && currentUser) {
    window._googleNewUser = false;
    var gEmail = currentUser.email;
    var obPrix = document.querySelector('#ob2-prix-opts .ob-opt.sel');
    var obMaturite = document.querySelector('#ob2-maturite-opts .ob-opt.sel');
    var obObjectif = document.querySelector('#ob4-objectif-opts .ob-opt.sel');
    var obTon = document.querySelector('#ob5-ton-opts .ob-opt.sel');
    var obIntensite = document.querySelector('#ob5-intensite-opts .ob-opt.sel');
    var obLangage = document.querySelector('#ob5-langage-opts .ob-opt.sel');
    var obKpi = Array.from(document.querySelectorAll('#ob4-kpi-chips .ob-chip.sel'))
      .map(function(c) { return c.textContent.trim(); }).join(', ');
    if (clientRecord) {
      await fetch('/api/airtable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'PATCH', table: 'Client', recordId: clientRecord.id, fields: {
          'Onboarding_mode': currentMode,
          'Onboarding_secteur': (document.getElementById('ob2-activite') || {}).value || '',
          'Onboarding_offre': (document.getElementById('ob2-offre') || {}).value || '',
          'Onboarding_prix': obPrix ? obPrix.textContent.trim() : '',
          'Onboarding_maturite': obMaturite ? obMaturite.textContent.trim() : '',
          'Onboarding_cible': (document.getElementById('ob3-cible') || {}).value || '',
          'Onboarding_douleur': (document.getElementById('ob3-douleur') || {}).value || '',
          'Onboarding_transformation': (document.getElementById('ob3-transformation') || {}).value || '',
          'Onboarding_objectif': obObjectif ? obObjectif.textContent.trim() : '',
          'Onboarding_kpi': obKpi,
          'Onboarding_ton': obTon ? obTon.textContent.trim() : '',
          'Onboarding_intensite': obIntensite ? obIntensite.textContent.trim() : '',
          'Onboarding_langage': obLangage ? obLangage.textContent.trim() : ''
        }})
      });
      clientRecord = await loadClientData(gEmail);
      if (clientRecord) renderAll(clientRecord, gEmail);
      if (currentMode === 'expert' && window._expertScriptsPending && window._expertScriptsPending.length) {
        var gScripts = window._expertScriptsPending;
        window._expertScriptsPending = null;
        for (var gi = 0; gi < gScripts.length; gi++) {
          await atCreate('ScriptsRef', { 'User_email': gEmail, 'Titre': gScripts[gi].title || 'Script ' + (gi + 1), 'Contenu': gScripts[gi].content, 'Date_ajout': new Date().toISOString() });
        }
        var gAdn = await generateAdnProfile(gScripts);
        if (gAdn && clientRecord) {
          await fetch('/api/airtable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'PATCH', table: 'Client', recordId: clientRecord.id, fields: { 'ADN_profil': gAdn, 'ADN_date': new Date().toISOString() } }) });
          clientRecord.fields['ADN_profil'] = gAdn;
        }
      }
    }
    var sessions = [];
    try { sessions = await loadSessions(gEmail); } catch(e) {}
    renderSessions(sessions);
    if (clientRecord) await loadScripts(clientRecord.id, gEmail);
    if (currentUser) await loadRefScripts(gEmail);
    go('home');
    return;
  }

  var nom = (document.getElementById('ob-nom') || {}).value || '';
  var email = (document.getElementById('ob-email') || {}).value.trim();
  var password = (document.getElementById('ob-password') || {}).value;

  if (!nom) { alert('Ton nom est requis'); return; }
  if (!email || !password) { alert('Email et mot de passe requis'); return; }
  if (password.length < 8) { alert('Mot de passe trop court (min. 8 caracteres)'); return; }

  var existing = await loadClientData(email);
  var result = await sb.auth.signUp({ email: email, password: password });
  if (result.error) {
    if (result.error.message.toLowerCase().includes('already') || result.error.message.toLowerCase().includes('registered')) {
      alert('Un compte existe déjà avec cet email. Tu vas être redirigé vers la connexion.');
      document.getElementById('login-email').value = email;
      go('login');
      return;
    }
    alert('Erreur : ' + result.error.message);
    return;
  }

  if (existing) {
    clientRecord = existing;
  } else {
    var obPrix = document.querySelector('#ob2-prix-opts .ob-opt.sel');
    var obMaturite = document.querySelector('#ob2-maturite-opts .ob-opt.sel');
    var obObjectif = document.querySelector('#ob4-objectif-opts .ob-opt.sel');
    var obTon = document.querySelector('#ob5-ton-opts .ob-opt.sel');
    var obIntensite = document.querySelector('#ob5-intensite-opts .ob-opt.sel');
    var obLangage = document.querySelector('#ob5-langage-opts .ob-opt.sel');
    var obKpi = Array.from(document.querySelectorAll('#ob4-kpi-chips .ob-chip.sel'))
      .map(function(c) { return c.textContent.trim(); }).join(', ');

    await atCreate('Client', {
      'Nom_complet': nom,
      'Email': email,
      'Onboarding_mode': currentMode,
      'Onboarding_secteur': (document.getElementById('ob2-activite') || {}).value || '',
      'Onboarding_offre': (document.getElementById('ob2-offre') || {}).value || '',
      'Onboarding_prix': obPrix ? obPrix.textContent.trim() : '',
      'Onboarding_maturite': obMaturite ? obMaturite.textContent.trim() : '',
      'Onboarding_cible': (document.getElementById('ob3-cible') || {}).value || '',
      'Onboarding_douleur': (document.getElementById('ob3-douleur') || {}).value || '',
      'Onboarding_transformation': (document.getElementById('ob3-transformation') || {}).value || '',
      'Onboarding_objectif': obObjectif ? obObjectif.textContent.trim() : '',
      'Onboarding_kpi': obKpi,
      'Onboarding_ton': obTon ? obTon.textContent.trim() : '',
      'Onboarding_intensite': obIntensite ? obIntensite.textContent.trim() : '',
      'Onboarding_langage': obLangage ? obLangage.textContent.trim() : ''
    });
    clientRecord = await loadClientData(email);

    if (currentMode === 'expert' && window._expertScriptsPending && window._expertScriptsPending.length && clientRecord) {
      var eScripts = window._expertScriptsPending;
      window._expertScriptsPending = null;
      for (var ei = 0; ei < eScripts.length; ei++) {
        await atCreate('ScriptsRef', { 'User_email': email, 'Titre': eScripts[ei].title || 'Script ' + (ei + 1), 'Contenu': eScripts[ei].content, 'Date_ajout': new Date().toISOString() });
      }
      var eAdn = await generateAdnProfile(eScripts);
      if (eAdn) {
        await fetch('/api/airtable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'PATCH', table: 'Client', recordId: clientRecord.id, fields: { 'ADN_profil': eAdn, 'ADN_date': new Date().toISOString() } }) });
        clientRecord.fields['ADN_profil'] = eAdn;
      }
    }
  }

  currentUser = { email: email };
  if (clientRecord) { renderAll(clientRecord, email); }
  go('home');
}

// ═══ INIT ═══
(function() {
  for (var i = 1; i <= 6; i++) {
    try {
      if (localStorage.getItem('seen_c' + i)) {
        var card = document.getElementById('c' + i);
        var badge = document.getElementById('seen-c' + i);
        if (card) card.classList.add('seen');
        if (badge) badge.style.display = 'flex';
      }
    } catch(e) {}
  }
})();

// ═══ EDIT PROFIL / NOM ═══
function selEditOpt(el, group) {
  el.parentNode.querySelectorAll('.ob-opt').forEach(function(o) { o.classList.remove('sel'); });
  el.classList.add('sel');
}

function openEditProfil() {
  var f = clientRecord ? clientRecord.fields : {};
  var set = function(id, val) { var el = document.getElementById(id); if (el) el.value = val || ''; };
  var selOpts = function(cid, val) {
    document.querySelectorAll('#' + cid + ' .ob-opt').forEach(function(o) {
      o.classList.toggle('sel', o.textContent.trim() === (val || ''));
    });
  };
  set('ep-secteur', f['Onboarding_secteur']);
  set('ep-offre', f['Onboarding_offre']);
  set('ep-cible', f['Onboarding_cible']);
  set('ep-douleur', f['Onboarding_douleur']);
  set('ep-transformation', f['Onboarding_transformation']);
  selOpts('ep-prix-opts', f['Onboarding_prix']);
  selOpts('ep-maturite-opts', f['Onboarding_maturite']);
  selOpts('ep-objectif-opts', f['Onboarding_objectif']);
  selOpts('ep-ton-opts', f['Onboarding_ton']);
  selOpts('ep-intensite-opts', f['Onboarding_intensite']);
  selOpts('ep-langage-opts', f['Onboarding_langage']);
  var kpiVal = f['Onboarding_kpi'] || '';
  document.querySelectorAll('#ep-kpi-chips .ob-chip').forEach(function(chip) {
    chip.classList.toggle('sel', kpiVal.includes(chip.textContent.trim()));
  });
  document.getElementById('modal-edit-profil').classList.add('open');
}

function closeEditProfil() { document.getElementById('modal-edit-profil').classList.remove('open'); }

async function saveEditProfil() {
  if (!clientRecord) return;
  var getOpt = function(cid) {
    var el = document.querySelector('#' + cid + ' .ob-opt.sel');
    return el ? el.textContent.trim() : '';
  };
  var kpi = Array.from(document.querySelectorAll('#ep-kpi-chips .ob-chip.sel'))
    .map(function(c) { return c.textContent.trim(); }).join(', ');
  var fields = {
    'Onboarding_secteur':        (document.getElementById('ep-secteur') || {}).value || '',
    'Onboarding_offre':          (document.getElementById('ep-offre') || {}).value || '',
    'Onboarding_prix':           getOpt('ep-prix-opts'),
    'Onboarding_maturite':       getOpt('ep-maturite-opts'),
    'Onboarding_cible':          (document.getElementById('ep-cible') || {}).value || '',
    'Onboarding_douleur':        (document.getElementById('ep-douleur') || {}).value || '',
    'Onboarding_transformation': (document.getElementById('ep-transformation') || {}).value || '',
    'Onboarding_objectif':       getOpt('ep-objectif-opts'),
    'Onboarding_kpi':            kpi,
    'Onboarding_ton':            getOpt('ep-ton-opts'),
    'Onboarding_intensite':      getOpt('ep-intensite-opts'),
    'Onboarding_langage':        getOpt('ep-langage-opts')
  };
  try {
    await fetch('/api/airtable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'PATCH', table: 'Client', recordId: clientRecord.id, fields: fields })
    });
    Object.assign(clientRecord.fields, fields);
    closeEditProfil();
    alert('Profil mis a jour !');
  } catch(e) {
    console.error('[saveEditProfil]', e);
    alert('Erreur de sauvegarde');
  }
}
function openEditNom() {
  if (!clientRecord) return;
  var el = document.getElementById('edit-nom-input');
  if (el) el.value = clientRecord.fields['Nom_complet'] || '';
  document.getElementById('modal-edit-nom').classList.add('open');
}

function closeEditNom() { document.getElementById('modal-edit-nom').classList.remove('open'); }

async function saveEditNom() {
  if (!clientRecord) return;
  var nom = document.getElementById('edit-nom-input').value.trim();
  if (!nom) { alert('Le nom ne peut pas etre vide'); return; }
  try {
    await fetch('/api/airtable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'PATCH', table: 'Client', recordId: clientRecord.id, fields: { 'Nom_complet': nom } })
    });
    clientRecord.fields['Nom_complet'] = nom;
    // Mettre à jour l'UI
    renderAll(clientRecord, currentUser ? currentUser.email : '');
    closeEditNom();
    alert('Nom mis a jour !');
  } catch(e) {
    console.error('[saveEditNom]', e);
    alert('Erreur de sauvegarde');
  }
}

// ═══ VOIR / MASQUER MOT DE PASSE ═══
// el = id de l'input, btn = le bouton œil cliqué
function togglePwd(inputId, btn) {
  var input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';       // révèle le mot de passe
    btn.textContent = '🙈';    // change l'icône
  } else {
    input.type = 'password';   // masque à nouveau
    btn.textContent = '👁';
  }
}


// ═══ NOUVELLES FONCTIONS V15 ═══
// setScriptStatus : Brouillon / Validé / Tourné — sauvegarde dans Airtable
async function setScriptStatus(newStatut) {
  if (!currentEditorId) return;
  var s = scriptsStore[currentEditorId];
  if (!s) return;
  var statusMap2 = {
    'Brouillon': { css: 'st-draft',   label: 'Brouillon' },
    'Validé':   { css: 'st-valid',   label: 'Validé' },
    'Tourné':  { css: 'st-tourne', label: 'Tourné' }
  };
  var info = statusMap2[newStatut];
  if (!info) return;

  // UI immédiate
  if (newStatut === 'Validé') launchConfetti();
  updateStatusBtns(newStatut);
  var statusEl = document.getElementById('autosave-status');
  if (statusEl) statusEl.textContent = 'Mise a jour...';

  // Sauvegarder dans Airtable
  if (s.airtableId) {
    try {
      await fetch('/api/airtable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'PATCH', table: 'Scripts', recordId: s.airtableId, fields: { 'Statut': newStatut } })
      });
      if (statusEl) statusEl.textContent = 'Statut mis a jour ✓';
    } catch(e) {
      console.error('[setScriptStatus]', newStatut, e);
      if (statusEl) statusEl.textContent = 'Erreur de sauvegarde';
    }
  }

  // Mettre à jour le store local
  s.status = info.css;
  s.statusLabel = info.label;
  renderScriptsList();
  updateHomeTourneCount();
}

// Met à jour l'apparence des boutons de statut
function updateStatusBtns(statut) {
  var map = { 'Brouillon': 'sbtn-draft', 'Validé': 'sbtn-valid', 'Tourné': 'sbtn-tourne' };
  var classes = { 'Brouillon': 'active-draft', 'Validé': 'active-valid', 'Tourné': 'active-tourne' };
  Object.keys(map).forEach(function(s) {
    var btn = document.getElementById(map[s]);
    if (!btn) return;
    btn.className = 'status-btn';
    if (s === statut) btn.classList.add(classes[s]);
  });
}

// Alias rétrocompat
async function markAsTourne() { await setScriptStatus('Tourné'); }

function updateHomeTourneCount() {
  var count = Object.values(scriptsStore).filter(function(s) { return s.status === 'st-tourne'; }).length;
  var el = document.getElementById('home-nb-tourne');
  if (el) el.textContent = count;
}

function updateHomeHeures(sessions) {
  var total = 0;
  (sessions || []).forEach(function(r) { total += parseFloat(r.fields['Durée'] || r.fields['Duree'] || 0); });
  var el = document.getElementById('home-nb-heures');
  if (el) el.textContent = total;
}

function openGenPodcast() {
  genStep = 1;
  genData = { sujet: '', objectif: 'engagement', format: 'podcast', style: 'story', precision: '' };
  document.querySelectorAll('.gen-step').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById('gen-step-1').classList.add('active');
  document.getElementById('gen-footer').style.display = 'block';
  document.getElementById('gen-next-txt').textContent = 'Generer ✦';
  document.getElementById('gen-sujet').value = '';
  document.getElementById('gen-sujet').placeholder = 'Ex: Episode sur le recrutement des talents en startup...';
  document.querySelector('#modal-gen .modal-title').textContent = 'Intro & Outro Podcast';
  document.getElementById('modal-gen').classList.add('open');
  window._podcastMode = true;
  updateBackBtn();
}

async function callAPIPodcast(sujet) {
  var profil = clientRecord ? clientRecord.fields : {};
  var parts = ["Tu es un expert en podcasting. Cree une INTRODUCTION et une CONCLUSION pour un episode de podcast sur : " + sujet + "."];
  if (profil["Nom_complet"]) parts.push("Animateur : " + profil["Nom_complet"]);
  if (profil["Onboarding_ton"]) parts.push("Ton : " + profil["Onboarding_ton"]);
  if (profil["Onboarding_cible"]) parts.push("Audience : " + profil["Onboarding_cible"]);
  parts.push("Structure OBLIGATOIRE - ACCROCHE [Introduction engageante 30sec] CORPS [Presentation episode] CONCLUSION [Outro chaleureux] CTA [Phrase finale]. Direct, chaleureux, naturel a loral.");
  var prompt = parts.join(" ");
  try {
    var res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1200, system: buildSystemPrompt('story'), messages: [{ role: "user", content: prompt }] })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    showScript(data.content && data.content[0] ? data.content[0].text : "Erreur de generation.");
  } catch(e) {
    showScript("ACCROCHE\n\nBienvenue dans cet episode sur " + sujet + ".\n\nCORPS\n\nOn explore ce sujet en profondeur.\n\nCONCLUSION\n\nMerci d avoir ete la.\n\nCTA\n\nOn se retrouve la semaine prochaine !");
  }
}

initSupabase();

