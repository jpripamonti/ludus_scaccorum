# Revision UX, accesibilidad y producto

Snapshot:
- Branch: `main`
- Commit: `4473c3cef1c784336cce7bca33f299a4c39b6fdb`
- Working tree al iniciar el analisis: limpio

## Hallazgos

### Alta: el tablero no es operable con teclado ni comprensible para lector de pantalla

Impacto: un usuario que no usa mouse/touch no puede jugar. Un lector de pantalla recibe imagenes `alt="wP"`/`"bK"` sin contexto de casilla ni acciones.

Evidencia: `index.html:185-187` crea `#board` como `div`; `app.js:3374-3388` genera casillas `div` con solo `click`; `app.js:3511-3515` usa `alt` tecnico para piezas. No hay `keydown`, `tabindex`, `role="grid"` ni nombres accesibles por casilla.

Escenario: usuario navega con Tab en una partida: puede llegar a botones externos, pero no seleccionar pieza ni destino.

Remediacion: convertir casillas en botones o implementar grid roving tabindex; agregar `aria-label` tipo "e2, peon blanco"; soportar Enter/Espacio/flechas; anunciar seleccion, jugadas legales y resultado con `aria-live`.

### Alta: en movil el tablero solo ocupa 60vw en modo solo

Impacto: en un viewport de 390px el tablero queda cerca de 234px, con casillas de ~29px, por debajo de un objetivo tactil razonable.

Evidencia: `styles.css:1749-1755` fuerza `body.solo-mode .board-wrap` a `width: min(60vw, 760px)` en `max-width:1080px`; no hay override de gameplay en `max-width:480px` (`styles.css:992-1019` solo ajusta landing).

Escenario: usuario intenta mover una pieza en telefono y toca casillas vecinas, especialmente cerca del reloj lateral.

Remediacion: para `max-width:600px`, usar tablero casi full width y mover el reloj arriba/abajo, o integrarlo como barra horizontal; validar que cada casilla ronde 44px cuando sea posible.

### Media: el resumen final del duelo muestra "0 pts" como marcador principal

Impacto: al terminar un duelo local, el dato mas visible contradice el marcador real y reduce confianza en el resultado.

Evidencia: el puntaje de duelo se guarda en `STATE.duel.scores` (`app.js:4358-4362`), pero el resumen usa `STATE.score` (`app.js:4514`, `app.js:4545`, `app.js:4581`), que solo se incrementa en modo solo (`app.js:4311`). `finalSessionSummaryText()` si calcula el marcador de duelo en `app.js:3995-4010`.

Escenario: dos jugadores terminan una sesion; el panel grande dice `0 pts`, aunque el texto inferior declare ganador.

Remediacion: en modo duelo, mostrar `Jugador 1 X - Y Jugador 2` en `summaryScoreDisplayEl`, no `STATE.score`.

### Media: errores del paso 1 del wizard pueden quedar invisibles

Impacto: si el usuario borra nombres del duelo, "Siguiente" no avanza pero el mensaje se escribe en un elemento ubicado dentro del paso 3 oculto.

Evidencia: `#analysis-status` vive en el paso 3 (`index.html:108-109`). La validacion de nombres falla en `app.js:2239-2246`; el click de "Siguiente" escribe en `analysisStatusEl` para cualquier paso (`app.js:5299-5305`), pero solo muestra error visible especial en paso 2.

Escenario: elegir duelo, borrar ambos nombres, tocar "Siguiente": no hay explicacion visible junto a los campos.

Remediacion: agregar un contenedor de error por paso con `aria-live`, enfocar el primer campo invalido y asociar `aria-describedby`.

### Media: las tarjetas seleccionables no exponen estado seleccionado

Impacto: modo, plataforma, cantidad y tiempo dependen de color/clase visual; tecnologias asistivas no reciben "seleccionado".

Evidencia: botones del wizard en `index.html:46-49`, `index.html:68-70`, `index.html:85-99`; el estado se aplica solo con `.is-selected` en `app.js:2207-2218`.

Escenario: lector de pantalla enumera "Jugar solo/a" y "Jugar contra alguien" como botones normales, sin indicar cual esta activo.

Remediacion: usar `aria-pressed` en botones tipo toggle o radio groups reales con `role="radio"`/`aria-checked`.

### Media: "Volver al menu" descarta sesion sin confirmacion

Impacto: un toque accidental borra progreso, posiciones y marcador.

Evidencia: boton en `index.html:273-275`; listener directo en `app.js:5531`; `restartToSetup()` limpia estado en `app.js:4625-4675`.

Escenario: en movil, durante duelo, el jugador toca "Volver al menu" en vez de "Omitir jugada"; pierde la sesion.

Remediacion: pedir confirmacion si hay sesion activa, o permitir deshacer/restaurar ultimo estado.

## QA manual rapido

Desktop:
- Navegar solo con teclado desde landing hasta una jugada completa.
- Verificar foco visible en botones, handoff y resultado.
- Terminar duelo de 1 posicion y comprobar marcador principal vs detalle.
- Forzar error de usuario inexistente en Lichess/Chess.com.

Mobile:
- Viewports 390x844 y 360x740: mover piezas en esquinas y centro.
- Revisar que tablero, reloj y overlay de resultado no compitan por ancho.
- En duelo, completar turno 1, handoff, turno 2 y resumen.
- Tocar accidentalmente cerca de "Volver al menu" y validar confirmacion.
