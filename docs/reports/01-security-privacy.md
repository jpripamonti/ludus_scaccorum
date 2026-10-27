# Revision de seguridad y privacidad - Ludus Scaccorum

Snapshot:
- Branch: `main`
- Commit: `4473c3cef1c784336cce7bca33f299a4c39b6fdb`
- Working tree al iniciar el analisis: limpio

## Findings

### 1. Media - No hay politica CSP/referrer/permissions para limitar ejecucion y conexiones externas

Impacto: cualquier XSS futuro o archivo comprometido del mismo origen tendria pocas restricciones: puede ejecutar `app.js`, crear el worker de Stockfish y hacer `fetch` a origenes externos permitidos por el navegador.

Evidencia: `index.html:4-12` solo define charset, viewport, Google Fonts y CSS; no hay `Content-Security-Policy`, `Referrer-Policy` ni `Permissions-Policy`. El deploy copia archivos estaticos sin cabeceras adicionales en `.github/workflows/deploy-pages.yml:29-39`.

Escenario: un valor de PGN o UI que llegue a un sink HTML no escapado en una version futura ejecutaria script sin una CSP que reduzca el dano.

Remediacion: agregar CSP estatica por `<meta http-equiv>` en `index.html`, por ejemplo restringiendo `default-src 'self'`, `script-src 'self'`, `worker-src 'self'`, `connect-src 'self' https://lichess.org https://api.chess.com`, `img-src 'self' data:`, `font-src https://fonts.gstatic.com`, `style-src 'self' https://fonts.googleapis.com`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `frame-ancestors 'none'`. Anadir tambien `Referrer-Policy: strict-origin-when-cross-origin` o mas estricto.

### 2. Media - Carga de Google Fonts filtra visitas a un tercero antes de cualquier accion del usuario

Impacto: al abrir la pagina, el navegador contacta Google y expone IP, User-Agent y posible referrer, aunque el usuario no descargue partidas.

Evidencia: `index.html:8-10` hace `preconnect` a `fonts.googleapis.com` y `fonts.gstatic.com` y carga CSS de Google Fonts.

Escenario: un usuario que solo visita el entrenador desde GitHub Pages ya produce telemetria observable por Google, separada de Lichess/Chess.com.

Remediacion: self-host de las fuentes o reemplazo por system fonts. Si se mantiene Google Fonts, documentarlo explicitamente en una nota de privacidad y aplicar politica de referrer.

### 3. Media - La app envia desde el navegador consultas de usuario a Lichess/Chess.com sin aviso de privacidad contextual

Impacto: Lichess/Chess.com observan IP, momento de uso y username consultado. Las partidas son publicas, pero la consulta del visitante no lo es necesariamente.

Evidencia: `app.js:4816-4820` llama `https://lichess.org/api/games/user/${username}`. `app.js:4999-5000` llama `https://api.chess.com/pub/player/${username}/games/archives`, y `app.js:4965-4971` descarga archivos mensuales devueltos por esa API.

Escenario: en un entorno compartido, un alumno consulta su usuario o el de otra persona y revela a terceros que esa IP esta usando el entrenador para ese perfil.

Remediacion: mostrar un aviso justo antes de descargar partidas: proveedor, username, datos enviados y que no hay backend propio. Ofrecer cancelar/cambiar usuario. No guardar usernames en `localStorage`; actualmente solo se persiste idioma y tiempo en `app.js:602-657`.

### 4. Baja - Artefactos Stockfish vendorizados sin manifiesto de procedencia ni verificacion reproducible

Impacto: `vendor/stockfish-18-lite-single.js` y `.wasm` son codigo ejecutable local; si se reemplazan accidental o maliciosamente, el deploy los publicaria y `npm audit` no detectaria nada porque no hay dependencias npm reales.

Evidencia: `app.js:2841-2844` carga `vendor/stockfish-18-lite-single.js` como Worker. El archivo vendorizado declara Stockfish.js 18 y GPL en `vendor/stockfish-18-lite-single.js:1-10`. `README.md:48` y `README.md:88` solo indican compatibilidad GPL, sin commit/tag, URL de descarga, hashes o build recipe.

Escenario: una PR cambia el WASM por uno alterado; la revision visual del diff es poco util y CI no verifica integridad.

Remediacion: agregar manifiesto de vendor con version upstream, commit/tag, URL, comandos de build, licencia y SHA-256 esperados. Anadir job CI que ejecute `shasum -a 256 -c` sobre esos artefactos.

### 5. Baja - Controles de abuso/rate limiting dependen enteramente del cliente

Impacto: un usuario puede provocar muchas llamadas a APIs publicas y alto consumo CPU local al pedir sesiones grandes repetidamente. No afecta un backend propio, pero si experiencia, bateria y limites de Lichess/Chess.com.

Evidencia: la UI permite hasta 200 posiciones en `index.html:90-91`; el codigo escala descargas hasta 300 partidas en `app.js:2036-2044` y `app.js:2063-2070`; cada candidato puede disparar evaluaciones de motor en `app.js:3239-3240`.

Escenario: automatizar clicks sobre "Comenzar sesion" genera rafagas de fetch y analisis local.

Remediacion: deshabilitar reintentos mientras haya descarga/analisis activo ya iniciado, anadir cooldown visible por proveedor, y cortar busqueda tras un presupuesto total de tiempo/candidatos por sesion.

## No confirmado / necesita verificacion

- XSS via PGN remoto: no confirmado. Los sinks revisados usan `escapeHtml` (`app.js:1321-1328`) o `textContent`, por ejemplo `app.js:3577-3595`, `app.js:3908-3925` y `app.js:3966`; conviene anadir fuzz tests con tags PGN maliciosos.
- Stockfish/WASM: no se audito el binario internamente; solo se reviso como se carga y su falta de procedencia verificable.
- Cumplimiento GPL de Stockfish: README enlaza la licencia del repo y menciona compatibilidad, pero necesita verificacion legal sobre "Corresponding Source" para la distribucion por GitHub Pages.
- Rate limits/CORS reales de Lichess y Chess.com: no se hicieron pruebas de red en esta revision.
