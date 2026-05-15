# SpellCheck Open

Extensión de Chrome para corrección ortográfica multilingüe con diccionarios locales Hunspell. El texto se procesa en el navegador y no se envía a servidores externos.

Los diccionarios principales del proyecto son español (`es`) e inglés (`en`). Español es el idioma principal de respaldo: si la detección automática no tiene suficientes coincidencias o hay empate, la extensión usa español cuando está instalado.

## Estado actual

Este proyecto ya tiene un MVP funcional para desarrollo local:

- Manifest V3 con service worker.
- Content script para detectar texto editable en páginas web.
- Popup para activar/desactivar la extensión.
- Icono adaptado a la paleta Catppuccin con color de acento rotativo por día.
- Carga manual de diccionarios `.aff` + `.dic`.
- Persistencia de diccionarios y palabras personales en IndexedDB.
- Detección automática de idioma entre español e inglés, y otros diccionarios cargados.
- Sugerencias básicas por distancia de Levenshtein.

Limitaciones actuales:

- El motor todavía no aplica reglas Hunspell avanzadas de afijos; usa lookup directo del `.dic`.
- Los `.zip` no se cargan directamente; primero hay que extraer los archivos `.aff` y `.dic`.
- Google Docs y editores web muy complejos pueden requerir integración específica.
- El corrector gramatical avanzado queda fuera del MVP actual.

## Instalación rápida

Para instalar la extensión en Chrome como desarrollador, sigue la guía corta en [INSTALL.md](INSTALL.md).

Resumen:

1. Abre `chrome://extensions/`.
2. Activa `Modo desarrollador`.
3. Haz clic en `Cargar extensión sin empaquetar`.
4. Selecciona esta carpeta: `spellcheck-extension`.
5. Abre el popup de la extensión y carga un diccionario `.aff` + `.dic`.

## Uso básico

1. Instala la extensión sin empaquetar.
2. Descarga un diccionario Hunspell.
3. En el popup, carga los diccionarios principales: `es.aff` + `es.dic` y, si lo necesitas, `en.aff` + `en.dic`.
4. Abre una página con `textarea`, `input` o contenido editable.
5. Escribe texto; las palabras no reconocidas se subrayan.
6. Haz clic en una palabra subrayada para ver sugerencias o agregarla a tu diccionario personal.

## Diccionarios principales

Para el flujo recomendado instala primero:

- Español: `es.aff` y `es.dic`.
- Inglés: `en.aff` y `en.dic`.

La extensión autodetecta el idioma del texto comparando palabras contra los diccionarios instalados. Si no hay coincidencias claras, usa español como idioma principal.

## Diccionarios compatibles

La extensión espera diccionarios Hunspell en dos archivos:

- `.aff`: reglas del idioma.
- `.dic`: lista de palabras.

Fuentes útiles:

- [wooorm/dictionaries](https://github.com/wooorm/dictionaries)
- [LibreOffice Extensions](https://extensions.libreoffice.org/?Tags%5B%5D=50)
- [Mozilla Dictionaries](https://addons.mozilla.org/es/firefox/language-tools/)

Ejemplo manual desde GitHub:

1. Entra a `https://github.com/wooorm/dictionaries/tree/main/dictionaries/es`.
2. Descarga `index.aff` y `index.dic`.
3. Renómbralos a `es.aff` y `es.dic`.
4. Súbelos desde el popup.

## Estructura del proyecto

```text
spellcheck-extension/
├── manifest.json
├── popup.html
├── popup.js
├── prd.md
├── README.md
├── INSTALL.md
├── DEVELOPMENT.md
├── src/
│   ├── background.js
│   ├── content_script.js
│   ├── dict_manager.js
│   └── overlay.css
├── _locales/
│   ├── es/messages.json
│   └── en/messages.json
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Arquitectura

```text
Página web
  └─ content_script.js
       ├─ detecta inputs, textareas y contenteditable
       ├─ extrae palabras
       ├─ pide idioma y validación al background
       └─ renderiza subrayado y sugerencias

Service worker
  └─ background.js
       ├─ recibe mensajes del popup y content script
       ├─ administra menú contextual
       └─ delega diccionarios a DictManager

Persistencia
  └─ dict_manager.js
       ├─ guarda diccionarios en IndexedDB
       ├─ guarda palabras personales
       ├─ detecta idioma
       └─ valida palabras con SimpleChecker
```

## Desarrollo

Lee [DEVELOPMENT.md](DEVELOPMENT.md) para entender el flujo de trabajo, los módulos principales, pruebas manuales recomendadas y próximos pasos técnicos.

## Roadmap práctico

Prioridad alta:

- Reemplazar `SimpleChecker` con un motor Hunspell completo en WASM o librería compatible con MV3.
- Mejorar el subrayado y reemplazo en `input` y `textarea`.
- Agregar pruebas manuales documentadas por navegador.
- Empaquetar versión `.zip` lista para distribución.

Prioridad media:

- Soporte directo para cargar `.zip`.
- Importar y exportar diccionario personal.
- Configuración por sitio.
- Mejorar accesibilidad del popup.

## Privacidad

- No hay telemetría.
- No se envía texto a servicios externos.
- Los diccionarios se guardan localmente en IndexedDB.
- Las palabras personales se guardan localmente.

## Licencia

MIT.
