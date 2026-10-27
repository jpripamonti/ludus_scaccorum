# Auditoría adversarial de flujos y resiliencia de estado

- **Agente:** Norman
- **Óptica:** recorridos de producto y recuperación de estado desde la persona usuaria: arranque, carga, partida, turnos, resultados, cancelación, reintentos y persistencia.
- **Snapshot auditado:** branch `main`, commit `dde59b0e41592534cdd4951a94c2376c17eb37e4`, working tree `limpio`.
- **Fecha:** 2026-08-25
- **Estado:** finalizado; no se modificó código de producto.

## Metodología

Se trazaron las transiciones de `STATE.ui.phase`, `sessionToken`, reloj, búsqueda de posiciones, evaluación con el motor y navegación del asistente. Se revisaron las rutas de éxito y de error de las descargas Lichess/Chess.com, la entrega del segundo turno en duelo, el resultado y el reinicio. También se inventariaron los datos persistidos frente a los que viven solamente en memoria.

Validación ejecutada: `npm test` pasó (`smoke-check` y `chess-regression-check`). Esas pruebas cubren sintaxis, assets y reglas de ajedrez, pero no estos recorridos de interfaz asíncronos ni reinicios durante tareas en curso.

## Hallazgos priorizados

### P1 — «Cancelar búsqueda» puede finalizar la sesión o ignorar la cancelación

