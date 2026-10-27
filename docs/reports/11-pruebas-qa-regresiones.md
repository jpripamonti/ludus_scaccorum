# Reporte adversarial: pruebas, QA y regresiones

## Identificación y snapshot

- **Agente:** Dijkstra (auditoría adversarial de pruebas y reproducibilidad).
- **Óptica:** estrategia de QA, cobertura efectiva, rutas no ejercitadas, determinismo y capacidad de prevenir regresiones.
- **Código evaluado:** rama `main`, commit `dde59b0e41592534cdd4951a94c2376c17eb37e4`.
- **Estado del árbol evaluado:** limpio, conforme al snapshot solicitado. Los reportes paralelos creados durante la auditoría no forman parte de ese snapshot.
- **Fecha:** 2026-08-25.
- **Alcance:** revisión de `package.json`, los dos checks de `scripts/`, workflow de GitHub Actions y rutas críticas de `app.js`/`sw.js`. No se modificó código de producto.

## Metodología

1. Inventarié los comandos disponibles y la configuración de CI.
2. Ejecuté los checks locales, y sintaxis independiente de ambos scripts.
3. Leí el arnés de regresión y contrasté lo que exporta/ejercita contra los flujos de producción: carga de PGN, proveedores, caché IndexedDB, motor Worker, sesión, tablero y service worker.
4. Busqué controles de navegador, cobertura, lint y pruebas de integración/E2E en manifiesto, lockfile y repositorio.
5. Revisé rutas de datos que puedan producir una regresión funcional aunque los checks actuales sigan verdes.

## Resultados de comandos

| Comando | Resultado |
| --- | --- |
| `git rev-parse HEAD` | `dde59b0e41592534cdd4951a94c2376c17eb37e4` |
| `npm test` | **PASS**: `smoke-check passed` y `chess-regression-check passed` (0.5 s). |
| `node --check scripts/smoke-check.js` | **PASS**. |
| `node --check scripts/chess-regression-check.js` | **PASS**. |
| `git diff --check` | **PASS**: sin errores de whitespace en cambios trackeados. |
| Búsqueda de `playwright`, `puppeteer`, `vitest`, `jest`, `mocha`, `c8`, `nyc`, `jsdom` o `happy-dom` en manifiestos/configuración | Sin resultado: no hay framework de navegador, runner de pruebas ni medición de cobertura configurados. |

Los dos checks sí aportan valor: detectan archivos/activos ausentes y sus hashes de vendor, sintaxis de `app.js`/`sw.js`, reglas de ajedrez seleccionadas (enroque, captura al paso, promociones, mate/ahogado), umbrales de puntuación y el límite de descargas. No constituyen una validación end-to-end de la aplicación.

## Hallazgos priorizados

### P1 — El usuario objetivo puede sustituirse por un rival y el flujo no tiene regresión que lo detecte

