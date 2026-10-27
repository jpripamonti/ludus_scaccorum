# Auditoría adversarial: seguridad, privacidad y PWA

## Identificación y snapshot

- **Agente:** Feynman-II
- **Óptica:** seguridad de aplicación web, privacidad, abuso, dependencias/supply-chain, Service Worker y superficie PWA.
- **Rama auditada:** `main`
- **Commit auditado:** `dde59b0e41592534cdd4951a94c2376c17eb37e4`
- **Estado del código evaluado:** working tree **limpio** al inicio; se analizó exactamente ese snapshot, antes de crear este reporte.
- **Fecha:** 2026-08-25

## Alcance y metodología

Revisión estática de `index.html`, `app.js`, `sw.js`, `package*.json`, scripts de verificación, workflow de Pages, artefactos vendorizados y avisos de terceros. Se trazaron datos no confiables (usuario y PGN remoto) hasta los sinks DOM/red/almacenamiento; se revisaron las políticas de navegador, la caché PWA y el pipeline de publicación. No se modificó el producto ni se realizaron llamadas a las APIs externas. Verificación ejecutada sobre el snapshot: `npm test` (smoke, hashes SHA-256 y regresión de ajedrez), resultado satisfactorio.

Se usa la siguiente prioridad: **P1** alta, **P2** media y **P3** baja/hardening. Una severidad expresa impacto y probabilidad en este sitio estático sin cuentas ni backend propio.

## Resumen

| Prioridad | Hallazgo | Riesgo principal |
| --- | --- | --- |
| P1 | Acciones de GitHub por tag mutable | Compromiso de la cadena CI puede publicar JavaScript/Worker malicioso. |
| P2 | Respuesta PGN sin límite de bytes ni límites de parseo | Un proveedor/anotación anómala puede agotar memoria o bloquear la pestaña. |
| P2 | Retención de PGN en navegador compartido | Historiales públicos descargados quedan accesibles hasta siete días. |
| P3 | Protección contra framing no controlada por el repositorio | Riesgo residual de UI redressing si el host no aporta un header adecuado. |

## Hallazgos

### FII-01 — P1: el deploy confía en acciones por tags mutables

**Evidencia.** El workflow que posee `pages: write` e `id-token: write` (`.github/workflows/deploy-pages.yml:9-12`) invoca cinco acciones mediante tags mayores: `actions/checkout@v4` (línea 27), `actions/setup-node@v4` (30), `actions/configure-pages@v5` (48), `actions/upload-pages-artifact@v3` (53) y `actions/deploy-pages@v4` (59). Los tags no son identificadores inmutables. El job copia `app.js`, `sw.js` y `vendor/` al artefacto publicado (`:37-45`).

**Impacto y escenario adversarial.** Si una referencia de acción se moviera o se comprometiera, el código de esa acción se ejecutaría con el token OIDC y capacidad de desplegar Pages. Podría alterar el artefacto para servir JavaScript, el worker de Stockfish o el Service Worker a cada visitante. El riesgo es especialmente relevante porque `sw.js` toma control de clientes con `skipWaiting()` y `clients.claim()` (`sw.js:26-41`), acelerando la propagación de una publicación maliciosa.

**Remediación.** Fijar cada `uses:` a un SHA completo y documentar la versión humana en comentario; habilitar actualizaciones revisables (por ejemplo Dependabot) para esos SHAs. Mantener protección de rama, revisión obligatoria de cambios a `.github/workflows/`, y aprobación de despliegues de Pages. Confirmar que el entorno `github-pages` exige los revisores esperados.

### FII-02 — P2: el contenido remoto se materializa y analiza sin un presupuesto de tamaño

