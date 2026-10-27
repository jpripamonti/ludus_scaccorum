# Reporte 05: Mantenibilidad, deploy y licencias

Snapshot:
- Branch: `main`
- Commit: `4473c3cef1c784336cce7bca33f299a4c39b6fdb`
- Working tree al iniciar el analisis: limpio

## Hallazgos

### 1. Alto: riesgo GPL por distribuir `wasm` de Stockfish sin fuente correspondiente reproducible

Impacto: GitHub Pages distribuye codigo objeto (`vendor/stockfish-18-lite-single.wasm`, 7.0 MB). El repo solo incluye `LICENSE` GPL general y una nota breve en `README.md:44-48`, pero no un manifiesto de terceros, commit exacto, script de build ni fuente correspondiente del artefacto.

Evidencia: `vendor/stockfish-18-lite-single.js:2-10` declara Stockfish.js 18, GPLv3 y red neuronal; `README.md:48` solo dice "GPL-compatible terms".

Escenario: ante una auditoria o issue de licencia, no hay forma de demostrar que fuente exacta genero el `.wasm` ni reconstruirlo.

Remediacion: agregar `THIRD_PARTY_NOTICES.md`, version/commit/checksum, instrucciones de reconstruccion, enlace exacto a fuente correspondiente y politica para actualizar Stockfish.

### 2. Alto: el deploy publica archivos internos versionados

Impacto: el workflow copia casi toda la raiz a Pages. Como `.claude/launch.json`, `.codex/environments/environment.toml` y varios `.DS_Store` estan versionados, tambien entran al artefacto publico.

Evidencia: `.github/workflows/deploy-pages.yml:29-39` usa `rsync ./ _site/` y solo excluye `.git`, `.github`, `node_modules`, `output`, `_site`; `.claude/launch.json:5-8` expone configuracion local; `.codex/environments/environment.toml:1-10` expone metadatos de entorno.

Escenario: se agrega accidentalmente otro archivo local sensible o de tooling y queda publicado en Pages en el siguiente push a `main`.

Remediacion: publicar desde una lista allowlist (`index.html`, `app.js`, `styles.css`, `assets`, `vendor`, `LICENSE`) o excluir explicitamente `.claude/`, `.codex/`, `.DS_Store`, `TODO.md`, `progress.md`, `package*.json`.

### 3. Medio: deploy automatico sin validacion previa

Impacto: cualquier cambio en `main` se publica sin smoke test, lint, validacion de assets ni prueba de carga del worker/wasm.

Evidencia: `package.json:6-8` solo define `npm start`; `.github/workflows/deploy-pages.yml:25-53` no ejecuta `npm install`, `npm test`, Playwright ni verificacion estatica.

Escenario: un error de sintaxis en `app.js`, un asset faltante o un worker roto llega directo a produccion.

Remediacion: agregar `npm test`/`npm run smoke`, Playwright minimo para landing, wizard y carga de Stockfish, y bloquear deploy si falla.

### 4. Medio: `app.js` es una unidad monolitica dificil de probar

Impacto: UI, estado global, red, PGN, motor, temporizador, tablero y scoring viven en un archivo de 5.570 lineas, con dependencias directas al DOM desde el inicio. Esto encarece cambios pequenos y hace fragiles las pruebas unitarias.

Evidencia: referencias DOM globales en `app.js:1-50`; estado global en `app.js:807-860`; pipeline principal mezcla descarga, parsing, analisis y UI en `app.js:5128-5269`.

Escenario: modificar el wizard o temporizador puede romper scoring o motor por efectos sobre `STATE`.

Remediacion: extraer modulos puros: `chess/`, `pgn/`, `engine/stockfishClient`, `sessionPipeline`, `ui/`; inyectar `fetch`, `Worker`, reloj y almacenamiento.

### 5. Medio: reglas de ajedrez y PGN implementadas a mano sin tests

Impacto: el dominio central depende de parsers y legalidad propios, no de una libreria probada ni de fixtures.

Evidencia: logica de legalidad/castling/check en `app.js:1186-1315`; parser SAN/PGN en `app.js:3016-3106`; busqueda local fallback en `app.js:2743-2776`.

Escenario: una promocion, en passant, SAN ambiguo o PGN con comentarios/variantes se parsea mal y genera posiciones o evaluaciones incorrectas.

Remediacion: usar una libreria mantenida como `chess.js` o aislar esta implementacion con fixtures PGN/SAN, tests de movimientos legales y comparacion contra posiciones conocidas.

### 6. Bajo/Medio: assets pesados y vendorizados sin presupuesto ni origen

Impacto: Pages sirve un PNG de 6.9 MB como imagen de landing aunque existe `maestro.webp` de 172 KB.

Evidencia: `styles.css:119` usa `assets/landing/maestro.png`; tamanos observados: `maestro.png` 6.9 MB, `maestro.webp` 172 KB, Stockfish wasm 7.0 MB.

Escenario: primera carga lenta en movil y mayor probabilidad de timeouts antes de que el usuario llegue al wizard.

Remediacion: usar `image-set()` o WebP por defecto, conservar PNG solo si es necesario, documentar origen/licencia y anadir presupuesto de tamano en CI.

## Oportunidades priorizadas

1. Endurecer Pages con allowlist de artefactos y un job de smoke test antes de `deploy-pages`.
2. Crear inventario de terceros: Stockfish, piezas `cburnett`, Google Fonts y assets de landing, con licencia/origen/checksum.
3. Separar logica pura de `app.js` y cubrir primero PGN/SAN, scoring, seleccion de candidatos y cliente Stockfish.
4. Anadir tests E2E minimos: landing, wizard Lichess/Chess.com con mocks, fallback de error, carga de worker y una ronda completa.
5. Optimizar assets publicados y eliminar archivos internos ya versionados del repositorio.
