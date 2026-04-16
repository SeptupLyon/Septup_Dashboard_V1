// ═══ CONFIG ═══

// ═══ CONFIG ═══
var SUPABASE_URL = 'https://vruwzwzokyyzwdyfnfpp.supabase.co';
var SUPABASE_KEY = 'sb_publishable_5EcH8Gb_4DKFLUUSBWMrOg_rl2ZieSR';
// AT_TOKEN et AT_BASE sont maintenant côté serveur (api/airtable.js)

// ═══ STATE ═══
var sb = null;
var currentUser = null;
var clientRecord = null;
var scriptsStore = {};
var selectedScripts = {};
var currentEditorId = null;
var currentEditorText = '';
var filloutLoaded = false;
var isDark = true;
var genStep = 1;
var genData = { sujet: '', objectif: '', format: '', style: '', precision: '' };
var msgTimer = null;
var msgIdx = 0;
var editorTimer = null;
var genMsgs = ['Analyse de ton profil...', 'Selection du framework...', 'Calibration du ton...', 'Redaction en cours...', 'Finalisation...'];

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
    r.setProperty('--bg', '#0e0e0e'); r.setProperty('--bg2', '#1a1a1a'); r.setProperty('--bg3', '#242424');
    r.setProperty('--border', 'rgba(255,255,255,0.07)'); r.setProperty('--border2', 'rgba(255,255,255,0.12)');
    r.setProperty('--text', '#fff'); r.setProperty('--text2', 'rgba(255,255,255,0.5)'); r.setProperty('--text3', 'rgba(255,255,255,0.25)');
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
  if (passEl) passEl.innerHTML = passees.length ? passees.map(function(r) { return makeCard(r, false); }).join('') : '<div style="padding:20px 16px;font-size:13px;color:var(--text3);">Aucune session passee</div>';
  if (avenirEl) avenirEl.innerHTML = avenir.length ? avenir.map(function(r) { return makeCard(r, true); }).join('') : '<div style="padding:20px 16px;font-size:13px;color:var(--text3);">Aucune session a venir</div>';

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
    list.innerHTML = '<div style="padding:24px 16px;text-align:center;font-size:13px;color:var(--text3);">Aucun script pour l instant.<br>Genere ton premier script avec le bouton +</div>';
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
}

function goToGenStep(n) {
  document.querySelectorAll('.gen-step').forEach(function(s) { s.classList.remove('active'); });
  var el = document.getElementById('gen-step-' + n);
  if (el) el.classList.add('active');
}
function closeGen() { document.getElementById('modal-gen').classList.remove('open'); if (msgTimer) clearInterval(msgTimer); }

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
}

function startGenAnim() {
  msgIdx = 0;
  document.getElementById('gen-anim-txt').textContent = genMsgs[0];
  msgTimer = setInterval(function() { msgIdx = (msgIdx + 1) % genMsgs.length; document.getElementById('gen-anim-txt').textContent = genMsgs[msgIdx]; }, 1800);
}

