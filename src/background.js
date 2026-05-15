// background.js — Service Worker principal
// Maneja mensajes, menú contextual y estado global

import { DictManager } from './dict_manager.js';
import { applyDailyIcon } from './icon_manager.js';

const dictManager = new DictManager();

// ─── Inicialización ───────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  await dictManager.init();
  await applyDailyIcon();
  scheduleDailyIconRefresh();
  buildContextMenu();
  console.log('[SpellCheck] Extensión instalada correctamente.');
});

chrome.runtime.onStartup.addListener(async () => {
  await dictManager.init();
  await applyDailyIcon();
  scheduleDailyIconRefresh();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'daily-icon-refresh') {
    await applyDailyIcon();
  }
});

function scheduleDailyIconRefresh() {
  chrome.alarms.create('daily-icon-refresh', { periodInMinutes: 60 });
}

// ─── Menú contextual ──────────────────────────────────────────────────────────
function buildContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'spellcheck-root',
      title: chrome.i18n.getMessage('ctxMenuTitle'),
      contexts: ['editable'],
    });
    chrome.contextMenus.create({
      id: 'add-to-dict',
      parentId: 'spellcheck-root',
      title: chrome.i18n.getMessage('ctxAddWord'),
      contexts: ['editable'],
    });
    chrome.contextMenus.create({
      id: 'toggle-enabled',
      parentId: 'spellcheck-root',
      title: chrome.i18n.getMessage('ctxToggle'),
      contexts: ['editable'],
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'add-to-dict' && info.selectionText) {
    const word = info.selectionText.trim().toLowerCase();
    await dictManager.addUserWord(word);
    chrome.tabs.sendMessage(tab.id, { type: 'WORD_ADDED', word });
  }
  if (info.menuItemId === 'toggle-enabled') {
    const { enabled = true } = await chrome.storage.local.get('enabled');
    await chrome.storage.local.set({ enabled: !enabled });
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE', enabled: !enabled });
  }
});

// ─── Mensajes desde content script y popup ────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    switch (msg.type) {

      case 'CHECK_WORDS': {
        // msg.words: string[]
        const results = {};
        for (const word of msg.words) {
          const { correct, suggestions } = await dictManager.check(word, msg.lang);
          results[word] = { correct, suggestions };
        }
        reply({ results });
        break;
      }

      case 'DETECT_LANG': {
        // Detecta idioma dominante en el texto
        const lang = await dictManager.detectLang(msg.text);
        reply({ lang });
        break;
      }

      case 'GET_STATUS': {
        const langs = await dictManager.getLoadedLangs();
        const { enabled = true } = await chrome.storage.local.get('enabled');
        const userWords = await dictManager.getUserWords();
        reply({ langs, enabled, wordCount: userWords.length });
        break;
      }

      case 'LOAD_DICTIONARY': {
        // msg.lang, msg.affData, msg.dicData (ArrayBuffer en base64)
        try {
          await dictManager.loadFromBase64(msg.lang, msg.affData, msg.dicData);
          reply({ success: true });
        } catch (e) {
          reply({ success: false, error: e.message });
        }
        break;
      }

      case 'REMOVE_DICTIONARY': {
        await dictManager.removeLang(msg.lang);
        reply({ success: true });
        break;
      }

      case 'GET_USER_WORDS': {
        const words = await dictManager.getUserWords();
        reply({ words });
        break;
      }

      case 'ADD_USER_WORD': {
        await dictManager.addUserWord(msg.word);
        reply({ success: true });
        break;
      }

      case 'REMOVE_USER_WORD': {
        await dictManager.removeUserWord(msg.word);
        reply({ success: true });
        break;
      }

      default:
        reply({ error: 'unknown message type' });
    }
  })();
  return true; // indica respuesta asíncrona
});
