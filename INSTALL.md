# Instalación sencilla

Esta guía instala SpellCheck Open en Chrome para probarla o desarrollarla localmente.

## Requisitos

- Google Chrome o Chromium.
- Esta carpeta del proyecto descargada en tu computadora.
- El diccionario español Hunspell con archivos `.aff` y `.dic`.
- Opcionalmente, el diccionario inglés Hunspell con archivos `.aff` y `.dic`.

No necesitas instalar Node.js para cargar la extensión actual.

## Instalar la extensión

1. Abre Chrome.
2. Escribe `chrome://extensions/` en la barra de direcciones.
3. Activa `Modo desarrollador` en la esquina superior derecha.
4. Haz clic en `Cargar extensión sin empaquetar`.
5. Selecciona la carpeta `spellcheck-extension`.
6. Confirma que aparezca `SpellCheck Open` en la lista de extensiones.
7. Fija la extensión en la barra de Chrome para abrir el popup fácilmente.

## Instalar los diccionarios principales

Español es el idioma principal. Inglés es el segundo idioma recomendado. La extensión detecta automáticamente cuál usar según el texto.

1. Descarga el diccionario Hunspell de español.
2. Asegúrate de tener estos dos archivos:
   - `es.aff`
   - `es.dic`
3. Abre el popup de `SpellCheck Open`.
4. Arrastra ambos archivos al área de carga o selecciónalos con el botón del popup.
5. Espera el mensaje de confirmación.
6. Repite el proceso con inglés si también quieres corrección en inglés:
   - `en.aff`
   - `en.dic`

## Probar que funciona

1. Abre una página con un campo de texto, por ejemplo un formulario o un bloc de notas web.
2. Escribe una palabra incorrecta.
3. La palabra debe aparecer subrayada.
4. Haz clic en la palabra subrayada para ver sugerencias.

## Actualizar después de cambios en el código

1. Vuelve a `chrome://extensions/`.
2. Busca `SpellCheck Open`.
3. Haz clic en el botón de recargar.
4. Recarga la página donde estás probando la extensión.

## Solución rápida de problemas

Si la extensión no aparece:

- Verifica que seleccionaste la carpeta donde está `manifest.json`.
- Revisa si Chrome muestra errores en la tarjeta de la extensión.

Si no subraya palabras:

- Confirma que cargaste un diccionario `.aff` y `.dic`.
- Para el flujo principal, confirma que cargaste `es.aff` y `es.dic`.
- Revisa que la extensión esté activada desde el popup.
- Recarga la pestaña después de instalar o actualizar la extensión.

Si el diccionario no carga:

- Usa archivos `.aff` y `.dic`, no `.zip`.
- Si descargaste un `.xpi` o `.zip`, extráelo primero.
- Renombra los archivos con el código del idioma, por ejemplo `es.aff` y `es.dic`.
