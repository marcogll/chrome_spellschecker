// content_script.js — Inyectado en cada página
// Detecta errores ortográficos y muestra subrayados + sugerencias

(function () {
  'use strict';

  // Log inmediato para verificar que el content script se cargó
  console.log('[SpellCheck] Content script cargado en:', window.location.href);

  let enabled = true;
  let currentLang = null;
  let pendingCheck = null;
  const DEBOUNCE_MS = 600;

  // ─── Observar campos de texto editables ────────────────────────────────────
  function attachTo(el) {
    if (el._spellAttached) return;
    el._spellAttached = true;

    el.addEventListener('input', () => {
      if (!enabled) return;
      clearTimeout(pendingCheck);
      pendingCheck = setTimeout(() => checkElement(el), DEBOUNCE_MS);
    });

    el.addEventListener('blur', () => removeHighlights(el));
  }

  function observeDOM() {
    const selector = 'input[type="text"], input:not([type]), textarea, [contenteditable="true"]';
    document.querySelectorAll(selector).forEach(attachTo);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            if (node.matches?.(selector)) attachTo(node);
            node.querySelectorAll?.(selector).forEach(attachTo);
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Verificar palabras de un elemento ────────────────────────────────────
  async function checkElement(el) {
    if (!enabled) {
      console.log('[SpellCheck] Extensión desactivada');
      return;
    }
    
    const text = el.value ?? el.innerText ?? '';
    if (!text.trim()) {
      console.log('[SpellCheck] Texto vacío');
      return;
    }
    
    console.log('[SpellCheck] Verificando elemento:', el.tagName, 'texto:', text.substring(0, 50) + '...');

    // Detectar idioma del texto completo
    const langResp = await sendMsg({ type: 'DETECT_LANG', text });
    currentLang = langResp?.lang ?? null;
    console.log('[SpellCheck] Idioma detectado:', currentLang);

    // Extraer palabras únicas
    const wordSet = new Set(
      text.match(/[a-záéíóúüñàâãäåæçèêëìîïðòôõöøùûüýþÿœ'-]+/gi) || []
    );
    const words = [...wordSet].filter(w => w.length > 1);
    console.log('[SpellCheck] Palabras encontradas:', words.length, words.slice(0, 10));
    if (!words.length) return;

    const resp = await sendMsg({ type: 'CHECK_WORDS', words, lang: currentLang });
    console.log('[SpellCheck] Respuesta del background:', resp);
    
    if (!resp?.results) {
      console.log('[SpellCheck] No hay resultados del background');
      return;
    }

    const errors = words.filter(w => !resp.results[w.toLowerCase()]?.correct);
    console.log('[SpellCheck] Errores encontrados:', errors);
    renderHighlights(el, text, errors, resp.results);
  }

  // ─── Renderizado de subrayados ─────────────────────────────────────────────
  // Para inputs/textarea usamos un div espejo flotante.
  // Para contenteditable marcamos directamente el DOM.

  function renderHighlights(el, text, errors, results) {
    removeHighlights(el);
    if (!errors.length) return;

    const isContentEditable = el.contentEditable === 'true';
    if (isContentEditable) {
      markContentEditable(el, errors, results);
    } else {
      createMirror(el, text, errors, results);
    }
  }

  function removeHighlights(el) {
    const mirror = el._spellMirror;
    if (mirror) { mirror.remove(); el._spellMirror = null; }
    closeSuggestionBox();
  }

  // ─── Espejo para input/textarea ───────────────────────────────────────────
  function createMirror(el, text, errors, results) {
    console.log('[SpellCheck] Creando espejo para', el.tagName, 'con', errors.length, 'errores');
    
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);

    const mirror = document.createElement('div');
    mirror.className = 'sc-mirror';
    Object.assign(mirror.style, {
      position: 'fixed',
      top: rect.top + 'px',
      left: rect.left + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
      pointerEvents: 'none',
      overflow: 'hidden',
      zIndex: '2147483640',
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      padding: style.padding,
      boxSizing: 'border-box',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      color: 'transparent',
      background: 'transparent',
    });

    mirror.innerHTML = buildHighlightedHTML(text, errors, results);
    document.body.appendChild(mirror);
    el._spellMirror = mirror;

    // Sincronizar scroll
    const syncScroll = () => {
      mirror.scrollTop = el.scrollTop;
      mirror.scrollLeft = el.scrollLeft;
    };
    el.addEventListener('scroll', syncScroll);
    syncScroll();

    console.log('[SpellCheck] Espejo creado y añadido al DOM');
    
    // Debug: mostrar qué errores se marcaron
    const errorMarks = mirror.querySelectorAll('.sc-error');
    console.log('[SpellCheck] Marcas de error en el espejo:', errorMarks.length);
  }

  function buildHighlightedHTML(text, errors, results) {
    // Escapar HTML
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Reemplazar palabras erróneas
    const errorSet = new Set(errors.map(e => e.toLowerCase()));
    console.log('[SpellCheck] Palabras a marcar:', [...errorSet]);
    
    const result = escaped.replace(/[a-záéíóúüñàâãäåæçèêëìîïðòôõöøùûüýþÿœ'-]+/gi, (match) => {
      if (errorSet.has(match.toLowerCase())) {
        console.log('[SpellCheck] Marcando error:', match);
        return `<mark class="sc-error" data-word="${match.toLowerCase()}">${match}</mark>`;
      }
      return match;
    });
    
    return result;
  }

  // ─── Marcar en contenteditable ────────────────────────────────────────────
  function markContentEditable(el, errors, results) {
    // Guardamos la posición del cursor
    const sel = window.getSelection();
    const range = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;

    const errorSet = new Set(errors.map(e => e.toLowerCase()));
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const node of textNodes) {
      const parent = node.parentNode;
      if (!parent || parent.classList?.contains('sc-error')) continue;

      const parts = node.textContent.split(/([a-záéíóúüñàâãäåæçèêëìîïðòôõöøùûüýþÿœ'-]+)/gi);
      if (parts.length <= 1) continue;

      const frag = document.createDocumentFragment();
      let hasError = false;
      for (const part of parts) {
        if (errorSet.has(part.toLowerCase())) {
          hasError = true;
          const mark = document.createElement('mark');
          mark.className = 'sc-error';
          mark.dataset.word = part.toLowerCase();
          mark.textContent = part;
          mark.setAttribute('data-suggestions', JSON.stringify(results[part.toLowerCase()]?.suggestions || []));
          frag.appendChild(mark);
        } else {
          frag.appendChild(document.createTextNode(part));
        }
      }
      if (hasError) parent.replaceChild(frag, node);
    }

    // Restaurar cursor
    if (range) {
      try { sel.removeAllRanges(); sel.addRange(range); } catch (_) {}
    }
  }

  // ─── Caja de sugerencias ──────────────────────────────────────────────────
  let suggestionBox = null;

  function showSuggestions(word, suggestions, x, y) {
    closeSuggestionBox();

    const box = document.createElement('div');
    box.className = 'sc-suggestions';
    box.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:2147483647;`;

    const header = document.createElement('div');
    header.className = 'sc-suggestions-header';
    header.textContent = `"${word}"`;
    box.appendChild(header);

    if (suggestions.length === 0) {
      const none = document.createElement('div');
      none.className = 'sc-suggestion-none';
      none.textContent = chrome.i18n.getMessage('noSuggestions') || 'Sin sugerencias';
      box.appendChild(none);
    } else {
      suggestions.forEach(sug => {
        const btn = document.createElement('button');
        btn.className = 'sc-suggestion-btn';
        btn.textContent = sug;
        btn.addEventListener('click', () => {
          replaceWord(word, sug);
          closeSuggestionBox();
        });
        box.appendChild(btn);
      });
    }

    // Botón "Agregar al diccionario"
    const addBtn = document.createElement('button');
    addBtn.className = 'sc-suggestion-add';
    addBtn.textContent = chrome.i18n.getMessage('addToDictionary') || 'Agregar al diccionario';
    addBtn.addEventListener('click', async () => {
      await sendMsg({ type: 'ADD_USER_WORD', word });
      document.querySelectorAll(`.sc-error[data-word="${word}"]`).forEach(el => {
        el.replaceWith(document.createTextNode(el.textContent));
      });
      closeSuggestionBox();
    });
    box.appendChild(addBtn);

    document.body.appendChild(box);
    suggestionBox = box;

    // Ajustar si sale de pantalla
    const r = box.getBoundingClientRect();
    if (r.right > window.innerWidth) box.style.left = (window.innerWidth - r.width - 8) + 'px';
    if (r.bottom > window.innerHeight) box.style.top = (y - r.height - 4) + 'px';
  }

  function closeSuggestionBox() {
    if (suggestionBox) { suggestionBox.remove(); suggestionBox = null; }
  }

  function replaceWord(old, replacement) {
    const active = document.activeElement;
    if (!active) return;
    if (active.value !== undefined) {
      // input/textarea
      const val = active.value;
      const re = new RegExp('\\b' + old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      active.value = val.replace(re, replacement);
      active.dispatchEvent(new Event('input'));
    } else {
      // contenteditable
      const sel = window.getSelection();
      if (sel.rangeCount) {
        const range = sel.getRangeAt(0);
        range.selectNode(range.commonAncestorContainer);
      }
      document.execCommand('insertText', false, replacement);
    }
  }

  // ─── Delegación de eventos de clic en errores ─────────────────────────────
  document.addEventListener('click', (e) => {
    const mark = e.target.closest('.sc-error');
    if (mark) {
      e.stopPropagation();
      const word = mark.dataset.word;
      const suggestions = JSON.parse(mark.dataset.suggestions || '[]');

      // Si no tenemos sugerencias precargadas, pedirlas al background
      if (!mark.dataset.suggestions) {
        sendMsg({ type: 'CHECK_WORDS', words: [word], lang: currentLang }).then(resp => {
          const sug = resp?.results?.[word]?.suggestions || [];
          showSuggestions(word, sug, e.clientX, e.clientY + 16);
        });
      } else {
        showSuggestions(word, suggestions, e.clientX, e.clientY + 16);
      }
      return;
    }
    if (!e.target.closest('.sc-suggestions')) {
      closeSuggestionBox();
    }
  });

  // ─── Mensajes desde background ────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TOGGLE') {
      enabled = msg.enabled;
      if (!enabled) {
        document.querySelectorAll('.sc-error').forEach(el => {
          el.replaceWith(document.createTextNode(el.textContent));
        });
        document.querySelectorAll('.sc-mirror').forEach(m => m.remove());
      }
    }
    if (msg.type === 'WORD_ADDED') {
      document.querySelectorAll(`.sc-error[data-word="${msg.word}"]`).forEach(el => {
        el.replaceWith(document.createTextNode(el.textContent));
      });
    }
  });

  // ─── Utilidades ───────────────────────────────────────────────────────────
  function sendMsg(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (resp) => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          resolve(resp);
        });
      } catch (_) { resolve(null); }
    });
  }

  // ─── Inicio ───────────────────────────────────────────────────────────────
  async function init() {
    console.log('[SpellCheck] Inicializando content script...');
    try {
      const { enabled: en = true } = await chrome.storage.local.get('enabled');
      enabled = en;
      console.log('[SpellCheck] Estado:', enabled ? 'activado' : 'desactivado');
      observeDOM();
      console.log('[SpellCheck] Content script inicializado correctamente');
    } catch (e) {
      console.error('[SpellCheck] Error al inicializar:', e);
    }
  }

  init();
})();
