// dict_manager.js — Gestiona diccionarios Hunspell vía IndexedDB
// Soporta múltiples idiomas y detección automática

const DB_NAME = 'spellcheck_dicts';
const DB_VERSION = 2;
const STORE_DICTS = 'dictionaries';
const STORE_USER = 'user_words';
const PRIMARY_LANG = 'es';
const FALLBACK_LANG_ORDER = ['es', 'en'];

// Caché en memoria de instancias Hunspell (requiere nspell o similar WASM)
// Usamos una implementación puramente JS ligera que funciona sin WASM
// para mayor compatibilidad con Manifest V3 service workers.

export class DictManager {
  constructor() {
    this._db = null;
    this._checkers = {}; // lang -> SimpleChecker
    this._userWords = new Set();
    this._loadedLangs = [];
  }

  // ─── Base de datos ────────────────────────────────────────────────────────
  async _getDB() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_DICTS)) {
          db.createObjectStore(STORE_DICTS, { keyPath: 'lang' });
        }
        if (!db.objectStoreNames.contains(STORE_USER)) {
          db.createObjectStore(STORE_USER, { keyPath: 'word' });
        }
      };
      req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
      req.onerror = () => reject(req.error);
    });
  }

  async _dbGet(store, key) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async _dbPut(store, value) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async _dbDelete(store, key) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async _dbGetAll(store) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ─── Inicialización ───────────────────────────────────────────────────────
  async init() {
    await this._getDB();
    // Cargar palabras de usuario
    const userRows = await this._dbGetAll(STORE_USER);
    this._userWords = new Set(userRows.map(r => r.word));
    // Recargar diccionarios guardados
    const dicts = await this._dbGetAll(STORE_DICTS);
    console.log(`[DictManager] Diccionarios encontrados en DB:`, dicts.length);
    for (const dict of dicts) {
      console.log(`[DictManager] Cargando idioma: ${dict.lang}, tamaño .dic: ${dict.dicText?.length || 0} chars`);
      await this._buildChecker(dict.lang, dict.dicText);
      this._loadedLangs.push(dict.lang);
    }
    console.log(`[DictManager] Idiomas cargados: ${this._loadedLangs.join(', ') || 'ninguno'}`);
    console.log(`[DictManager] Palabras en diccionario personal: ${this._userWords.size}`);
  }

  // ─── Carga de diccionario ─────────────────────────────────────────────────
  /**
   * Carga un diccionario desde datos base64 (enviados desde popup).
   * El .aff define reglas de afijos; el .dic contiene la lista de palabras.
   */
  async loadFromBase64(lang, affBase64, dicBase64) {
    const dicText = atob(dicBase64);
    const affText = atob(affBase64);
    await this._dbPut(STORE_DICTS, { lang, dicText, affText, addedAt: Date.now() });
    await this._buildChecker(lang, dicText);
    if (!this._loadedLangs.includes(lang)) {
      this._loadedLangs.push(lang);
    }
  }

  async removeLang(lang) {
    await this._dbDelete(STORE_DICTS, lang);
    delete this._checkers[lang];
    this._loadedLangs = this._loadedLangs.filter(l => l !== lang);
  }

  async getLoadedLangs() {
    return [...this._loadedLangs];
  }

  // ─── Motor de corrección ligero ───────────────────────────────────────────
  /**
   * Construye un corrector simple basado en el .dic de Hunspell.
   * Parsea líneas del tipo: palabra/REGLAS
   * Para detección de errores usamos lookup directo.
   * Las sugerencias usan distancia de edición (Levenshtein).
   */
  async _buildChecker(lang, dicText) {
    const lines = dicText.split('\n');
    const wordSet = new Set();
    // Primera línea es el conteo — la saltamos
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // Tomar solo la parte antes del '/'
      const word = line.split('/')[0].toLowerCase();
      if (word) wordSet.add(word);
    }
    this._checkers[lang] = new SimpleChecker(wordSet);
  }

  // ─── API de verificación ──────────────────────────────────────────────────
  async check(word, lang) {
    const w = word.toLowerCase().replace(/[^a-záéíóúüñàâãäåæçèêëìîïðòôõöøùûüýþÿœœ'-]/gi, '');
    if (!w || w.length < 2) return { correct: true, suggestions: [] };
    // Siempre correcto si está en diccionario personal
    if (this._userWords.has(w)) return { correct: true, suggestions: [] };
    // Correcto si es un número o sigla corta
    if (/^\d+$/.test(w) || (w.length <= 2 && /^[A-Z]+$/i.test(w))) {
      return { correct: true, suggestions: [] };
    }

    const checker = lang && this._checkers[lang]
      ? this._checkers[lang]
      : this._getAnyChecker();

    if (!checker) return { correct: true, suggestions: [] };

    const correct = checker.check(w);
    if (correct) return { correct: true, suggestions: [] };

    const suggestions = checker.suggest(w, 6);
    return { correct: false, suggestions };
  }

  _getAnyChecker() {
    const langs = this._getPreferredLangs();
    if (langs.length === 0) return null;
    return this._checkers[langs[0]] || null;
  }

  // ─── Detección automática de idioma ──────────────────────────────────────
  async detectLang(text) {
    if (this._loadedLangs.length === 0) return null;
    if (this._loadedLangs.length === 1) return this._loadedLangs[0];

    // Primero, detectar por caracteres específicos del idioma
    const langByChars = this._detectBySpecialChars(text);
    if (langByChars) {
      console.log('[DictManager] Idioma detectado por caracteres especiales:', langByChars);
      return langByChars;
    }

    // Si no, usar análisis estadístico de palabras
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const sample = words.slice(0, 100);
    if (sample.length === 0) return this._getDefaultLang();

    const scores = {};
    const wordCounts = {};

    for (const lang of this._loadedLangs) {
      const checker = this._checkers[lang];
      if (!checker) continue;
      let hits = 0;
      let totalChecked = 0;
      
      for (const w of sample) {
        // Solo verificar palabras que no sean números o siglas
        if (w.length > 2 && /[a-záéíóúüñàâãäåæçèêëìîïðòôõöøùûüýþÿœ]/.test(w)) {
          totalChecked++;
          if (checker.check(w)) hits++;
        }
      }
      
      // Calcular porcentaje de coincidencia
      const percentage = totalChecked > 0 ? (hits / totalChecked) : 0;
      scores[lang] = percentage;
      wordCounts[lang] = hits;
    }

    // Ordenar por puntuación
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const best = ranked[0];
    const second = ranked[1];

    console.log('[DictManager] Puntuaciones de idioma:', scores);

    // Si el mejor tiene una ventaja clara (>15%), usarlo
    if (best && best[1] > 0.3) {
      if (!second || (best[1] - second[1]) > 0.15) {
        console.log('[DictManager] Idioma detectado por estadística:', best[0], `(${Math.round(best[1]*100)}%)`);
        return best[0];
      }
    }

    // Si hay empate o poca confianza, usar idioma por defecto
    return this._getDefaultLang();
  }

  _detectBySpecialChars(text) {
    // Caracteres específicos de cada idioma
    const patterns = {
      'es': /[áéíóúüñ¿¡]/i,  // Español
      'en': null,  // Inglés no tiene caracteres especiales únicos
      'fr': /[àâäæçéèêëïîôœùûüÿ]/i,  // Francés
      'de': /[äöüß]/i,  // Alemán
      'pt': /[áâãàçéêíóôõú]/i,  // Portugués
      'it': /[àèéìòù]/i,  // Italiano
    };

    // Verificar caracteres especiales
    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern && pattern.test(text) && this._checkers[lang]) {
        // Verificar que sea suficientemente único (no demasiadas coincidencias)
        let uniqueCount = 0;
        for (const [otherLang, otherPattern] of Object.entries(patterns)) {
          if (otherLang !== lang && otherPattern && otherPattern.test(text)) {
            uniqueCount++;
          }
        }
        // Si es único o tiene poco overlap, usarlo
        if (uniqueCount <= 1) {
          return lang;
        }
      }
    }

    return null;
  }

  _getDefaultLang() {
    if (this._checkers[PRIMARY_LANG]) return PRIMARY_LANG;
    return this._getPreferredLangs()[0] || this._loadedLangs[0] || null;
  }

  _getPreferredLangs() {
    const installed = Object.keys(this._checkers);
    return installed.sort((a, b) => this._langPriority(a) - this._langPriority(b));
  }

  _langPriority(lang) {
    const idx = FALLBACK_LANG_ORDER.indexOf(lang);
    return idx === -1 ? FALLBACK_LANG_ORDER.length : idx;
  }

  // ─── Diccionario personal ─────────────────────────────────────────────────
  async addUserWord(word) {
    const w = word.toLowerCase();
    this._userWords.add(w);
    await this._dbPut(STORE_USER, { word: w, addedAt: Date.now() });
  }

  async removeUserWord(word) {
    this._userWords.delete(word);
    await this._dbDelete(STORE_USER, word);
  }

  async getUserWords() {
    const rows = await this._dbGetAll(STORE_USER);
    return rows.map(r => r.word);
  }
}

// ─── Corrector simple en JavaScript puro ─────────────────────────────────────
class SimpleChecker {
  constructor(wordSet) {
    this._words = wordSet;
    // Índice por longitud para acelerar sugerencias
    this._byLen = {};
    for (const w of wordSet) {
      const l = w.length;
      if (!this._byLen[l]) this._byLen[l] = [];
      this._byLen[l].push(w);
    }
  }

  check(word) {
    return this._words.has(word.toLowerCase());
  }

  suggest(word, max = 6) {
    const w = word.toLowerCase();
    const candidates = [];
    // Buscar en palabras de longitud ±2
    for (let delta = -2; delta <= 2; delta++) {
      const len = w.length + delta;
      const bucket = this._byLen[len] || [];
      for (const candidate of bucket) {
        const dist = this._levenshtein(w, candidate);
        if (dist <= 3) {
          candidates.push({ word: candidate, dist });
        }
      }
    }
    candidates.sort((a, b) => a.dist - b.dist);
    return candidates.slice(0, max).map(c => c.word);
  }

  _levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }
    return dp[m][n];
  }
}