**Evidencia.** La descarga conserva `username` en la fuente, pero `getActivePgnTextSources()` la reduce a `{ name, text }` ([`app.js:5663-5666`](../app.js#L5663-L5666)). Al construir el contexto, el jugador se infiere por la frecuencia de los tags y no por el nombre solicitado ([`app.js:6212-6225`](../app.js#L6212-L6225), [`app.js:3751-3762`](../app.js#L3751-L3762)); después esa inferencia determina qué color y qué jugadas se analizan ([`app.js:3795-3804`](../app.js#L3795-L3804)). En una única partida, o en un conjunto donde el mismo rival aparece tantas veces como el usuario, hay empate. La inserción de tags es `White` y luego `Black`, por lo que el orden puede elegir a blancas aunque el usuario solicitado juegue con negras.

**Impacto.** Es la promesa central del producto: entrenar con los errores del usuario. Una sesión puede entrenar al rival sin aviso y seguir pareciendo válida; los checks actuales no cubren ni `inferPlayerName`, ni `loadCandidateAnalysisContext`, ni la conexión con `source.username`.

**Remediación.** Propagar `username` y proveedor desde la fuente activa; resolver el objetivo mediante una comparación normalizada contra los tags y rechazar/explicar partidas que no lo contengan. Dejar la inferencia de frecuencia sólo como fallback explícito y visible. Agregar fixtures de un juego donde el usuario sea negras, de empate de frecuencias y de nombre/capitalización distintos; afirmar el color de cada candidata y el `targetName` final.

### P1 — La única validación automatizada corre al llegar a `main`, no antes de integrar cambios

**Evidencia.** El único workflow está disparado por `push` a `main` y `workflow_dispatch`; no tiene evento `pull_request` ([`.github/workflows/deploy-pages.yml:3-7`](../.github/workflows/deploy-pages.yml#L3-L7)). Además el job que prueba es el mismo job con permisos de Pages y despliegue ([`.github/workflows/deploy-pages.yml:9-12`](../.github/workflows/deploy-pages.yml#L9-L12), [`:34-58`](../.github/workflows/deploy-pages.yml#L34-L58)).

**Impacto.** Un cambio roto puede aprobarse/integrarse sin señal automática y sólo fallará después de que el commit ya esté en la rama de producción. El workflow evita desplegar si `npm test` falla, pero no evita la integración defectuosa ni aísla el feedback de CI del despliegue.

**Remediación.** Crear un workflow de CI de mínimos privilegios para `pull_request` y `push`, con Node 22, instalación reproducible (`npm ci` cuando se introduzcan dependencias) y `npm test`; hacerlo required check. Reservar el workflow de Pages para desplegar sólo commits ya validados de `main`.

### P2 — El arnés simula un DOM que nunca puede detectar contratos rotos de HTML ni interacciones

**Evidencia.** `getElementById` crea un elemento nuevo para cualquier id, incluso si no existe en `index.html` ([`scripts/chess-regression-check.js:95-112`](../scripts/chess-regression-check.js#L95-L112)); `addEventListener` no almacena ni dispara handlers ([`:52`](../scripts/chess-regression-check.js#L52)) y los selectores devuelven nodos nuevos o listas vacías ([`:70-75`](../scripts/chess-regression-check.js#L70-L75)). El test carga toda la aplicación en ese entorno artificial y exporta solamente doce helpers para aserciones unitarias ([`:142-145`](../scripts/chess-regression-check.js#L142-L145)).

**Impacto.** Puede desaparecer un control del wizard, cambiarse un id, romperse un click, la navegación de teclado, el cambio de idioma, el modo duelo, el timer o la renderización del tablero y `npm test` seguir verde. Es especialmente riesgoso porque `app.js` contiene 6.669 líneas y concentra UI, estado y lógica de dominio.

**Remediación.** Mantener estas pruebas unitarias rápidas, pero añadir pruebas de navegador contra el HTML real. Un conjunto inicial de cinco recorridos basta para cerrar el mayor hueco: wizard hasta iniciar sesión con fixture; solo (mover/omitir/revelar/siguiente); duelo (handoff y puntuación); cambio ES/EN y preferencia persistida; navegación por teclado del tablero. Añadir una prueba de contrato que compruebe que los ids requeridos existen antes de bootstrap.

### P2 — No hay regresiones para importación PGN ni para las respuestas reales/degradadas de Lichess y Chess.com

**Evidencia.** La producción parsea tags, comentarios, variaciones, SAN y separadores de partidas en [`app.js:3659-3749`](../app.js#L3659-L3749), construye candidatas y busca errores de forma asíncrona en [`app.js:3865-4018`](../app.js#L3865-L4018), y descarga/reintenta/cachea datos de proveedores desde [`app.js:2641-2800`](../app.js#L2641-L2800) y los flujos de proveedor. Sin embargo, el arnés deshabilita toda red por diseño ([`scripts/chess-regression-check.js:136-138`](../scripts/chess-regression-check.js#L136-L138)) y ninguna de esas funciones se exporta en su lista de prueba ([`:143-145`](../scripts/chess-regression-check.js#L143-L145)).

**Impacto.** Un PGN válido no contemplado, una variación/comentario que altera tokens, un cambio en el payload de Chess.com, 404/429/5xx, `Retry-After`, mes parcialmente fallido, caché expirada o fallback a caché stale puede dejar al usuario sin sesión o generar posiciones erróneas sin detección en CI.

**Remediación.** Incorporar fixtures PGN mínimos y de borde (multi-partida, CRLF, comentarios, NAG, variantes anidadas, enroque, promoción y usuario en blancas/negras). Mockear `fetch` e IndexedDB para ambos proveedores y cubrir éxito, 404, 429 con espera, reintentos, fallo parcial de archivo mensual, TTL, fallback stale y borrado de caché. Usar reloj falso para evitar esperas reales.

### P2 — El service worker y el artefacto publicado sólo reciben validación estática

**Evidencia.** El smoke check inspecciona cadenas `./...` del service worker y comprueba que los archivos existan ([`scripts/smoke-check.js:65-86`](../scripts/smoke-check.js#L65-L86)); no ejecuta `install`, `activate` ni `fetch`. En producción, `sw.js` implementa precache, borrado de caches previas, fallback de navegación offline y cache-first ([`sw.js:26-76`](../sw.js#L26-L76)). El workflow ejecuta el test antes de construir `_site` ([`.github/workflows/deploy-pages.yml:34-45`](../.github/workflows/deploy-pages.yml#L34-L45)) y no prueba después el artefacto servido.

**Impacto.** Fallos de actualización de cache, contenido obsoleto, navegación offline o rutas de GitHub Pages pueden llegar a usuarios aunque todos los checks locales pasen.

**Remediación.** Añadir pruebas de unidad del worker con mocks de Cache Storage y, al menos en CI, una prueba de navegador que instale el worker en el artefacto `_site`, recargue offline y verifique upgrade/borrado de una cache previa. Servir `_site` en esa prueba, no sólo el árbol fuente.

### P3 — No hay umbral de cobertura ni segmentación testeable del núcleo asíncrono

**Evidencia.** `package.json` sólo define `check`, `test:chess` y su composición `test` ([`package.json:6-10`](../package.json#L6-L10)); el lockfile declara sólo el paquete raíz. No hay medición de cobertura, lint ni una separación que permita importar sin bootstrap el estado, UI, proveedores y motor. La prueba actual depende de un `vm` y de una lista manual de símbolos.

**Impacto.** Las funciones nuevas pueden no sumarse a la lista de exportación del arnés y quedar completamente sin cubrir. La cifra de checks verdes no expresa qué parte de los flujos de producto fue evaluada.

**Remediación.** Extraer gradualmente funciones puras a módulos (PGN, selección de jugador, scoring y cliente de proveedores) y probarlas directamente; añadir cobertura con umbrales iniciales modestos, separados para lógica pura y flujos críticos. No perseguir cobertura total: hacer obligatorio que las rutas P1/P2 anteriores tengan escenarios de éxito y falla.

## Matriz mínima de regresión propuesta

| Prioridad | Escenario reproducible | Oráculo |
| --- | --- | --- |
| P1 | Una partida descargada, usuario solicitado juega negras | Todas las candidatas pertenecen a negras; no se elige a blancas por empate. |
| P1 | Pull request con cambio de aplicación | CI independiente corre y bloquea antes de merge. |
| P2 | Lichess y Chess.com: éxito, 404, 429, 5xx y fallo parcial | Mensaje correcto, reintentos acotados, cache/stale sólo cuando corresponde. |
| P2 | PGN de fixture con comentarios, NAG, variante, enroque y promoción | Cantidad de juegos/tokens y FEN de candidata esperados. |
| P2 | Wizard real en navegador, solo y duelo | Acciones click/teclado cambian DOM, estado y puntuación correctamente. |
| P2 | Instalación/upgrade offline del service worker sobre `_site` | Recursos disponibles offline; cache antigua eliminada; nueva versión servida. |
| P3 | Timeout de Worker y fallback local | La ronda termina, se informa resultado y no quedan listeners/timers activos. |

## Riesgos residuales

- El conjunto verde actual es una señal útil para reglas de ajedrez seleccionadas y archivos estáticos, pero no acredita la ruta que un usuario recorre desde un proveedor hasta una sesión.
- Aun tras introducir mocks, los contratos externos pueden cambiar; conviene conservar una prueba manual periódica de una cuenta pública de prueba por proveedor, sin convertirla en un test frágil de CI.
- Las evaluaciones de Stockfish dependen de navegador, Worker y WASM. El comportamiento de rendimiento y compatibilidad debe verificarse al menos en Chromium, Firefox y Safari antes de releases relevantes.
- La aleatoriedad de candidatas y el tiempo real de reintentos/timers deben inyectarse o fijarse en los tests nuevos; de lo contrario, las futuras pruebas de integración pueden ser intermitentes.

## Conclusión

`npm test` pasó, pero hoy valida un perímetro estrecho. La prioridad inmediata es corregir y testear la identidad del jugador objetivo y hacer que CI corra antes del merge. Después, las pruebas de navegador, proveedores/PGN y service worker son las inversiones con mayor capacidad de impedir regresiones reales.