// ─────────────────────────────────────────────────────────────
// GÉNÉRATION DES 3 HOOKS + SÉLECTION
// ─────────────────────────────────────────────────────────────
async function generateHooksOnly() {
  var sk = genData.style || 'hybride';
  var formatLabels = { video30: 'Video courte 30s', video60: 'Video courte 60s', linkedin: 'Post LinkedIn', ads: 'Script publicitaire' };
  var objectifLabels = { vues: 'Maximiser les vues', engagement: 'Creer de l engagement', leads: 'Generer des prospects', vente: 'Vendre une offre', autorite: 'Renforcer l image d expert' };
  var styleLabel = STYLE_LIBRARY[sk] ? STYLE_LIBRARY[sk].label : sk;

  var prompt = 'Genere EXACTEMENT 3 options de hook differentes pour ce contenu.\n\n'
    + 'Sujet : ' + genData.sujet + '\n'
    + 'Format : ' + (formatLabels[genData.format] || genData.format) + '\n'
    + 'Style narratif : ' + styleLabel + '\n'
    + 'Objectif : ' + (objectifLabels[genData.objectif] || genData.objectif) + '\n';
  if (genData.precision) prompt += 'Precision : ' + genData.precision + '\n';
  prompt += '\nREGLES ABSOLUES :\n'
    + '• Les 3 hooks sont TOTALEMENT DIFFERENTS — structure, angle et energie distincts. Pas 3 variantes du meme.\n'
    + '• LANGAGE 100% PARLE : t as / c est / y a / franchement / du coup. Zero francais ecrit.\n'
    + '• 1 a 3 phrases max par hook. Court, percutant, direct.\n'
    + '• Aucune numerotation dans le texte du hook lui-meme.\n'
    + '• Parfaitement adapte au profil du createur — vocabulaire, ton, secteur.\n\n'
    + 'FORMAT DE REPONSE STRICT (respecte exactement ces separateurs) :\n'
    + '###HOOK1###\n[texte du hook 1]\n###HOOK2###\n[texte du hook 2]\n###HOOK3###\n[texte du hook 3]';

  try {
    var res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 500, system: buildSystemPrompt(sk), messages: [{ role: 'user', content: prompt }] })
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
    hooks = rawText.split(/\n\n+/).map(function(h) { return h.trim(); }).filter(function(h) { return h.length > 10; }).slice(0, 3);
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

  var motCount = genData.sujet.trim().split(/\s+/).length;
  var hasExample = /\d|%|client|cas|exemple|histoire|fois|jour|mois|an|euro|€|\$/.test(genData.sujet.toLowerCase());
  var nQuestions = (motCount < 6 || !hasExample) ? '4 ou 5' : (motCount < 14 ? '3' : '2');

  var prompt = 'Le createur veut faire une video sur ce sujet : "' + genData.sujet + '"\n\n'
    + 'Genere exactement ' + nQuestions + ' questions courtes pour affiner le sujet et obtenir des elements concrets.\n\n'
    + 'Ces questions doivent permettre d obtenir :\n'
    + '• L angle precis et unique de la video (le "twist" ou la surprise)\n'
    + '• Un exemple ou cas reel utilisable dans le script\n'
    + '• Des chiffres ou resultats concrets si pertinents\n'
    + '• La tension narrative (le probleme / l enjeu)\n'
    + '• Le public specifique si pas clair\n\n'
    + 'REGLES :\n'
    + '• Questions courtes, directes, en francais oral (pas academique)\n'
    + '• Pas de question sur le format, style ou plateforme\n'
    + '• Chaque question est differente — pas de doublon\n'
    + '• Commence directement par la question, pas par "Pouvez-vous..."\n\n'
    + 'FORMAT STRICT :\n###Q1###\n[question]\n###Q2###\n[question]\n(etc.)';

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
// HOOKS PAR STYLE — source : 1,000 Viral Hooks (PBL)
// Ces hooks sont des TEMPLATES universels — valables quelle
// que soit la niche. Claude doit remplir les [variables] avec
// le profil du createur et le sujet donne.
// ─────────────────────────────────────────────────────────────
var HOOKS_BY_ANGLE = {
  edu: [
    "Voici exactement combien de [element] il vous faut pour [resultat].",
    "Il m a fallu [X] ans pour apprendre ca — je vais vous l expliquer en moins d une minute.",
    "Je vais vous apprendre comment [resultat] avec [methode surprenante].",
    "Si je me reveillais demain avec [probleme] et que je voulais [resultat] d ici [delai], voici exactement ce que je ferais.",
    "Tout le monde vous dit de [action] mais personne ne vous explique vraiment comment. Voici le tutoriel etape par etape.",
    "En 60 secondes je vais vous apprendre plus sur [sujet] que tout ce que vous avez appris jusqu ici.",
    "3 niveaux de [sujet]. La plupart des gens sont bloques au niveau 1 sans le savoir.",
    "La vraie raison pour laquelle vous n arrivez pas a [resultat], c est que...",
    "Ne faites pas [action] avant d apprendre a faire ceci.",
    "Si vous etes [cible] et que vous voulez [resultat] via [approche], ecoutez bien cette video."
  ],
  story: [
    "Voici comment mon [evenement/resultat] a change ma vie.",
    "Il y a [X] ans j ai pris une decision. Ce que j ai appris depuis a tout change.",
    "J ai [vecu quelque chose de difficile] a [age] — mais c est ce qui s est passe apres qui a vraiment tout change.",
    "Il y a [X] mois, j ai demarre [projet/activite]. Et ca s est avere etre [resultat inattendu].",
    "Un jour vous allez vous faire [quitter/lacher] — pas par [personne attendue] — mais par [element surprenant].",
    "C est probablement la chose la plus difficile que j aie jamais faite.",
    "J ai commence [activite] quand j avais [age] avec [peu de ressources]. Voici ce que ca m a appris.",
    "Ca m a pris [X] ans pour comprendre ca. Et le jour ou j ai compris, tout a change.",
    "Je ne savais pas si ca allait marcher. Mais j ai quand meme essaye. Voici ce qui s est passe.",
    "La verite sur [sujet] — apres [X] annees a le vivre de l interieur."
  ],
  direct: [
    "Arretez de [action courante]. Ca ne va rien regler.",
    "Voici la verite que personne ne veut vous dire sur [sujet].",
    "Vous n avez pas [defaut], vous n etes pas [adjectif negatif] — vous avez juste besoin de [solution].",
    "Ce que [industrie/experts] ne veulent pas que vous sachiez sur [sujet].",
    "Si vous faites [action], voici ce que vous devez savoir immediatement.",
    "Ne touchez pas a [element] tant que vous n avez pas vu ca.",
    "Ce que j aurais voulu savoir a [age] plutot qu a [age plus tard].",
    "Les [X] choses qui abiment votre [element] sans que vous vous en rendiez compte.",
    "Pourquoi ca m a pris [X] ans pour realiser que vous pouvez [resultat] en [duree courte].",
    "[Action] pendant [duree] et vous obtenez [resultat]. Ce n est pas une opinion."
  ],
  autorite: [
    "En [X] ans dans [domaine], voici ce que j aurais aime que quelqu un me dise des le depart.",
    "Depuis [X] ans je [action], voici comment je suis passe de [avant] a [apres].",
    "Je ne crois pas en [idee recue courante]. Je crois en [votre conviction].",
    "En tant que [titre] depuis [duree], on me demande souvent [question]. Voici ma vraie reponse.",
    "Apres [X] ans a [action], j ai fait passer mon [element] de [avant] a [apres].",
    "J ai analyse [X] cas de [sujet]. La conclusion est toujours la meme.",
    "Les [X] choses les plus importantes que j enseignerai a mes enfants en tant que [titre].",
    "30 secondes de conseils sur [domaine] — ce que je dirais a mon meilleur ami s il repartait de zero.",
    "Cela fait [X] ans que [action]. Voici ce que la plupart des gens ignorent encore.",
    "Voici la difference entre [niveau 1], [niveau 2] et [niveau 3] en [sujet]."
  ],
  vente: [
    "Saviez-vous que vous pouviez [resultat] sans [contrainte principale] ?",
    "Si vous etes [cible] et que vous [probleme], et que vous voulez [resultat], voici un plan simple en [X] etapes.",
    "Voici [X] facons d obtenir [resultat] sans [obstacle]. Pour reference, j ai personnellement [mon resultat].",
    "Si vous voulez [resultat] d ici [delai] sans [douleur], ecoutez bien.",
    "La plupart des [cible] font [erreur commune] — et ca leur coute [consequence concrete].",
    "Ce que les meilleurs [cible] font differemment — et que personne ne vous explique vraiment.",
    "Si vous avez [probleme], [probleme], et [probleme], vous faites peut-etre [action] de travers.",
    "Vous pouvez avoir [resultat ideal] en simplifiant radicalement votre approche.",
    "Qu est-ce qui se passe quand vous arretez [action commune] pendant [duree] ?",
    "[Action] + [action] + [action] = [resultat]. J en suis la preuve."
  ],
  temo: [
    "[Profil] avait [probleme precis]. En [duree], on est passe a [resultat concret]. Voici exactement comment.",
    "Il y a [X] mois, [personne] m a dit [situation difficile]. Aujourd hui : [transformation].",
    "Je suis [metrique modeste] mais je suis devenu l un des meilleurs [titre] dans [domaine]. Voici comment.",
    "En grandissant, [personne] me reprenait quand je [action]. Ils avaient peut-etre tort.",
    "Ce n est pas moi qui le dis — c est [profil] qui a vecu ca de A a Z.",
    "Avant, [personne] [situation difficile]. Maintenant : [transformation nette].",
    "Il y a [X] ans j ai achete [element] a [age] avec [peu de moyens] et un emploi a temps plein.",
    "Voici comment j ai obtenu [resultat] malgre [contrainte ou handicap].",
    "Tout le monde me demandait comment [personne/moi] avait reussi [resultat]. Voici la vraie reponse.",
    "Ce projet aurait du echouer. Il n a pas echoue. Voici pourquoi."
  ],
  avis: [
    "Beaucoup de gens me demandent ce qui est mieux : [option 1] ou [option 2] pour [resultat]. J ai obtenu [resultat] avec l un des deux — et ca ne fait pas debat.",
    "Pas cher vs. Cher : [sujet]. Les resultats vont vous surprendre.",
    "Je ne crois pas en [idee repandue]. Et voici pourquoi.",
    "La tendance [X] est l une des pires choses que je vois dans [domaine]. Voici pourquoi.",
    "[Element A] et [element B] sont exactement pareils. Sauf que l un [resultat A] et l autre [resultat B]. Regardons pourquoi.",
    "Vous avez [option 1] et [option 2]. Qu est-ce que vous choisissez ? Et voici ce que je repondrais.",
    "Tout le monde conseille [action]. Mais si vous etes [cible], c est la pire chose a faire.",
    "On vous a menti sur [sujet]. Voici la verite.",
    "[Chose populaire] ne signifie pas [qualite supposee] — ca signifie juste [realite].",
    "Voici pourquoi [action courante] vous donne [mauvais resultat] — et comment l eviter."
  ],
  cas: [
    "Comment j ai fait passer [element] de [avant] a [apres] en [duree]. Chaque etape documentee.",
    "Est-il vraiment possible de [action A] tout en [action B] en [X] jours ? J ai essaye. Voici ce qui s est passe.",
    "Jour [X] de ma transformation de [etat avant] a [etat apres].",
    "Voici comment j ai obtenu [resultat] de facon [approche] — et ce que ca m a vraiment appris.",
    "Il y a [X] mois nous avons demarre [projet]. Resultat : [bilan reel, avec chiffres].",
    "J ai essaye [methode] pendant [duree]. Voici l honnete bilan.",
    "De [point de depart] a [resultat] en [duree]. Voici les vraies etapes — sans raccourcis.",
    "Ce cas aurait du echouer. Il n a pas echoue. Voici les vraies raisons.",
    "J ai documente [X] semaines de [action]. Voici ce que les donnees disent vraiment.",
    "Voici les [X] choses que je ne referais pas si je recommencais [projet/parcours] depuis zero."
  ],
  hybride: [
    "C est exactement le meme [element] — mais le premier [resultat A] et le second [resultat B]. Voici pourquoi.",
    "Tout le monde vous dit de [action] — mais vous pensez qu il est trop tard. Voici ce que vous devez vraiment savoir.",
    "[Sujet] pour les debutants. Ce que personne ne vous dit vraiment.",
    "Les choses qui freinent votre [progression] sans que vous vous en rendiez compte.",
    "Si vous avez [X] minutes par jour, voici exactement comment [resultat concret].",
    "Ce [element] m a change la vie — et ce n est pas ce que vous croyez.",
    "Voici ce que [X] annees de [experience] m ont appris — en moins de 60 secondes.",
    "La reponse courte : [resultat direct]. La reponse longue : voici pourquoi c est plus complexe que ca.",
    "J aurais voulu voir cette video a [age]. Voici ce qu elle m aurait appris.",
    "On m a dit que c etait impossible. J ai quand meme essaye. Le resultat va vous surprendre."
  ]
};

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
      "REHOOK 1 : 'Mais le vrai truc que personne ne dit, c est ca.' ou 'Et ca, la plupart des gens le ratent completement.' — oblige a rester.",
      "REHOOK 2 : accelere la tension avant la resolution. Demo = cas concret ou etape actionnable. Resultat = benefice chiffre ou transformationnel. CTA = une seule action precise."
    ]
  },
  story: {
    label: 'Storytelling',
    sections: ['HOOK', 'SETUP', 'TENSION', 'REHOOK 1', 'ESCALADE', 'REHOOK 2', 'TWIST', 'RESOLUTION'],
    structure: 'HOOK → SETUP → TENSION → REHOOK 1 → ESCALADE → REHOOK 2 → TWIST → RESOLUTION',
    logique: "Chaque rehook = mini cliffhanger. Le viewer ne peut pas partir sans connaitre la suite.",
    rules: [
      "REHOOK 1 (apres tension) : EXACTEMENT 'Et la, ca devient pire.' ou equivalent direct — pas une transition douce, un vrai choc narratif.",
      "REHOOK 2 (apres escalade) : EXACTEMENT 'Jusqu au moment ou...' — suspense maximum avant le twist. Pause mentale obligatoire.",
      "Setup = UNE phrase max, contexte minimum. Twist = inattendu mais logique retrospectivement. Resolution = lecon ou resultat clair, jamais vague."
    ]
  },
  direct: {
    label: 'Direct / Cash',
    sections: ['HOOK', 'VERITE', 'REHOOK 1', 'EXPLICATION', 'REHOOK 2', 'SOLUTION', 'CTA'],
    structure: 'HOOK → VERITE → REHOOK 1 → EXPLICATION → REHOOK 2 → SOLUTION → CTA',
    logique: "Une verite tranchante toutes les 10 secondes. Pas de nuance, pas de politesse. Chaque phrase se tient seule.",
    rules: [
      "Verite = statement choc, assertion forte, jamais une question ouverte — 'La plupart des [cible] font cette erreur.' / '[Croyance commune] ? C est faux.'",
      "REHOOK 1 : enfoncer le clou — 'Et le pire dans tout ca...' / 'Ce que les gens ne voient pas encore...' Phrase courte, impact maximal.",
      "Pas de conditionnel, pas de peut-etre, pas de 'on pourrait dire'. Solution = directe et actionnable. CTA = tranchant, une seule action."
    ]
  },
  autorite: {
    label: 'Autorite',
    sections: ['HOOK', 'CONSTAT', 'REHOOK', 'DECRYPTAGE', 'PREUVE', 'SYNTHESE', 'CTA'],
    structure: 'HOOK → CONSTAT → REHOOK → DECRYPTAGE → PREUVE → SYNTHESE → CTA',
    logique: "Positionner le createur comme la reference incontournable de son domaine. Chaque section doit exsuder une expertise que personne d autre ne possede.",
    rules: [
      "Constat = observation contre-intuitive ou contre-courante — pas une evidence que tout le monde connait. 'Ce que [l industrie] ne veut pas que tu saches.'",
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
      "REHOOK 1 (apres probleme) : intensifier — 'Et le pire dans tout ca...' / 'Ce que la plupart font alors ? L erreur fatale.' Pas d espoir encore.",
      "REHOOK 2 (apres agitation) : pivot espoir — EXACTEMENT 'Mais bonne nouvelle.' Deux mots. Pause. Puis la solution arrive comme un soulagement.",
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
      "REHOOK 1 : suspense narratif — 'Ce qu il a fait ensuite, personne n y avait pense.' / 'Et la, tout bascule.' Personnage clairement identifiable, situation precise.",
      "REHOOK 2 : 'Et c est la que tout a change.' Resultat = CONCRET avec chiffres si possible (pas 'ca a bien marche'). Validation = recommandation directe et sincere, pas corporate."
    ]
  },
  avis: {
    label: 'Avis tranche',
    sections: ['HOOK', 'POSITION', 'REHOOK 1', 'JUSTIFICATION', 'REHOOK 2', 'EXEMPLE', 'CONCLUSION', 'CTA'],
    structure: 'HOOK → POSITION → REHOOK 1 → JUSTIFICATION → REHOOK 2 → EXEMPLE → CONCLUSION → CTA',
    logique: "Provoquer une reaction, pas juste informer. La position doit diviser — ceux qui sont d accord et ceux qui ne le sont pas.",
    rules: [
      "Position = statement tranche, pas nuance. 'Je pense que [croyance commune] est une erreur.' / '[Pratique populaire] detruit [resultat]. Voila pourquoi.'",
      "REHOOK 1 : anticiper l objection — 'Je sais ce que tu te dis la...' puis la retourner. REHOOK 2 : exemple concret qui ecrase le doute.",
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
      "REHOOK (apres probleme) : 'Et c est la que tout a bascule.' / 'Ce qu on a fait ensuite a tout change.' Tension narrative maintenue.",
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
      "REHOOK 1 : 'Et voila ou ca devient vraiment interessant.' Story = UNE mini anecdote concrete : client reel / perso / cas public — une scene precise, pas un resume.",
      "REHOOK 2 : EXACTEMENT 'Et c est la que tout se joue.' Pause. Puis la lecon. Lecon = conseil concret et actionnable, extractible en 1 phrase. Pas philosophique."
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
    "Expert en scripting video oral pour Septup Studio Lyon. Contenu authentique, jamais generique.",
    "Script PARLE face camera — pas ecrit. 'Il est essentiel de...' → 'Ecoute. Y a un truc que...' / 'En conclusion...' → 'Alors voila. T as tout.'",
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

  return parts.join("\n");
}

// ─────────────────────────────────────────────────────────────
// callAPI — prompt 4 couches
// ─────────────────────────────────────────────────────────────
async function callAPI(prevScript, instruction) {
  var formatLabels = {
    video30: 'Video courte 30s (50 a 80 mots max — chaque mot compte, rythme tres eleve)',
    video60: 'Video courte 60s (110 a 160 mots — au moins un vrai rehook, structure nerveuse)',
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
    if (genData.selectedHook) {
      prompt += '\nCommence exactement par ce hook (mot pour mot) :\n' + genData.selectedHook + '\n';
    }
    var hooks = HOOKS_BY_ANGLE[sk] || HOOKS_BY_ANGLE['hybride'];
    prompt += '\nHOOKS DE REFERENCE (prends la structure et l energie — ne copie pas mot pour mot) :\n';
    hooks.forEach(function(h, i) { prompt += (i + 1) + '. ' + h + '\n'; });
    prompt += '\nTYPES DE HOOKS FORTS : verite derangeante / opposition forte / casse une croyance / constat direct — objectif : arreter le scroll. Evite toute intro classique.\n';
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
      + '\nPriorite absolue : naturel > structure, impact > perfection.\n'
      + 'Si le script est generique, trop propre ou ressemble a un template — recommence.\n'
      + 'Genere uniquement le script.';
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
    } else if (t) {
      body.push(markVerify(escapeHtml(lines[i])));
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
  if (clientRecord) {
    atCreate('Scripts', {
      'Titre': title, 'Contenu': text,
      'Score_viralite': parseFloat(document.getElementById('gen-vir-score').textContent) || 0,
      'Statut': 'Brouillon', 'Client': [clientRecord.id],
      'Email_client': currentUser ? currentUser.email : '',
      'Date_creation': new Date().toISOString()
    }).then(function(rec) {
      if (rec.id && scriptsStore[id]) { scriptsStore[id].airtableId = rec.id; scriptsStore[rec.id] = scriptsStore[id]; delete scriptsStore[id]; if (currentEditorId === id) currentEditorId = rec.id; renderScriptsList(); }
    }).catch(function(err) { console.error('[validateScript] atCreate error:', err); });
  }
  renderScriptsList();
  var el = document.getElementById('home-nb-scripts');
  if (el) el.textContent = Object.keys(scriptsStore).length;
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

// ═══ AUTH ═══
function initSupabase() {
  if (window.supabase) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    checkSession();
  } else {
    setTimeout(initSupabase, 200);
  }
}

async function checkSession() {
  // Gérer le retour OAuth Google (token dans l'URL #access_token=...)
  if (window.location.hash && window.location.hash.includes('access_token')) {
    // Supabase va intercepter automatiquement le hash et créer la session
    // On attend un court délai pour que Supabase traite le token
    await new Promise(function(r) { setTimeout(r, 500); });
    // Nettoie l'URL sans recharger la page
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  var result = await sb.auth.getSession();
  if (result.data && result.data.session) {
    currentUser = result.data.session.user;
    var email = currentUser.email;

    // Vérifie si le client existe dans Airtable
    var client = await loadClientData(email);

    if (!client) {
      // Nouveau client Google → créer automatiquement son profil Airtable
      // On utilise le nom Google si disponible
      var nom = currentUser.user_metadata && currentUser.user_metadata.full_name
        ? currentUser.user_metadata.full_name
        : email;
      await atCreate('Client', {
        'Nom_complet': nom,
        'Email': email
      });
      // Recharger le profil créé
      client = await loadClientData(email);
    }

    if (client) {
      clientRecord = client;
      renderAll(clientRecord, email);
      var sessions = [];
      try { sessions = await loadSessions(email); } catch(e) {}
      renderSessions(sessions);
      await loadScripts(clientRecord.id, email);
      go('home');
    } else {
      // Fallback : onboarding si la création Airtable a échoué
      go('ob1');
    }
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
  selectedScripts = {};
  currentEditorId = null;
  currentEditorText = '';
  // Reset UI
  document.getElementById('scripts-list').innerHTML = '<div style="padding:24px 16px;text-align:center;font-size:13px;color:var(--text3);">Chargement...</div>';
  document.getElementById('sess-passees').innerHTML = '<div style="padding:20px 16px;font-size:13px;color:var(--text3);">Chargement...</div>';
  document.getElementById('sess-avenir').innerHTML = '';
  closeCompte();
  go('login');
}

async function doSignup() {
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
    // Lire les réponses onboarding
    var obPrix = document.querySelector('#ob2-prix-opts .ob-opt.sel');
    var obMaturite = document.querySelector('#ob2-maturite-opts .ob-opt.sel');
    var obObjectif = document.querySelector('#ob4-objectif-opts .ob-opt.sel');
    var obTon = document.querySelector('#ob5-ton-opts .ob-opt.sel');
    var obIntensite = document.querySelector('#ob5-intensite-opts .ob-opt.sel');
    var obLangage = document.querySelector('#ob5-langage-opts .ob-opt.sel');
    // KPI = chips multiples
    var obKpi = Array.from(document.querySelectorAll('#ob4-kpi-chips .ob-chip.sel'))
      .map(function(c) { return c.textContent.trim(); }).join(', ');

    await atCreate('Client', {
      'Nom_complet': nom,
      'Email': email,
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

