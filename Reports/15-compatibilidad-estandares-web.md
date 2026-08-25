# Auditoría adversarial — compatibilidad y estándares web

- **Agente:** Crockford
- **Óptica:** estándares de plataforma, navegadores/dispositivos, PWA y degradación progresiva.
- **Snapshot evaluado:** rama `main`, commit `dde59b0e41592534cdd4951a94c2376c17eb37e4`, *working tree* limpio.
- **Fecha:** 2026-08-25.

## Metodología

Inspección estática del HTML, CSS, JavaScript, service worker y flujo de despliegue del commit indicado. Se buscaron APIs sin alternativa, sintaxis que impide cargar el programa, CSS sin *fallback*, requisitos de instalación PWA y evidencia de una matriz real de navegadores. También se ejecutó `npm test`: `smoke-check` y `chess-regression-check` pasan. Esas pruebas corren sobre Node 22 y un DOM simulado; no ejercitan motores de navegador ni instalación/offline PWA.

## Hallazgos priorizados

### P1 — El tema depende por completo de `oklch()` sin una cascada de reserva

**Evidencia.** Las variables que definen fondo, texto, superficies, bordes y estados se declaran exclusivamente como `oklch()` en [`styles.css`](../styles.css#L13-L47), y luego abastecen casi todo el tema mediante `var(...)` (por ejemplo el `body` en líneas 140–145). No hay valores hex/rgb previos ni un bloque `@supports` que limite el reemplazo moderno.

**Impacto.** En navegadores sin CSS Color 4 con `oklch()` (por ejemplo Safari/iOS anteriores a 15.4, y versiones antiguas de Chromium/Firefox), cada propiedad consumidora queda inválida al calcularse. No es una degradación cromática: pueden perderse fondo, color de texto, bordes y estados, dejando una interfaz difícil o imposible de usar. La misma ausencia de reserva alcanza al `oklch()` usado directamente en reglas posteriores.

**Remediación.** Definir primero tokens equivalentes en hex/rgb y sobrescribirlos sólo dentro de `@supports (color: oklch(50% 0.1 0))`. No basta con repetir `--token: #...; --token: oklch(...)` en el mismo bloque: las propiedades personalizadas guardan tokens no validados y la segunda declaración puede invalidar el valor al consumirlo. Añadir una prueba visual en Safari/iOS de la versión mínima soportada.

### P2 — El service worker no convierte al sitio en una PWA instalable

**Evidencia.** La app registra correctamente un service worker cuando la plataforma lo permite ([`app.js`](../app.js#L6621-L6628)) y éste precachea HTML, CSS, JS, piezas, Stockfish y WASM ([`sw.js`](../sw.js#L3-L31)). Sin embargo, en todo el snapshot no hay `manifest.webmanifest`/`manifest.json`, íconos de aplicación ni `<link rel="manifest">`; el `<head>` sólo declara `theme-color` y la hoja de estilos ([`index.html`](../index.html#L4-L12)). El empaquetado de Pages tampoco copia un manifiesto ni íconos ([`deploy-pages.yml`](../.github/workflows/deploy-pages.yml#L31-L37)).

**Impacto.** Chrome/Edge no cumplen los metadatos mínimos que usan para la instalabilidad y no pueden ofrecer una instalación PWA normal. En iOS/iPadOS, “Agregar a pantalla de inicio” carece de identidad, ícono y modo de presentación definidos. El producto tiene caché offline, pero no la experiencia PWA que su service worker sugiere.

**Remediación.** Añadir un manifiesto con `name`, `short_name`, `start_url` relativo al subpath de GitHub Pages, `scope`, `display`, `theme_color`, `background_color` e íconos PNG de al menos 192 y 512 px; enlazarlo desde el HTML y copiarlo (más íconos) a `_site`. Incorporar metadatos de Apple si se promete instalación en iOS. Verificar instalación y reinicio offline en Chrome/Edge y Safari iOS sobre la URL publicada.

### P2 — No existe contrato de navegadores ni prueba que detecte regresiones de plataforma

**Evidencia.** `package.json` sólo ejecuta comprobación de sintaxis, humo y regresiones de ajedrez. El despliegue corre `npm test` con Node 22 ([`package.json`](../package.json#L5-L11), [`deploy-pages.yml`](../.github/workflows/deploy-pages.yml#L23-L29)). Aun así, el *bundle* sin transpilar requiere sintaxis moderna: `??` y `?.` aparecen desde [`app.js`](../app.js#L744-L758), y también se usan `fetch`, `AbortController`, IndexedDB, Workers/WASM y service workers.

**Impacto.** Un navegador que no pueda analizar optional chaining/nullish coalescing aborta la carga de todo `app.js`, antes de que sus chequeos defensivos de APIs puedan ejecutarse. En motores algo más recientes pero sin una API concreta, hay comportamientos heterogéneos no cubiertos por CI. Sin versión mínima declarada tampoco puede determinarse si las incompatibilidades CSS/JS son fallos de soporte o una decisión de producto consciente.

**Remediación.** Publicar una política explícita (por ejemplo: últimas dos versiones de Chrome/Edge/Firefox, Firefox ESR y Safari/iOS actual + anterior) y alinear el código a ella. Si se soportan motores previos a la sintaxis actual, transpilar a ese objetivo y entregar los *polyfills* estrictamente necesarios; si no, presentar un aviso legible con `nomodule`/contenido estático. Añadir CI de navegador real —al menos carga, wizard, partida local, fallback sin Worker y caché/offline— en las versiones que fija la política.

### P3 — Dos reglas de presentación se basan en `:has()` sin alternativa funcional

**Evidencia.** El centrado del resumen al finalizar una sesión depende de `.result-overlay-read:has(...)` ([`styles.css`](../styles.css#L1701-L1703)); ocultar una franja vacía de herramientas depende de un segundo `:has()` anidado ([`styles.css`](../styles.css#L1908-L1911)). No hay `@supports selector(:has(*))` ni una clase que replique ambos estados.

**Impacto.** En navegadores que sí ejecutan la aplicación pero aún no implementan `:has()` —en particular Firefox ESR antiguos— el juego sigue funcionando, pero el resumen queda arriba y puede aparecer un hueco/fila vacía bajo el tablero. Es una degradación visual evitable y es consistente con el problema de falta de matriz.

**Remediación.** Mantener explícitamente desde JavaScript una clase de estado en el contenedor (por ejemplo, `has-visible-board-tools` y `session-summary-only`) al mismo tiempo que se alternan los botones. Estilar esa clase como camino base y dejar `:has()` sólo como mejora opcional, o protegerlo con `@supports selector(:has(*))`.

## Riesgos residuales

- La descarga directa depende de que Lichess y Chess.com mantengan CORS, formatos y límites compatibles; no existe proxy ni prueba de contrato contra esos proveedores. Este análisis no hizo llamadas externas ni puede garantizar su estado futuro.
- El service worker resuelve las solicitudes same-origin y la app protege fallos de almacenamiento/Worker en varios puntos, pero los modos privados, cuotas cero o políticas corporativas pueden impedir persistencia e instalación; hoy se degradan principalmente a uso online sin una comunicación específica al usuario.
- Los `@media`, `clamp()`, `min()`, `image-set()`, `overflow: clip` y `color-scheme` también presuponen un navegador moderno. Al fijar la política de soporte se debe validar el conjunto completo, no sólo los cuatro puntos anteriores.

## Verificación del reporte

No se modificó código de producto. `npm test` pasó en el estado evaluado; sus dos verificaciones no sustituyen una matriz de navegadores.
