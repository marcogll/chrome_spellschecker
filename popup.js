// popup.js — Lógica del popup de la extensión

// ─── Helpers ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const sendMsg = (msg) => new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));

const LANG_META = {
  es: { name: 'Español',    flag: '🇪🇸' },
  en: { name: 'English',    flag: '🇺🇸' },
  fr: { name: 'Français',   flag: '🇫🇷' },
  de: { name: 'Deutsch',    flag: '🇩🇪' },
  pt: { name: 'Português',  flag: '🇧🇷' },
  it: { name: 'Italiano',   flag: '🇮🇹' },
  nl: { name: 'Nederlands', flag: '🇳🇱' },
  pl: { name: 'Polski',     flag: '🇵🇱' },
  ru: { name: 'Русский',    flag: '🇷🇺' },
  ca: { name: 'Català',     flag: '🏳️' },
};

function getLangMeta(lang) {
  const code = lang.toLowerCase().split('-')[0].split('_')[0];
  return LANG_META[code] || { name: lang.toUpperCase(), flag: '🌐' };
}

function showFeedback(msg, type = 'success') {
  const el = $('feedback');
  el.textContent = msg;
  el.className = `feedback ${type}`;
  if (type !== 'loading') setTimeout(() => el.className = 'feedback', 3000);
}

function setProgress(pct) {
  const bar = $('progress-bar');
  const fill = $('progress-fill');
  if (pct === null) { bar.classList.remove('visible'); return; }
  bar.classList.add('visible');
  fill.style.width = pct + '%';
}

// ─── Estado y renderizado ─────────────────────────────────────────────────────
async function loadStatus() {
  const { langs, enabled, wordCount } = await sendMsg({ type: 'GET_STATUS' }) || {};

  // Toggle global
  $('toggle-enabled').checked = enabled !== false;

  // Mostrar/ocultar pantalla de bienvenida
  const hasDicts = langs && langs.length > 0;
  const welcomeScreen = $('welcome-screen');
  const normalView = $('normal-view');
  
  if (welcomeScreen && normalView) {
    if (hasDicts) {
      welcomeScreen.style.display = 'none';
      normalView.style.display = 'block';
    } else {
      welcomeScreen.style.display = 'block';
      normalView.style.display = 'none';
    }
  }

  // Status bar
  if (!hasDicts) {
    $('status-dot').className = 'status-dot empty';
    $('status-langs').textContent = 'Sin diccionarios';
    $('status-text').textContent = 'Instala un diccionario para empezar';
  } else {
    $('status-dot').className = 'status-dot';
    const names = langs.map(l => getLangMeta(l).name).join(', ');
    $('status-langs').textContent = names;
    $('status-text').textContent = enabled !== false
      ? `Activo · ${langs.length} idioma${langs.length > 1 ? 's' : ''}`
      : 'Desactivado';
  }

  renderDictList(langs || []);
}