**Evidencia.** Lichess se descarga íntegramente con `await response.text()` (`app.js:5719-5736`) y Chess.com materializa cada archivo mensual como JSON completo con `await response.json()` (`app.js:5911-5924`). Aunque la lógica pide como máximo 300 partidas (`app.js:2182-2197` y `2209-2224`), no comprueba `Content-Length`, no limita bytes recibidos ni tamaño de etiquetas/comentarios. Luego hace operaciones completas en memoria sobre el texto: `splitGamesFromText` realiza `replace` y `split` del documento (`app.js:3717-3722`), y el parser recorre y vuelve a construir texto de variaciones (`app.js:3659-3667`).

**Impacto y escenario adversarial.** Una respuesta desproporcionada, corrupta o maliciosa de un proveedor —o una partida pública con comentarios/tags anormalmente grandes si el proveedor la exporta— puede forzar uso excesivo de memoria/CPU y congelar la pestaña. No hay ejecución de código demostrada por esta vía; es un riesgo de disponibilidad local y de batería, no de compromiso de servidor.

**Remediación.** Antes de consumir el cuerpo, rechazar un `Content-Length` superior a un límite explícito. Para respuestas sin header, leer `response.body` por streaming y abortar al superar el presupuesto; fijar además máximos de bytes por PGN, partidas, longitud de tag, comentarios, plies y anidación de variaciones. Mostrar un error recuperable y no escribir la respuesta rechazada a IndexedDB. Añadir pruebas con PGN/JSON sobredimensionado y tags hostiles.

### FII-03 — P2: los historiales descargados persisten siete días en el navegador

**Evidencia.** La app guarda objetos `source` completos —incluido `text`, usuario y metadatos— en IndexedDB (`app.js:2736-2754`). El TTL es de siete días (`app.js:152-155`) y los datos se reaprovechan al abrir la misma combinación proveedor/usuario (`app.js:5681-5693`, `5869-5882`). El consentimiento explica que la descarga quedará en el navegador (`app.js:293-299`) y existe una acción para vaciar el almacén (`app.js:2786-2801`, interfaz en `index.html:89-90`), por lo que no es almacenamiento oculto.

**Impacto y escenario adversarial.** En un equipo, perfil o navegador compartido, una persona posterior con acceso a ese perfil puede reutilizar o inspeccionar las partidas descargadas, nombres de usuarios y metadatos de partidas públicas durante la ventana de retención. La naturaleza pública de las partidas reduce la severidad, pero no elimina la señal de interés/entrenamiento asociada a la persona que usó el navegador.

**Remediación.** Ofrecer una preferencia visible de «no guardar» o TTL corto como valor por defecto, y explicar duración/categorías de datos en el modal antes de aceptar. Tras finalizar sesión, ofrecer «borrar datos de esta sesión». Conservar el borrado actual, pero añadir una prueba de integración que compruebe que elimina todas las entradas y que el texto de UI no prometa retención menor a la real.

### FII-04 — P3: la política anti-framing no está garantizada por el artefacto publicado

**Evidencia.** La CSP embebida restringe bien scripts, workers, conexiones, objetos, base y formularios (`index.html:8`), pero no contiene `frame-ancestors`. El workflow sólo construye archivos estáticos y no configura headers de respuesta (`.github/workflows/deploy-pages.yml:37-55`). `frame-ancestors` necesita una CSP servida como **header HTTP**; no puede imponerse de forma fiable desde el `meta` actual.

**Impacto y escenario adversarial.** Si el hosting no entrega `X-Frame-Options` o una CSP HTTP con `frame-ancestors`, un tercero podría embeber la app y hacer clickjacking/UI redressing. El impacto es acotado porque no hay autenticación, pagos ni secretos, y la descarga exige reescribir el usuario en el modal (`app.js:2924-2936`); aun así puede inducir una consulta a Lichess/Chess.com que revela IP y usuario al proveedor.

**Remediación.** Verificar los headers de la URL de producción en cada deploy. Si GitHub Pages no permite la cabecera requerida, publicar detrás de un CDN/host que entregue `Content-Security-Policy: frame-ancestors 'none'` (o la lista mínima de ancestros permitidos) y, como defensa heredada, `X-Frame-Options: DENY`.