**Evidencia.** El botón se ofrece como una cancelación explícita en [index.html:204-214](../index.html#L204-L214), pero su listener sólo modifica un booleano ([app.js:6600-6603](../app.js#L6600-L6603)). `findNextMistake` comprueba ese booleano únicamente en la condición del bucle ([app.js:3940-3945](../app.js#L3940-L3945)); si ya está esperando la evaluación de una candidata, al volver del `await` procesa y puede devolver una posición sin comprobar la cancelación ([app.js:3958-3974](../app.js#L3958-L3974)). Si no encuentra una candidata antes de cortar, devuelve `null` ([app.js:4001-4017](../app.js#L4001-L4017)). `nextPosition` interpreta ese mismo `null` como «no hay más posiciones» y muestra el resumen final ([app.js:5423-5454](../app.js#L5423-L5454)), tras haber ocultado el resultado anterior ([app.js:5344-5352](../app.js#L5344-L5352)).

**Impacto para la persona usuaria.** Cancelar una espera larga puede acabar la sesión de forma irreversible desde esa pantalla, o bien llevar de todas formas a la siguiente posición. En ambos casos el contrato visible del botón se rompe y se pierde la oportunidad de volver a intentar la búsqueda o de consultar el resultado previo.

**Remediación.** Modelar el desenlace de la búsqueda con estados distintos, por ejemplo `found`, `cancelled` y `exhausted`, no con `null`. Verificar la cancelación inmediatamente después de cada `await` y antes de reutilizar candidatas. Al cancelar, restaurar el overlay de resultado y el botón «Siguiente posición» sin modificar índice, puntaje ni resumen. Propagar un `AbortSignal` a las evaluaciones que lo permitan y probar: cancelar durante evaluación, con candidata encontrada y sin candidata.

### P1 — Se puede abandonar o cambiar la configuración durante el análisis, pero el trabajo viejo sigue y abre una sesión inesperada

**Evidencia.** El pipeline toma un token y captura la configuración/objetivo al comenzar ([app.js:6116-6118](../app.js#L6116-L6118), [app.js:6152-6189](../app.js#L6152-L6189)). Sin embargo, «Volver al inicio» sólo alterna la visibilidad de pantallas ([app.js:6301-6305](../app.js#L6301-L6305), [app.js:2584-2594](../app.js#L2584-L2594)): no invalida el token ni aborta la descarga o el análisis. Mientras tanto, los controles previos del asistente y los campos de usuario/proveedor/tamaño siguen teniendo listeners que mutan el estado y limpian la fuente ([app.js:6350-6406](../app.js#L6350-L6406), [app.js:6409-6427](../app.js#L6409-L6427)). Las descargas asíncronas instalan después su fuente capturada originalmente ([app.js:5785-5803](../app.js#L5785-L5803), [app.js:6050-6068](../app.js#L6050-L6068)) y el pipeline termina entrando en juego ([app.js:6121-6134](../app.js#L6121-L6134)).

**Impacto para la persona usuaria.** Tras volver al inicio puede reaparecer una partida que creía descartada. Si vuelve al paso anterior y cambia `alice` por `bob`, plataforma o cantidad mientras corre una búsqueda, puede jugar partidas descargadas y un objetivo correspondientes a la configuración vieja, aunque el asistente muestre la nueva. Es especialmente grave para la expectativa de qué cuenta pública se consulta.

**Remediación.** Durante `setupAnalyzing`, bloquear los controles que cambian el input del job y reemplazar «Volver al inicio» por una acción de cancelar con confirmación. Esa acción debe incrementar el token, abortar las peticiones mediante un `AbortController` de sesión y restaurar un estado estable. Como defensa adicional, pasar el token/configuración inmutable a cada descarga e impedir `installRemotePgnSource` y `enterPlayModeWithFirstPosition` si ya no coinciden. Añadir pruebas de integración para abandonar, cambiar usuario, proveedor y tamaño durante descarga y durante análisis.

### P1 — Un error al evaluar una jugada deja el tablero en una posición distinta de la que la lógica volverá a puntuar

**Evidencia.** Antes de evaluar, la interfaz aplica la jugada elegida directamente al tablero visible ([app.js:5052-5061](../app.js#L5052-L5061)). Ante cualquier excepción, el `catch` habilita otra vez la ronda y reinicia el reloj, pero no restaura `STATE.board`, `STATE.userMove`, las revelaciones ni la selección desde el FEN original ([app.js:4983-4995](../app.js#L4983-L4995)). En un segundo intento, la resolución crea su base desde `STATE.positions[index].fen` ([app.js:5001-5016](../app.js#L5001-L5016)), es decir, desde la posición anterior a la jugada que todavía se ve en pantalla. El panel que recibe el texto de error parte oculto al comenzar la ronda ([app.js:4501-4503](../app.js#L4501-L4503)) y la ruta de error tampoco lo vuelve visible.

**Impacto para la persona usuaria.** Ante una caída o timeout del motor, ve una jugada ya aplicada, vuelve a tener reloj y puede elegir una respuesta desde ese tablero; el sistema la compara con otro FEN. El mensaje de error puede no ser visible. Esto transforma un fallo recuperable en resultado inconsistente o en una ronda imposible de entender.

**Remediación.** Mantener el FEN de inicio como fuente de verdad y, ante error, ofrecer un estado explícito «No pudimos evaluar: Reintentar / Volver a la posición». La recuperación debe reconstruir tablero, selección, revelaciones y flags desde ese snapshot antes de reanudar el reloj. No habilitar el tablero hasta que se ejecute una de esas acciones. Cubrir con una prueba que fuerce un rechazo del motor después de una jugada y compruebe que el reintento usa el mismo FEN que se muestra.

### P1 — Un fallo tardío del Worker puede dejar la evaluación bloqueada indefinidamente

**Evidencia.** Al configurarlo, cualquier `worker.onerror` reemplaza el motor global por el fallback local ([app.js:3465-3483](../app.js#L3465-L3483)). Una evaluación ya en curso sigue usando `STATE.engine.worker`; en su timeout intenta ejecutar `STATE.engine.worker.removeEventListener(...)` antes de rechazar la promesa ([app.js:3523-3530](../app.js#L3523-L3530)). Después de `resetEngineToLocal`, ese valor global es `null` ([app.js:3405-3414](../app.js#L3405-L3414)), por lo que el callback lanza antes de llegar a `reject`. La ronda queda con `isResolvingRound` y el overlay de evaluación activos, sin una transición de recuperación.

**Impacto para la persona usuaria.** Un error de Web Worker/WASM ocurrido después del arranque —precisamente el escenario donde se necesita degradar con gracia— puede dejar la pantalla «Evaluando» sin salida ni resultado.

**Remediación.** Capturar una referencia local e inmutable al worker al iniciar `stockfishEvaluate`; limpiar listeners sobre esa referencia y registrar un handler de error que cierre la promesa una sola vez. Después, decidir explícitamente entre reintentar una vez con el fallback local o devolver el estado de error recuperable anterior. Añadir una prueba con un worker simulado que emita `error` durante una evaluación.

### P2 — Una recarga, cierre accidental o actualización pierde toda la sesión sin aviso ni recuperación

**Evidencia.** El estado de partida —posiciones, índice, puntajes, resultados del duelo, historial y fase— se inicializa sólo en memoria ([app.js:925-990](../app.js#L925-L990)). El único `localStorage` de preferencias guarda idioma y tiempo por turno ([app.js:711-771](../app.js#L711-L771)); IndexedDB se usa para bases PGN remotas ([app.js:2681-2783](../app.js#L2681-L2783)), no para la sesión. En cada arranque se muestra la landing y se recrea el tablero ([app.js:6636-6665](../app.js#L6636-L6665)).

**Impacto para la persona usuaria.** Una recarga por actualización del service worker, pestaña cerrada por accidente, suspensión que el navegador descarte, o fallo de red del frontend elimina una sesión en curso y ambos puntajes del duelo. La aplicación conserva partidas descargadas durante hasta siete días, pero no la experiencia que estaba jugando; por eso la pérdida es inesperada.

**Remediación.** Crear un checkpoint versionado y acotado de sesión después de cada transición estable (inicio de ronda, primer turno de duelo, resultado), con FEN, índice, configuración, puntajes, resultados necesarios e historial mínimo. Al arrancar, ofrecer «Reanudar» o «Descartar», nunca reanudar silenciosamente. Expirar el checkpoint, asociarlo al usuario/proveedor y hacer que «Borrar datos guardados» también permita purgarlo, para conservar control y privacidad.

### P2 — Los fallos del motor se degradan silenciosamente y pueden terminar comunicándose como un problema de la fuente

**Evidencia.** Si Stockfish no carga o falla durante una evaluación, las funciones de evaluación cambian a un motor local de profundidad máxima 3 sin comunicarlo a la interfaz ([app.js:3405-3417](../app.js#L3405-L3417), [app.js:3575-3638](../app.js#L3575-L3638)); la profundidad interna solicitada llega a 18 ([app.js:130-145](../app.js#L130-L145)). Si un error alcanza el pipeline inicial, éste devuelve a la persona usuaria al paso de fuente y muestra `common.sourceErrorWithDetail` ([app.js:6135-6145](../app.js#L6135-L6145)), aunque la causa puede ser el análisis local/motor.

**Impacto para la persona usuaria.** Puede recibir puntuaciones materialmente distintas sin saber que cambió la calidad de análisis, o intentar cambiar de usuario/plataforma para resolver un fallo del motor. La recuperación existe, pero el mensaje induce una acción equivocada.

**Remediación.** Exponer un estado no intrusivo pero persistente de «motor local de respaldo» y de su alcance. Clasificar los errores por dominio (red/proveedor, parseo, motor, cancelación) y ofrecer una acción pertinente: reintentar análisis para el motor, no sólo cambiar fuente. Registrar telemetría local/opt-in de la degradación para distinguir fallos reales de proveedor.

## Riesgos residuales y condiciones de aceptación

- Las APIs públicas y el worker no son cancelables de forma fiable sin propagar una señal de aborto y sin pruebas con latencia/fallo inyectados; la UI no debe prometer una cancelación inmediata mientras una tarea no sea abortable.
- Un checkpoint de sesión aumenta la retención local de datos derivados de partidas públicas. Debe tener caducidad, borrado explícito y una explicación clara en la pantalla de reanudación.
- Consideraría cerrados los P1 cuando pruebas de navegador cubran: cancelar búsqueda, salir/cambiar datos durante análisis, error de motor después de mover, error del worker durante evaluación y duelo entre los dos turnos; cada caso debe terminar en un estado visible desde el que se pueda continuar o salir sin alterar el puntaje ni el FEN de forma implícita.
