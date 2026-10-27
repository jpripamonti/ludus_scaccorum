# 04 - Performance y confiabilidad

Snapshot:
- Branch: `main`
- Commit: `4473c3cef1c784336cce7bca33f299a4c39b6fdb`
- Working tree al iniciar el analisis: limpio

## Findings

### 1. Alto - El fallback local puede congelar el hilo principal si Stockfish falla

Impacto: ante fallo del worker/WASM, la app degrada a un evaluador recursivo sincrono en el main thread. En rondas usa profundidad `18`, lo que puede bloquear la pestana o disparar "page unresponsive".

Evidencia: `RATING_DEPTH = 18` en `app.js:129`; `getRatingConfig()` devuelve esa profundidad en `app.js:2105`; al fallar Stockfish, `evaluateMoveWithEngine()` cae a `evaluatePosition(clone, depth)` en `app.js:3001-3010`; `evaluatePosition()` recurre sin poda, sin limite de tiempo y sin `yield` en `app.js:2743-2758`.

Escenario: Safari/iOS o GitHub Pages bloquea/corta `vendor/stockfish-18-lite-single.wasm`; el usuario hace una jugada; `stockfishEvaluate()` falla y la evaluacion de ronda intenta depth 17 local para mejor/jugada/usuario.

Remediacion: separar "degradado" de "equivalente": si el worker no esta listo, capar fallback local a depth 2-3, mostrar aviso de precision reducida y nunca ejecutar depth alto en el main thread. Idealmente mover tambien el fallback a un worker con presupuesto temporal y cancelacion.

### 2. Alto - Las llamadas a Lichess/Chess.com no tienen timeout, cancelacion ni manejo de rate limit

Impacto: una red colgada deja la sesion en estado de analisis con el boton deshabilitado hasta que el navegador decida fallar. Los 429/5xx se tratan como error generico, sin `Retry-After`, backoff ni reintento seguro.

Evidencia: `startSessionPipeline()` deshabilita UI en `app.js:5137-5139` y espera `fetchChessComPgn()`/`fetchLichessPgn()` en `app.js:5175-5184`. Lichess usa `fetch()` directo en `app.js:4817-4824`; Chess.com usa `fetch()` directo en `app.js:4967-4972` y `app.js:5000-5007`. No hay `AbortController`, `signal`, `Retry-After` ni logica para `429`.

Escenario: conexion movil con DNS lento o API rate-limited; el usuario pulsa "Comenzar sesion" y la app queda esperando sin opcion real de cancelar o reintentar con politica controlada.

Remediacion: centralizar `fetchWithTimeout(url, { timeoutMs, retries, retryAfter })`; abortar por intento, distinguir `404`, `429`, `5xx`, offline y timeout; exponer boton "reintentar/cancelar" que invalide el intento actual mediante token de sesion.

### 3. Medio-Alto - Sin cache persistente ni modo offline util pese a ser app estatica

Impacto: todo PGN remoto y contexto de analisis vive en memoria. Un reload, cierre de pestana u offline pierde la base descargada y obliga a consultar APIs otra vez.

Evidencia: solo se persisten idioma y tiempo en `localStorage` (`app.js:602-659`). Las fuentes remotas se guardan en `STATE.remotePgnSources` (`app.js:4876-4889`, `app.js:5077-5090`) y `clearRemotePgnSources()` las borra en `app.js:1401-1403`. No hay `serviceWorker`/`caches` en el repo; `index.html:8-10` depende de Google Fonts.

Escenario: el usuario descarga 300 partidas, pierde conexion o refresca la pagina; la app no puede continuar aunque Stockfish y el tablero sean locales.

Remediacion: guardar PGN por `{provider, username, settings}` en IndexedDB con TTL y tamano maximo; precachear shell, `app.js`, CSS, piezas y WASM con service worker; ofrecer "usar ultima base descargada" y un dataset local minimo como degradado.

### 4. Medio - Coste inicial excesivo por assets pesados cargados antes de necesitarlos

Impacto: primera visita lenta y consumo alto de datos: landing PNG de 6.9 MB mas Stockfish WASM de 7.0 MB potencialmente desde el arranque.

Evidencia: CSS usa `assets/landing/maestro.png` en `styles.css:119` y como background en `styles.css:207-210`, aunque existe `maestro.webp` de 172 KB. `app.js:5567` llama `setupStockfish()` al cargar; este hace `HEAD` y crea el worker en `app.js:2838-2855`.

Escenario: usuario abre desde 4G; antes de configurar sesion ya paga la imagen pesada y el motor puede arrancar, compitiendo por ancho de banda/CPU.

Remediacion: cambiar landing a WebP con fallback (`image-set()` o CSS alternativo), diferir Stockfish hasta paso 3/start o `requestIdleCallback`, y medir Web Vitals con throttling. Evitar el `HEAD` extra si el worker puede reportar error por si mismo.

### 5. Medio - Busqueda de errores puede escanear muchas candidatas con coste acumulado alto

Impacto: sesiones grandes generan colas de candidatas por jugada del jugador y analizan dos evaluaciones por candidata. Aunque hay `yieldToUi()`, la duracion total puede ser muy alta antes de encontrar posiciones utiles.

Evidencia: sesion permite 1-200 posiciones (`app.js:2119`, `app.js:2262-2265`); fetch descarga hasta 300 partidas (`app.js:2043`, `app.js:2070`); `buildRandomCandidateQueue()` anade multiples plies por partida en `app.js:3150-3178`; `findNextMistake()` evalua hasta agotar cola, con tope parcial de 140 solo si ya hay repetidas (`app.js:3287-3335`).

Escenario: usuario con muchas partidas limpias y pocas imprecisiones; la app consume decenas/cientos de evaluaciones antes de producir la primera posicion.

Remediacion: anadir presupuesto maximo por busqueda inicial y por "siguiente"; prefiltrar candidatas por fase/movidas criticas; persistir progreso; permitir cancelar; registrar numero de nodos/candidatas evaluadas por posicion encontrada.

## Mediciones y pruebas recomendadas

- Playwright con red `offline`, `slow 3G`, API que nunca responde, API `429 Retry-After`, API `500`, y JSON/PGN corrupto.
- Test de fallo de `vendor/stockfish-18-lite-single.wasm`: verificar que no se ejecuta depth 17/18 local y que la UI sigue interactiva.
- Medicion Lighthouse/WebPageTest: transfer inicial, FCP/LCP con PNG vs WebP y Stockfish lazy.
- Prueba de sesion maxima: `sessionSize=200`, usuario con muchas partidas, registrar tiempo hasta primera posicion, candidatas analizadas y memoria JS.
- Prueba de reload/offline tras descargar partidas: debe continuar desde cache persistente o mostrar degradado claro.
