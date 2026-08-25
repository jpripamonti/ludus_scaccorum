# Auditoría adversarial de accesibilidad inclusiva

- **Agente:** Perkins
- **Óptica:** accesibilidad: semántica HTML, teclado/foco, lector de pantalla/ARIA, contraste, zoom/móvil y preferencias de movimiento.
- **Snapshot branch:** `main`
- **Commit:** `dde59b0e41592534cdd4951a94c2376c17eb37e4`
- **Working tree:** limpio
- **Fecha:** 2026-08-25

## Alcance y método

Revisión estática adversarial de `index.html`, `app.js` y `styles.css` en el snapshot indicado. Se siguieron los flujos de asistente, tablero con teclado, reloj, evaluación, cambio de turno, resultado y consentimiento; se trazaron los cambios de DOM, foco y atributos ARIA. Se comprobó además que esos tres archivos no difieren del commit auditado. No se ejecutó una prueba manual con lector de pantalla, zoom de navegador ni herramientas automatizadas, por lo que los hallazgos que dependen del comportamiento de una tecnología asistiva se señalan como riesgo a confirmar.

## Hallazgos priorizados

### P1 — El reloj puede inundar los anuncios del lector de pantalla durante toda la jugada

**Evidencia.** `index.html:191-195` convierte todo el reloj en una región `aria-live="polite"`. `app.js:149` configura ticks cada 100 ms; `app.js:2125` reasigna el texto del reloj y `app.js:2141-2152` lo hace repetidamente durante toda la ronda. Un lector puede interpretar esas mutaciones del árbol vivo como anuncios frecuentes (incluso aunque el minuto/segundo visible no haya cambiado en cada tick).

**Impacto.** Una persona que usa lector de pantalla recibe anuncios constantes o una cola de anuncios que tapa el estado del tablero, el turno y los mensajes de resultado. Además, el temporizador ya impone presión temporal.

**Arreglo recomendado.** Quitar `aria-live` del contenedor que se actualiza en cada tick. Mantener un `role="status"` dedicado y actualizarlo sólo en hitos útiles (por ejemplo, 60, 30, 10 y 0 segundos), sin repetir el mismo texto; el valor visual puede conservar los ticks de 100 ms.

### P1 — Al aparecer el resultado, el foco queda en un tablero que acaba de quedar inutilizable

**Evidencia.** El resultado se revela al quitar `hidden` en `app.js:1791-1806`, sin guardar/restaurar ni mover el foco. Inmediatamente los flujos de resultado bloquean la entrada de tablero con `setUiPhase("result", true)` (`app.js:5173-5175` y `app.js:5305-5337`). Las casillas permanecen en el orden de tabulación mediante un único `tabindex="0"` y sólo se marcan `aria-disabled` (`app.js:4311-4325`). El contenedor de resultado sólo es un `aside` con `aria-live="polite"`, no un diálogo ni una región de estado acotada (`index.html:229-257`).

**Impacto.** Para navegación por teclado o lector de pantalla, el desenlace puede pasar desapercibido: el foco sigue anunciando una casilla deshabilitada y no se conduce a la calificación ni a “Siguiente posición”. Actualizar contenido dentro de una región que estaba con `display:none` tampoco es una forma fiable de notificar un resultado complejo.

**Arreglo recomendado.** Tratar el resultado como una transición explícita: conservar el disparador, enfocar el encabezado de resultado (`tabindex="-1"`) o la primera acción al abrirlo, y devolver el foco a un destino válido al cerrarlo/siguiente ronda. Para el anuncio, usar una región `role="status"` breve con veredicto y puntos, separada de la tabla y de los botones. Si el resultado debe bloquear la interacción circundante, usar semántica de diálogo y hacer inerte el fondo; si no, mantenerlo como sección pero aplicar la gestión de foco anterior.

### P2 — La barra de progreso de evaluación está escondida explícitamente de tecnologías asistivas

**Evidencia.** `index.html:207-212` aplica `aria-hidden="true"` a `#position-search-progress`, que contiene tanto la barra como el texto de porcentaje. Sin embargo `app.js:1623-1643` muestra el bloque, cambia el ancho y escribe el porcentaje/tiempo durante la evaluación. No se exponen `role="progressbar"`, `aria-valuenow`, `aria-valuemin` ni `aria-valuemax`.

**Impacto.** Un usuario de lector de pantalla no puede consultar cuánto falta en una operación que inmoviliza temporalmente el tablero; el porcentaje que se muestra visualmente queda fuera del árbol de accesibilidad.

