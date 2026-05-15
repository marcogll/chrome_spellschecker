# Guía de desarrollo

Esta guía resume cómo continuar el desarrollo de SpellCheck Open desde el estado actual del proyecto.

## Objetivo del MVP

El MVP busca corrección ortográfica local en Chrome:

- Cargar diccionarios Hunspell manualmente.
- Usar español como idioma principal e inglés como segundo idioma recomendado.
- Detectar texto editable en páginas web.
- Subrayar palabras no reconocidas.
- Mostrar sugerencias básicas.
- Permitir palabras personales.
- Evitar envío de texto a servidores.

## Módulos principales

`manifest.json`

Define la extensión MV3, permisos, service worker, content script, estilos inyectados, popup e iconos.

`src/background.js`

Es el service worker. Recibe mensajes del popup y del content script, administra el menú contextual, refresca el icono diario y llama a `DictManager`.

`src/icon_manager.js`

Genera el icono de la barra de Chrome desde la silueta de `icons/bookmark.svg`. Usa acentos Catppuccin y rota el color según el día calendario.

`src/dict_manager.js`

Gestiona IndexedDB, diccionarios cargados, palabras personales, detección de idioma y validación de palabras.

`src/content_script.js`

Se inyecta en las páginas. Detecta elementos editables, extrae palabras, pide validación al background y renderiza subrayados/sugerencias.

`popup.html` y `popup.js`

Implementan la interfaz de configuración, carga de diccionarios, estado de idiomas instalados y administración de palabras personales.

`src/overlay.css`

Contiene los estilos inyectados para subrayados y caja de sugerencias.

## Flujo de mensajes

```text
popup.js
  ├─ GET_STATUS
  ├─ LOAD_DICTIONARY
  ├─ REMOVE_DICTIONARY
  ├─ GET_USER_WORDS
  └─ REMOVE_USER_WORD

content_script.js
  ├─ DETECT_LANG
  ├─ CHECK_WORDS
  └─ ADD_USER_WORD

background.js
  └─ DictManager
       ├─ IndexedDB
       ├─ SimpleChecker
       └─ palabras personales
```

## Cómo probar durante desarrollo

1. Carga la extensión con `chrome://extensions/`.
2. Abre `Detalles > Inspeccionar vistas > service worker` para ver logs del background.
3. Abre DevTools en la página de prueba para ver errores del content script.
4. Recarga la extensión después de cada cambio en `manifest.json`, `background.js`, `popup.js` o archivos de `src/`.
5. Recarga la página de prueba para reinjectar el content script.

Casos manuales mínimos:

- Instalar extensión sin diccionarios.
- Cargar `es.aff` + `es.dic`.
- Escribir palabra correcta e incorrecta en `textarea`.
- Escribir palabra incorrecta en un `contenteditable`.
- Abrir sugerencias al hacer clic.
- Agregar una palabra al diccionario personal.
- Desactivar y activar la extensión desde el popup.
- Eliminar un diccionario desde el popup.

## Decisiones técnicas actuales

- Se usa IndexedDB porque los diccionarios pueden ser grandes.
- Se usa `chrome.storage.local` para configuración ligera como `enabled`.
- El corrector actual no interpreta completamente reglas `.aff`; solo usa palabras base del `.dic`.
- La detección de idioma compara una muestra de palabras contra los diccionarios cargados.
- En empates o cuando no hay coincidencias claras, la detección usa español como respaldo si `es` está instalado.
- La extensión no incluye diccionarios por defecto para mantener el paquete pequeño y permitir que el usuario elija fuentes.

## Pendientes técnicos recomendados

1. Integrar motor Hunspell real.

   El punto principal a reemplazar es `SimpleChecker` en `src/dict_manager.js`. La meta es respetar reglas de afijos, mayúsculas, compuestos y sugerencias nativas.

2. Mejorar subrayado en `input` y `textarea`.

   El espejo visual actual subraya, pero la interacción con sugerencias es limitada porque el overlay no recibe clics. Hay que implementar detección de palabra por coordenada o una estrategia de overlay interactivo.

3. Agregar configuración por sitio.

   Guardar dominios permitidos/bloqueados en `chrome.storage.local` y consultarlos antes de revisar texto en `content_script.js`.

4. Soporte para `.zip`.

   Integrar una librería ligera compatible con extensión MV3 o descomprimir fuera del service worker.

5. Importar/exportar palabras personales.

   Agregar acciones en el popup para descargar/subir JSON con la lista de palabras del usuario.

6. Pruebas automatizadas.

   Separar lógica pura de `DictManager` y `SimpleChecker` para poder probar parseo, detección de idioma y sugerencias fuera de Chrome.

## Criterios para una v1.0 publicable

- Instalación local documentada.
- Carga de diccionarios estable.
- Revisión funcional en `textarea` y `contenteditable`.
- Diccionario personal funcional.
- Sin errores visibles en service worker y content script.
- Permisos revisados y justificados.
- Política de privacidad clara.
- Paquete `.zip` generado desde archivos necesarios.

## Empaquetado manual

Para distribuir una versión de prueba:

1. Verifica que no haya archivos temporales.
2. Carga la extensión en Chrome y prueba los casos mínimos.
3. Comprime estos archivos y carpetas:
   - `manifest.json`
   - `popup.html`
   - `popup.js`
   - `src/`
   - `_locales/`
   - `icons/`
4. No incluyas diccionarios privados del usuario en el paquete.
