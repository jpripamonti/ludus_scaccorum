# Revision 02 - Correctitud de juego y motor

Snapshot:
- Branch: `main`
- Commit: `4473c3cef1c784336cce7bca33f299a4c39b6fdb`
- Working tree al iniciar el analisis: limpio

## Hallazgos

### 1. Carrera async al volver al menu durante la evaluacion de ronda

Impacto: una evaluacion vieja puede escribir resultados, puntaje e historial despues de que el usuario ya reinicio la sesion, contaminando el estado del nuevo flujo.

Evidencia: `resolveRound()` espera `evaluateRoundMovesForPosition()` y luego muta UI/score/historial sin verificar si la ronda sigue vigente (`app.js:4231`, `app.js:4311`, `app.js:4450`). `restartToSetup()` resetea pantalla/estado pero no invalida operaciones pendientes (`app.js:4625`). El boton `restartBtn` sigue activo durante evaluacion (`app.js:5531`).

Reproduccion: iniciar una posicion, jugar una movida, durante el overlay de "evaluando" pulsar `Volver al menu`. Cuando termina Stockfish, la ronda antigua puede volver a mostrar resultado y sumar historial/puntos sobre una sesion ya reiniciada.

Remediacion: introducir `sessionId`/`roundId` monotonico. Capturarlo al entrar en `resolveRound()` y validarlo despues de cada `await`; si cambio, abortar sin mutar estado. Alternativamente cancelar/ignorar jobs de motor al reiniciar.

Prueba: Playwright con `evaluateRoundMovesForPosition` stubbeado con demora; jugar, reiniciar antes de resolver, avanzar timers y afirmar que `resultOverlay` sigue oculto, `STATE.positions` vacio y no se agrega historial.

### 2. El resumen final de duelo muestra el puntaje de modo solo

Impacto: al terminar un duelo, el marcador principal del resumen puede mostrar `0 pts` aunque los jugadores hayan sumado puntos.

Evidencia: las tres ramas de resumen usan `STATE.score` (`app.js:4514`, `app.js:4545`, `app.js:4581`). En duelo, los puntos reales estan en `STATE.duel.scores` (`app.js:4359`); `STATE.score` solo se actualiza en solo (`app.js:4311`).

Reproduccion: jugar un duelo de una posicion donde ambos mueven. Tras pulsar `Siguiente posicion` para cerrar la sesion, el texto grande del resumen usa el score solo, no el marcador del duelo.

Remediacion: en resumen, si `isDuelMode()`, renderizar `STATE.duel.scores[0] - STATE.duel.scores[1]` o esconder `summaryScoreDisplayEl` y dejar solo `finalSessionSummaryText()`.

Prueba: test de estado con `gameFormat="duel"`, `STATE.duel.scores=[1,0.5]`, `STATE.index` en ultima posicion; llamar `nextPosition()` y afirmar que el resumen no contiene `0 pts`.

### 3. SAN generado es ambiguo y omite jaque/mate

Impacto: mejores jugadas, jugadas de partida, historial y botones de revelado pueden mostrar notacion incorrecta. En posiciones con dos piezas iguales hacia la misma casilla, ambas se muestran igual.

Evidencia: `moveToSan()` solo concatena pieza, captura, destino y promocion; no calcula desambiguacion ni `+/#` (`app.js:2431`). Comprobacion aislada: en FEN `rnbqkbnr/pppppppp/8/8/8/5N2/PPP1PPPP/RNBQKB1R w KQkq - 0 1`, las jugadas `Nf3-d2` y `Nb1-d2` salen ambas como `Nd2`.

Reproduccion: usar una posicion donde dos caballos puedan ir a `d2`; si una es mejor, la UI no permite distinguir cual. En `data/sample.pgn:14`, `Qg8#` se representaria como `Qg8`.

Remediacion: calcular SAN contra todos los movimientos legales: anadir archivo/rango minimo cuando haya conflicto y, tras aplicar la jugada en un clon, anadir `+` o `#` segun jaque y ausencia de respuestas legales. Considerar `chess.js` para evitar mantener reglas SAN propias.

Prueba: unit tests para `Nbd2`/`Nfd2`, capturas ambiguas y mates (`Qg8#`).

### 4. Los contadores FEN `halfmove` y `fullmove` nunca se actualizan

Impacto: las FEN guardadas/enviadas al motor no representan fielmente la partida. Esto afecta datos, cache de evaluacion y casos de regla de 50 movimientos.

Evidencia: `loadFen()` lee `halfmove` y `fullmove` (`app.js:996`), pero `makeMove()` solo cambia piezas, en passant y turno (`app.js:1192`). Comprobacion: tras `1.e4 e5`, el codigo produce `... w KQkq e6 0 1`; deberia ser fullmove `2`.

Remediacion: en `makeMove()`, resetear `halfmove` en movimiento de peon o captura, incrementarlo si no; incrementar `fullmove` despues de una jugada negra.

Prueba: secuencias `1.e4 e5`, captura, jugada no peon/no captura y posicion cercana a 50 movimientos.

### 5. Al cambiar idioma despues de un resultado de duelo, se pierde la SAN del jugador 2

Impacto: el resumen re-renderizado puede ocultar la jugada del segundo jugador.

Evidencia: `renderResultViewContext()` lee `context.player2.userSan` (`app.js:1708`), pero el contexto guarda esa propiedad como `san` (`app.js:4429`).

Reproduccion: terminar una ronda en duelo y cambiar ES/EN; el render del resultado usa una propiedad inexistente para la jugada actual de P2.

Remediacion: usar `context.player2.san || ""` y anadir prueba de re-render/localizacion del panel de duelo.

Checks ejecutados por el agente: `git status` limpio, `node --check app.js` OK, y reproducciones aisladas en Node para SAN ambiguo y FEN.