**Arreglo recomendado.** Quitar `aria-hidden` del progreso funcional. Exponer un elemento con `role="progressbar"` y valores numéricos actualizados, o un `<progress>` etiquetado, y reservar los anuncios vivos para hitos poco frecuentes. Si sólo se quiere ocultar la banda decorativa, ocultar únicamente esa pieza, no su texto y estado.

### P2 — Los errores de los campos del asistente no quedan asociados al control inválido

**Evidencia.** `showWizardStepError` añade `aria-describedby` únicamente a los dos campos de nombres del duelo (`app.js:2322-2341`). En cambio, `showWizardSourceError` sólo escribe y muestra un párrafo vivo (`app.js:2310-2320`) y `focusFirstInvalidWizardControl` mueve el foco al nombre de usuario o a la cantidad de posiciones (`app.js:2344-2360`) sin `aria-invalid` ni una relación con el mensaje. En el marcado, ambos errores son párrafos separados (`index.html:63, 81-83`).

**Impacto.** Tras volver a un campo inválido, una persona que navega por foco puede oír sólo su etiqueta y valor, no el motivo del rechazo. La corrección depende de haber percibido el anuncio efímero inicial.

**Arreglo recomendado.** En cada ruta de validación, aplicar `aria-invalid="true"` al campo afectado y añadir el id de error a `aria-describedby`; limpiar ambos atributos al corregirlo. Mantener los mensajes con texto que nombre el problema y el campo, no únicamente color o un aviso global.

### P3 — Las selecciones excluyentes se exponen como botones toggle independientes, no como una única elección

**Evidencia.** Modo, plataforma, cantidad y tiempo se agrupan con `role="group"` (`index.html:48-54, 76-79, 96-100, 107-110`) y el script comunica el estado con `aria-pressed` (`app.js:2075-2081, 2399-2427`). En cada grupo el modelo de datos admite una única opción, pero el patrón ARIA elegido describe varios botones que podrían quedar presionados simultáneamente.

**Impacto.** Un lector de pantalla recibe estados de botones aislados, no una decisión exclusiva con posición y cantidad de opciones. Se reduce la previsibilidad para quien espera el patrón de radio buttons y sus flechas de dirección.

**Arreglo recomendado.** Usar controles `input type="radio"` con `fieldset`/`legend`, o implementar el patrón ARIA de `radiogroup`/`radio` con `aria-checked`, navegación por flechas y foco gestionado. Conservar botones normales sólo si cada acción no representa una selección mutuamente excluyente.

## Controles positivos observados

- El tablero tiene una cuadrícula con etiquetas por casilla, foco de roving tabindex y soporte de flechas, Espacio y Enter (`app.js:4101-4163, 4256-4326`); las imágenes de piezas son decorativas para evitar doble lectura.
- El diálogo de consentimiento tiene `role="alertdialog"`, etiqueta/descripción, foco inicial, Escape, ciclo de Tab y retorno de foco (`index.html:293-306`, `app.js:2874-2973`).
- Hay un anillo de foco visible global y un anillo específico de casilla (`styles.css:587-594, 836-846`), además de una regla completa para `prefers-reduced-motion: reduce` (`styles.css:2748-2757`).
- Las fichas de color fueron declaradas con atención explícita al contraste de controles (`styles.css:12-47`), pero su contraste efectivo sigue requiriendo medición renderizada en todos los estados.

## Riesgos y controles pendientes

1. Probar los flujos de P1/P2 con NVDA+Firefox y VoiceOver+Safari, incluidas las actualizaciones del reloj, el resultado, cancelación de búsqueda y cambio de turno.
2. Ejecutar axe/Lighthouse y una inspección manual a 200% y 400% de zoom, con viewport CSS de 320 px, porque hay reglas globales de `overflow-x: hidden/clip` (`styles.css:724-729, 2483-2489`) que pueden ocultar, en lugar de revelar, un desborde que no se detecta estáticamente.
3. Medir contraste real de texto, bordes, estados de error/éxito y marcas del tablero sobre cada fondo; no se declara una alternativa de alto contraste ni de tema claro, por lo que la revisión de tokens no sustituye una prueba de renderizado.
4. Validar con personas usuarias el modelo de teclado del tablero y documentar una instrucción breve y accesible cerca de la cuadrícula (flechas para moverse; Espacio/Enter para seleccionar), especialmente para quienes no conocen el patrón `grid`.