function renderDictList(langs) {
  const list = $('dict-list');
  if (!langs.length) {
    list.innerHTML = '<div class="dict-empty">No hay diccionarios instalados</div>';
    return;
  }
  list.innerHTML = '';
  langs.forEach(lang => {
    const meta = getLangMeta(lang);
    const item = document.createElement('div');
    item.className = 'dict-item';
    item.innerHTML = `
      <span class="dict-flag">${meta.flag}</span>
      <div class="dict-info">
        <div class="dict-name">${meta.name}</div>
        <div class="dict-meta">Código: ${lang}</div>
      </div>
      <button class="dict-remove" data-lang="${lang}" title="Eliminar diccionario">✕</button>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('.dict-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lang = btn.dataset.lang;
      if (!confirm(`¿Eliminar el diccionario de ${getLangMeta(lang).name}?`)) return;
      await sendMsg({ type: 'REMOVE_DICTIONARY', lang });
      showFeedback(`Diccionario ${lang} eliminado.`);
      loadStatus();
    });
  });
}

async function renderWordList() {
  const { words } = await sendMsg({ type: 'GET_USER_WORDS' }) || { words: [] };
  const list = $('word-list');
  if (!words || !words.length) {
    list.innerHTML = '<div class="dict-empty">Ninguna palabra agregada todavía</div>';
    return;
  }
  list.innerHTML = '';
  words.sort().forEach(word => {
    const chip = document.createElement('div');
    chip.className = 'word-chip';
    chip.innerHTML = `
      <span>${word}</span>
      <button data-word="${word}" title="Eliminar">✕</button>
    `;
    list.appendChild(chip);
  });
  list.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      await sendMsg({ type: 'REMOVE_USER_WORD', word: btn.dataset.word });
      renderWordList();
    });
  });
}

// ─── Carga de diccionarios desde archivo ──────────────────────────────────────
/**
 * El usuario puede cargar:
 *   - Un par de archivos: idioma.aff + idioma.dic
 *   - Un archivo .zip que contenga ambos
 *
 * Detectamos el idioma del nombre del archivo.
 */
async function handleFiles(files) {
  const fileArr = Array.from(files);

  // Agrupar por nombre base (sin extensión)
  const groups = {};
  for (const file of fileArr) {
    const name = file.name.toLowerCase();
    const ext = name.split('.').pop();
    if (!['aff', 'dic', 'zip'].includes(ext)) {
      showFeedback(`Archivo ignorado: ${file.name} (debe ser .aff, .dic o .zip)`, 'error');
      continue;
    }
    const base = name.replace(/\.(aff|dic|zip)$/, '');
    if (!groups[base]) groups[base] = {};
    groups[base][ext] = file;
  }

  for (const [base, exts] of Object.entries(groups)) {
    setProgress(10);
    showFeedback(`Cargando ${base}...`, 'loading');

    try {
      let affB64, dicB64, lang;

      if (exts.zip) {
        // Para ZIP necesitaríamos JSZip; mostramos instrucciones
        showFeedback('Para archivos .zip, extrae primero los .aff y .dic', 'error');
        setProgress(null);
        continue;
      }

      if (!exts.aff || !exts.dic) {
        showFeedback(`Se necesitan ambos archivos: ${base}.aff y ${base}.dic`, 'error');
        setProgress(null);
        continue;
      }

      setProgress(30);
      affB64 = await fileToBase64(exts.aff);
      setProgress(60);
      dicB64 = await fileToBase64(exts.dic);
      setProgress(80);

      // Detectar idioma del nombre
      lang = detectLangFromFilename(base);

      const resp = await sendMsg({
        type: 'LOAD_DICTIONARY',
        lang,
        affData: affB64,
        dicData: dicB64,
      });

      setProgress(100);

      if (resp?.success) {
        showFeedback(`✓ Diccionario "${getLangMeta(lang).name}" cargado correctamente`);
      } else {
        showFeedback(`Error al cargar ${base}: ${resp?.error || 'desconocido'}`, 'error');
      }
    } catch (e) {
      showFeedback(`Error: ${e.message}`, 'error');
    }

    setTimeout(() => setProgress(null), 600);
    await loadStatus();
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result es "data:...;base64,XXXX" — tomamos solo la parte base64
      const b64 = reader.result.split(',')[1];
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function detectLangFromFilename(base) {
  // Normalizar: es_ES, es-ES, spanish, english, etc.
  const lower = base.toLowerCase();
  
  // Mapeo de nombres comunes a códigos ISO
  const langMap = {
    'spanish': 'es',
    'english': 'en',
    'french': 'fr',
    'german': 'de',
    'portuguese': 'pt',
    'italian': 'it',
    'dutch': 'nl',
    'polish': 'pl',
    'russian': 'ru',
    'catalan': 'ca',
    'español': 'es',
    'ingles': 'en',
    'frances': 'fr',
    'aleman': 'de',
    'portugues': 'pt',
    'italiano': 'it',
    'neerlandes': 'nl',
    'polaco': 'pl',
    'ruso': 'ru'
  };
  
  // Primero intentar mapeo directo
  if (langMap[lower]) {
    return langMap[lower];
  }
  
  // Si no, extraer código ISO del nombre (es_ES, en-US, etc.)
  const code = lower.split(/[-_.]/)[0];
  return code;
}

// ─── Drag & drop ──────────────────────────────────────────────────────────────
const dropZone = $('drop-zone');
const fileInput = $('file-input');

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) handleFiles(e.target.files);
  e.target.value = '';
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.style.borderColor = 'var(--accent)';
  dropZone.style.background = 'var(--accent-bg)';
});

dropZone.addEventListener('dragleave', () => {
  dropZone.style.borderColor = '';
  dropZone.style.background = '';
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.style.borderColor = '';
  dropZone.style.background = '';
  handleFiles(e.dataTransfer.files);
});

// ─── Toggle global ────────────────────────────────────────────────────────────
$('toggle-enabled').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ enabled: e.target.checked });
  // Notificar a la pestaña activa
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE', enabled: e.target.checked });
  }
  loadStatus();
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    $('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'words') renderWordList();
  });
});

// ─── Instalación automática de diccionarios ─────────────────────────────────
const DICTIONARY_URLS = {
  es: {
    aff: 'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/es/index.aff',
    dic: 'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/es/index.dic',
    name: 'Español'
  },
  en: {
    aff: 'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/en/index.aff',
    dic: 'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/en/index.dic',
    name: 'English'
  },
  fr: {
    aff: 'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/fr/index.aff',
    dic: 'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/fr/index.dic',
    name: 'Français'
  },
  de: {
    aff: 'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/de/index.aff',
    dic: 'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/de/index.dic',
    name: 'Deutsch'
  },
  pt: {
    aff: 'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/pt/index.aff',
    dic: 'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/pt/index.dic',
    name: 'Português'
  },
  it: {
    aff: 'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/it/index.aff',
    dic: 'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/it/index.dic',
    name: 'Italiano'
  }
};

async function downloadAndInstallDictionary(langCode) {
  const dict = DICTIONARY_URLS[langCode];
  if (!dict) {
    showFeedback(`Idioma no soportado: ${langCode}`, 'error');
    return;
  }

  showFeedback(`Descargando ${dict.name}...`, 'loading');
  setProgress(10);

  try {
    // Descargar archivos
    setProgress(30);
    const [affResponse, dicResponse] = await Promise.all([
      fetch(dict.aff),
      fetch(dict.dic)
    ]);

    if (!affResponse.ok || !dicResponse.ok) {
      throw new Error('Error al descargar los archivos');
    }

    setProgress(60);
    const [affText, dicText] = await Promise.all([
      affResponse.text(),
      dicResponse.text()
    ]);

    setProgress(80);
    // Convertir a base64
    const affBase64 = btoa(unescape(encodeURIComponent(affText)));
    const dicBase64 = btoa(unescape(encodeURIComponent(dicText)));

    // Instalar
    const resp = await sendMsg({
      type: 'LOAD_DICTIONARY',
      lang: langCode,
      affData: affBase64,
      dicData: dicBase64,
    });

    setProgress(100);

    if (resp?.success) {
      showFeedback(`✓ Diccionario "${dict.name}" instalado correctamente`);
      await loadStatus();
    } else {
      showFeedback(`Error al instalar: ${resp?.error || 'desconocido'}`, 'error');
    }
  } catch (e) {
    showFeedback(`Error: ${e.message}`, 'error');
    console.error('Error instalando diccionario:', e);
  }

  setTimeout(() => setProgress(null), 600);
}

// Event listeners para botones de instalación automática
document.querySelectorAll('.auto-install').forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.dataset.lang;
    downloadAndInstallDictionary(lang);
  });
});

// Botones de instalación rápida (en pantalla de bienvenida)
const quickInstallEs = $('quick-install-es');
const quickInstallEn = $('quick-install-en');
const quickInstallBoth = $('quick-install-both');

if (quickInstallEs) {
  quickInstallEs.addEventListener('click', () => downloadAndInstallDictionary('es'));
}
if (quickInstallEn) {
  quickInstallEn.addEventListener('click', () => downloadAndInstallDictionary('en'));
}
if (quickInstallBoth) {
  quickInstallBoth.addEventListener('click', async () => {
    showFeedback('Instalando español e inglés...', 'loading');
    await downloadAndInstallDictionary('es');
    await downloadAndInstallDictionary('en');
    showFeedback('¡Diccionarios instalados correctamente!');
  });
}

// ─── Inicio ───────────────────────────────────────────────────────────────────
loadStatus();
