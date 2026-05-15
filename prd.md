# MDSpellCheck Open  
**Extensión de Chrome · Corrección Ortográfica Multilingüe**  

**PRODUCT REQUIREMENTS DOCUMENT (PRD) · v1.0**  
**Abril 2026 · Open Source · MIT License**

---

## 1. Resumen

MDSpellCheck Open es una extensión de navegador enfocada en la corrección ortográfica y gramatical en múltiples idiomas, optimizada para campos de texto enriquecido y editores Markdown. Su objetivo es ofrecer corrección en tiempo real sin depender de servicios propietarios, priorizando privacidad, extensibilidad y bajo consumo de recursos.

---

## 2. Objetivo del Producto

- Proveer corrección ortográfica multilingüe en tiempo real dentro del navegador.
- Priorizar español como idioma principal e inglés como segundo idioma recomendado.
- Integrarse de forma transparente en editores web (inputs, textareas, contenteditable, Markdown).
- Operar con modelos locales o APIs opcionales.
- Garantizar privacidad: no enviar texto sin consentimiento explícito.
- Permitir extensibilidad mediante plugins o diccionarios personalizados.

---

## 3. Alcance

### Incluye
- Corrección ortográfica en tiempo real
- Soporte principal para ES y EN, con extensión futura a FR y DE
- Subrayado de errores
- Sugerencias contextuales
- Diccionario personalizado por usuario
- Activación/desactivación por sitio
- Modo offline (con diccionarios locales)

### Excluye (v1.0)
- Corrección de estilo avanzada (tono, intención)
- Reescritura automática de texto
- Integraciones externas complejas (Notion, Google Docs API profunda)

---

## 4. Usuarios Objetivo

- Desarrolladores que escriben en Markdown
- Creadores de contenido
- Usuarios bilingües o multilingües
- Equipos técnicos que requieren privacidad
- Usuarios que rechazan soluciones propietarias

---

## 5. Casos de Uso

1. Escritura en editores Markdown (GitHub, CMS)
2. Redacción de correos en webmail
3. Formularios largos (CRM, dashboards internos)
4. Documentación técnica multilenguaje
5. Notas rápidas en navegador

---

## 6. Funcionalidades

### 6.1 Corrección en Tiempo Real
- Detección automática de idioma
- Español como idioma de respaldo cuando la autodetección no tenga coincidencias claras
- Subrayado visual de errores
- Baja latencia (<100ms por bloque de texto)

### 6.2 Sugerencias
- Click derecho o hover
- Top 3–5 sugerencias relevantes
- Reemplazo inmediato

### 6.3 Diccionario Personal
- Añadir palabras manualmente
- Persistencia local (IndexedDB)
- Exportación/importación

### 6.4 Configuración por Sitio
- Lista blanca / lista negra
- Activación automática por dominio

### 6.5 Motor de Corrección
- Opción 1: Diccionarios Hunspell locales
- Opción 2: Motor WASM
- Opción 3: API externa configurable

### 6.6 Modo Offline
- Funcionalidad completa sin conexión
- Descarga previa de paquetes de idioma

---

## 7. Requisitos Técnicos

### 7.1 Arquitectura
- Manifest V3 (Chrome Extensions)
- Background Service Worker
- Content Scripts para inyección en páginas
- UI Popup para configuración

### 7.2 Almacenamiento
- chrome.storage.local para configuración
- IndexedDB para diccionarios y cache

### 7.3 Rendimiento
- Procesamiento incremental de texto
- Debounce en input (300ms)
- Uso de Web Workers para parsing

### 7.4 Seguridad y Privacidad
- Sin envío de datos por defecto
- Opt-in explícito para APIs externas
- Código auditable (open source)

---

## 8. UX / UI

- Subrayado tipo "spellcheck" nativo
- Menú contextual ligero
- Popup minimalista para settings
- Indicador de idioma activo

---

## 9. Métricas de Éxito

- Latencia de corrección <100ms
- Uso de memoria <50MB
- % de adopción de diccionario personalizado
- Retención semanal de usuarios

---

## 10. Roadmap

### v1.0
- Corrección básica multilenguaje
- Diccionario personal
- Configuración por sitio

### v1.1
- Mejoras en detección de idioma
- Plugins de diccionario

### v2.0
- Corrección gramatical avanzada
- Integraciones opcionales

---

## 11. Licencia

MIT License

---

## 12. Riesgos

- Rendimiento en páginas con mucho DOM
- Conflictos con editores complejos (Google Docs)
- Calidad de diccionarios open source

---

## 13. Dependencias

- Diccionarios Hunspell
- Librerías WASM de procesamiento de texto
- APIs opcionales de NLP

---

## 14. Estado de Implementación Actual

El repositorio contiene un MVP inicial de la extensión. La implementación actual cubre parcialmente el PRD:

### Implementado

- Extensión Chrome Manifest V3.
- Background service worker.
- Content script para `input`, `textarea` y `contenteditable`.
- Popup de configuración.
- Carga manual de diccionarios Hunspell `.aff` + `.dic`.
- Persistencia local de diccionarios en IndexedDB.
- Persistencia local de palabras personales.
- Activación/desactivación global.
- Detección automática básica de idioma entre diccionarios instalados.
- Sugerencias simples por distancia de edición.

### Implementado parcialmente

- Subrayado en campos editables: funciona mejor en `contenteditable`; en `input` y `textarea` usa un espejo visual que requiere mejora para interacción completa.
- Motor Hunspell: se leen archivos Hunspell, pero todavía no se aplican reglas avanzadas del `.aff`.
- Menú contextual: existe para agregar palabras seleccionadas y activar/desactivar, pero se debe validar en más sitios.

### Pendiente para v1.0

- Motor Hunspell completo o WASM.
- Configuración por sitio.
- Exportación/importación de diccionario personal.
- Carga directa de archivos `.zip`.
- Pruebas manuales y automatizadas.
- Empaquetado reproducible para distribución.
- Documentación de privacidad lista para publicar.

---

## 15. Documentación Operativa

La documentación del proyecto se organiza así:

- `README.md`: resumen del proyecto, estado actual, arquitectura y roadmap práctico.
- `INSTALL.md`: instalación sencilla para usuarios y desarrolladores.
- `DEVELOPMENT.md`: guía para continuar el desarrollo, probar cambios y priorizar pendientes.

---

## 16. Criterios de Aceptación del MVP

El MVP se considera listo para pruebas internas cuando:

1. La extensión carga sin errores desde `chrome://extensions/`.
2. El usuario puede cargar un par `.aff` + `.dic` desde el popup.
3. El idioma cargado aparece en el estado del popup.
4. Una palabra incorrecta se subraya en un campo editable compatible.
5. Al hacer clic en una palabra subrayada se muestran sugerencias cuando existen.
6. El usuario puede agregar una palabra al diccionario personal.
7. La extensión puede activarse y desactivarse desde el popup.
8. No se envía texto a servidores externos.
