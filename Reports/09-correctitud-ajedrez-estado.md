# Reporte 09 — Correctitud de ajedrez, estado y motor

- **Agente:** Anscombe-II
- **Óptica:** reglas de ajedrez, PGN/FEN, estados de partida, integración del motor, asincronía, scoring y errores.
- **Snapshot evaluado:** branch `main`
- **Commit:** `dde59b0e41592534cdd4951a94c2376c17eb37e4`
- **Working tree al iniciar la evaluación:** `limpio`
- **Fecha:** `2026-08-25`

## Metodología

Se revisaron los flujos desde la descarga de PGN hasta la selección, evaluación y puntuación de una posición; el generador de jugadas/FEN/SAN; y los límites de sesión y ronda. Se ejecutó `npm test` (smoke y regresión de ajedrez: correcto) y dos comprobaciones aisladas en Node: una demostró que una fuente PGN de `old-user` es aceptada mientras la UI muestra `new-user`, y otra demostró que el núcleo genera `e1g1` aun sin torre cuando el FEN declara derecho de enroque. No se modificó código de producto.

## Hallazgos

### P1 — Una descarga antigua puede iniciar una sesión con las partidas de otro usuario

**Evidencia.** `fetchLichessPgn()` y `fetchChessComPgn()` capturan `rawUser` al comenzar, pero instalan el resultado posteriormente sin comprobar que siga siendo el usuario/configuración vigente (`app.js:5668-5693`, `app.js:5785-5803`, `app.js:6050-6068`). El evento de edición del usuario sólo vacía la fuente actual; no invalida la operación ya iniciada (`app.js:6398-6406`). Después, `hasAnyPgnSource(true)` valida únicamente que coincida el *provider*, no `remote.username` contra el campo actual (`app.js:1503-1510`), y `installRemotePgnSource()` sustituye la fuente global (`app.js:2859-2862`). La comprobación aislada confirmó que una fuente Lichess de `old-user` devuelve disponible con la UI configurada para `new-user`.

**Impacto.** Si se modifica el usuario mientras la descarga/análisis inicial sigue en marcha, el flujo puede etiquetar y entrenar posiciones de A cuando la pantalla contiene B. Es una violación de correctitud de datos y puede exponer en pantalla información pública de una cuenta que el usuario ya descartó.

**Remediación.** Capturar un token de configuración/sesión y el `provider+username+signature` esperados antes de cada `await`; antes de instalar una fuente o actualizar la UI, descartar el resultado si no siguen coincidiendo. Hacer que `hasAnyPgnSource(true)` compare también proveedor, nombre normalizado y firma de configuración. Añadir una prueba con una descarga diferida, cambio de A a B, y la aserción de que sólo se consume B.

### P1 — La búsqueda de la próxima posición puede resucitar una sesión cancelada

**Evidencia.** `nextPosition()` valida `sessionToken` inmediatamente después de `await findNextMistake()` (`app.js:5425-5427`), pero después muestra la posición, espera 1.2 s y muta `STATE.positions`, `STATE.allMistakes`, `STATE.index` y arranca la ronda sin volver a validar el token (`app.js:5455-5462`). `restartToSetup()` incrementa el token y vacía precisamente esos arreglos y el tablero (`app.js:5480-5509`).

**Impacto.** Al reiniciar durante esos 1.2 s —o ante otra transición que invalide la sesión— la continuación vieja puede volver a insertar una posición y abrir una ronda sobre la pantalla recién reseteada. El estado, reloj, UI y puntaje dejan de pertenecer a la misma sesión.

**Remediación.** Revalidar `isCurrentSessionWork(sessionToken)` tras cada `await`, incluido el `sleepMs(1200)`, antes de toda mutación. Preferiblemente encapsular las mutaciones de transición en una función que reciba y exija el token. Cubrir con un test de timers falsos: resolver `findNextMistake`, reiniciar durante la demora visual y comprobar que no se llama a `startRound()` y que las posiciones siguen vacías.

### P2 — La interfaz impide elegir subpromociones legales