## Controles presentes y riesgos residuales

### Datos remotos y XSS

- Los destinos de red quedan limitados a mismo origen, Lichess y Chess.com por `connect-src` (`index.html:8`); los nombres se codifican con `encodeURIComponent` antes de formar las URLs (`app.js:5724`, `5949`).
- La app solicita consentimiento contextual y reescritura del usuario antes del primer fetch de cada proveedor en la sesión (`app.js:2977-2993`), y aplica una espera de 20 segundos y un máximo de 12 descargas/hora en el cliente (`app.js:2803-2857`). Es cortesía antiabuso, no control de seguridad: puede eliminarse desde DevTools o automatizarse fuera de la app.
- No se encontró un flujo demostrable de XSS desde PGN/nombres: los campos dinámicos revisados se asignan con `textContent` (por ejemplo `app.js:4337-4342`) o se pasan por `escapeHtml` antes de `innerHTML` (`app.js:1447-1454`, `4358-4378`, `4688-4705`). La CSP no permite scripts inline ni `eval`; el único permiso especial es `wasm-unsafe-eval` para Stockfish (`index.html:8`). Riesgo residual: la cobertura es revisión estática, no fuzzing de todos los tags PGN.

### Dependencias y procedencia

- `package.json:1-12` y `package-lock.json:1-12` no declaran dependencias de producción. El workflow corre `npm test` antes de publicar (`.github/workflows/deploy-pages.yml:34-35`).
- El smoke test verifica sintaxis y compara los hashes de los dos binarios Stockfish con `vendor/SHA256SUMS` (`scripts/smoke-check.js:53-63`, `88-105`); la ejecución local confirmó ambas coincidencias. Esto detecta una modificación accidental que no actualice el manifiesto, pero **no** establece por sí mismo procedencia: quien modifica binario y manifiesto en la misma PR puede hacer que el check pase.
- `THIRD_PARTY_NOTICES.md:15-17` exige registrar release/commit, fuente y comando de build al reemplazar Stockfish, pero el inventario actual sólo declara repositorios y versión (líneas 5-17); falta la procedencia reproducible concreta de los artefactos actuales. Riesgo residual de supply-chain: no se auditó internamente el binario/WASM. Conservar un archivo de procedencia inmutable (URL de release/archivo fuente, commit, comandos y hashes esperados) y exigir revisión especializada de diffs binarios.

### Service Worker / PWA

- El SW sólo intercepta `GET` de mismo origen (`sw.js:44-48`, `69-75`); por tanto no cachea las respuestas de los proveedores ni credenciales cross-origin. Instala una lista explícita de recursos locales (`sw.js:3-24`) y borra cachés anteriores al activar (`sw.js:34-41`).
- El worker de Stockfish es local y la CSP admite sólo workers del mismo origen (`index.html:8`; creación en `app.js:3468-3481`). No se observó `importScripts` de terceros, WebSocket, analítica ni SDK remoto en el código de la aplicación.
- No hay `manifest.webmanifest`, de modo que la app no declara una PWA instalable estándar. Es una limitación de producto, no una vulnerabilidad. El riesgo residual importante es de disponibilidad: `cacheFirst` guarda cualquier GET exitoso del mismo origen (`sw.js:54-66`) sin presupuesto de entradas; si el origen agrega rutas dinámicas, deberá restringirse a una allowlist de assets o imponer cuota/evicción.

## Orden recomendado de corrección

1. Inmovilizar las acciones CI y endurecer la protección/aprobación de despliegue (FII-01).
2. Aplicar presupuestos de tamaño y tests de corpus adversarial a las respuestas PGN/JSON (FII-02).
3. Hacer opt-in/TTL visible para la caché de partidas y facilitar el borrado al cierre (FII-03).
4. Verificar headers reales de producción y resolver anti-framing en el host si faltan (FII-04).