**Evidencia.** El generador crea las cuatro promociones legales, en orden dama, torre, alfil y caballo (`app.js:1190-1193`, `app.js:1210-1213`). Al pulsar la casilla destino, la UI selecciona el primer movimiento que comparta ese destino (`app.js:4530-4541`), por lo que siempre ejecuta la promoción a dama. El test de regresión comprueba que el núcleo sí soporta torre y caballo (`scripts/chess-regression-check.js:225-239`), pero no existe una elección de promoción a nivel de interacción.

**Impacto.** En una posición candidata donde una subpromoción sea la mejor o la única que evita tablas/mate, el jugador no puede realizar la jugada legal correcta y la puntuación evalúa una dama que no eligió. Afecta tanto la fidelidad del tablero como la calificación del entrenamiento.

**Remediación.** Cuando haya varios movimientos legales con el mismo `from/to` y distintas `promotion`, abrir un selector accesible de D/T/A/C antes de llamar a `submitUserMove`. Añadir pruebas de UI para `a7-a8=R` y `g2-g1=N`, además de conservar el flujo normal sin promoción.

### P2 — Los PGN válidos que parten de FEN se reconstruyen desde la posición inicial

**Evidencia.** `parseTags()` conserva etiquetas genéricas como `FEN` y `SetUp` (`app.js:3670-3689`), pero la evaluación de cada candidata crea incondicionalmente `new Chess(Chess.START_FEN)` (`app.js:3865-3871`). No hay uso posterior de `tags.FEN` ni `tags.SetUp` al reconstruir la partida. Por eso una SAN válida solamente desde el FEN no se resuelve y la candidata se descarta en `app.js:3871-3874`.

**Impacto.** Partidas públicas/importadas que comienzan desde una posición de composición, reanudación o análisis se omiten silenciosamente; peor aún, una secuencia que por casualidad también sea válida desde la inicial se asociaría a una posición incorrecta. La aplicación anuncia descargar PGN públicos, no que limite el formato a la posición inicial.

**Remediación.** Implementar la semántica PGN estándar `SetUp "1"` + `FEN "…"`: validar el FEN, instanciarlo como base, y usarlo para generar candidatos, metadatos y motor. Si la combinación es inválida, informar y omitir explícitamente esa partida con un contador. Añadir fixtures de FEN con enroque, en-passant y una SAN que no sea legal desde la inicial.

### P3 — El núcleo permite enrocar sin torre si el FEN conserva el derecho

**Evidencia.** `generateCastlingMoves()` sólo comprueba derechos, casillas intermedias y ataques (`app.js:1282-1301`); no exige una torre propia en `a1/h1/a8/h8`. `makeMove()` mueve lo que haya en esa casilla, incluso `null` (`app.js:1324-1332`). Reproducción aislada: `new Chess("4k3/8/8/8/8/8/8/4K3 w K - 0 1")` acepta `e1g1`.

**Impacto.** Un FEN externo inconsistente produce una jugada ilegal y un FEN posterior inválido. El riesgo crece al admitir PGN con FEN inicial; hoy queda parcialmente oculto porque las posiciones internas parten de la inicial y actualizan derechos al mover/capturar torres.

**Remediación.** Al generar cada enroque, comprobar la pieza exacta (`R`/`r`) en su esquina de origen y, al cargar FEN, validar coherencia de derechos de enroque o degradarlos de forma explícita. Añadir regresiones para derechos `K/Q/k/q` sin torre y con pieza enemiga en la esquina.

## Riesgos residuales

- El motor local de respaldo se limita a profundidad 3 (`app.js:141`, `app.js:3416-3418`); es una degradación explícita frente a Stockfish y puede cambiar qué posición se detecta o cómo se puntúa si falla el worker. Debe informarse de manera visible y probarse la consistencia de la transición de motor.
- El parser SAN es propio y deliberadamente limitado (`app.js:3698-3748`). Aunque las regresiones cubren SAN ambiguo, mate, enroque, en-passant y subpromoción del núcleo, faltan fixtures end-to-end para PGN con FEN, comentarios/variantes complejos y datos remotos malformados.
- Las defensas de token no son uniformes: antes de añadir nuevos `await` en descargas, búsquedas o evaluación de ronda conviene exigir una comprobación de vigencia antes de mutar `STATE` o el DOM.
