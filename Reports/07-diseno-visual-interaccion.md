# Auditoría adversarial de diseño visual e interacción

| Campo | Valor |
| --- | --- |
| Agente | **Bauhaus** |
| Óptica | Diseño: interfaz visual, jerarquía, interacción, responsive/móvil, arquitectura de información, sistema visual y copy de UI |
| Snapshot evaluado | `main` |
| Commit | `dde59b0e41592534cdd4951a94c2376c17eb37e4` |
| Working tree | limpio |
| Fecha | 2026-08-25 |

## Metodología

- Revisión estática de estructura, estilos, estados y textos en `index.html`, `styles.css` y `app.js`.
- Recorrido local de landing y los tres pasos del asistente, sin consultar proveedores externos ni enviar datos reales.
- Inspección visual en escritorio (1280 × 720) y móvil (375 × 812). Las mediciones que se citan abajo corresponden al segundo viewport.
- Alcance: se priorizó la experiencia visible y la interacción. No se modificó código de producto.

## Hallazgos priorizados

### P1 — El resultado aparece fuera de la vista móvil y no recibe foco ni desplazamiento

**Evidencia.** Cuando el resultado se vuelve visible, el código sólo cambia clases y muestra el panel; no desplaza ni enfoca el resultado ([`app.js:1791-1805`](../app.js#L1791-L1805)). En pantallas de hasta 1080 px, la grilla pasa a una columna y el panel de resultado queda explícitamente después del tablero, en la fila 3 ([`styles.css:1990-2026`](../styles.css#L1990-L2026)). Aun las herramientas del tablero quedan antes del panel ([`styles.css:2017-2025`](../styles.css#L2017-L2025)).

**Impacto.** Tras enviar una jugada, especialmente en teléfono, el usuario sigue mirando el tablero y puede no advertir que llegó el veredicto, los puntos y la siguiente acción. Es el momento de mayor valor pedagógico de la aplicación; ocultarlo debajo de un tablero de casi toda la pantalla rompe el ciclo `jugar → entender → continuar`.

**Recomendación.** En <=1080 px, convertir el resultado en una hoja/modal anclada o ubicarlo antes del tablero al resolverse. Como mínimo, al abrirlo hacer foco programático y `scrollIntoView({ block: "start" })` en el encabezado, respetando `prefers-reduced-motion`; dejar `Siguiente posición` visible al pie del resultado.

### P1 — En móvil la acción de abandonar/omitir se aleja del tablero y del reloj

**Evidencia.** Las acciones compartidas incluyen `Omitir jugada (0 pts)` y `Volver al menú` ([`index.html:280-283`](../index.html#L280-L283)), pero se trasladan dinámicamente al panel del jugador activo ([`app.js:1901-1910`](../app.js#L1901-L1910)). En el breakpoint <=1080 px, el tablero se ordena primero y ambos paneles de jugadores se ordenan después ([`styles.css:1990-2005`](../styles.css#L1990-L2005)). El reloj y el turno, por el contrario, se mantienen arriba del tablero ([`index.html:182-197`](../index.html#L182-L197)).

**Impacto.** Con una ronda cronometrada, la salida segura queda fuera de la zona de decisión: para omitir una posición o salir, hay que abandonar el tablero y hacer scroll hasta la tarjeta del jugador. Aumenta la fricción justamente cuando el tiempo es escaso y hace menos descubrible una acción esencial.

**Recomendación.** Mantener una barra compacta de acciones junto al tablero en viewports de una columna (por ejemplo, debajo de la barra de ronda), con `Omitir` y un menú/acción secundaria para salir. Los paneles de jugador pueden conservar el marcador, pero no deberían ser la única ubicación de los controles de la partida.

### P1 — El pie pegajoso del asistente tapa contexto y opciones en móvil

**Evidencia.** El resumen se entrega abierto en el HTML ([`index.html:128-131`](../index.html#L128-L131)); en móvil deja de ser sticky, pero no se cierra automáticamente ([`styles.css:2516-2527`](../styles.css#L2516-L2527)). El pie se mantiene `position: sticky; bottom: 0` ([`styles.css:2427-2441`](../styles.css#L2427-L2441)) y en móvil ocupa dos filas más la salida ([`styles.css:2529-2552`](../styles.css#L2529-L2552)).

**Comportamiento verificado.** En 375 × 812, durante el paso 3 el pie midió 113 px (`y=699–812`) mientras el resumen empezaba en `y=783`; queda visualmente por detrás del pie. En el paso 2 se observa el mismo solapamiento entre el resumen abierto y la navegación. El usuario puede desplazarse, pero la vista inicial comunica una composición cortada y esconde parte del contexto que el propio flujo declara importante.

**Impacto.** Se pierde espacio útil vertical, se ocultan decisiones recién tomadas y la CTA compite visualmente con contenido debajo de ella. En formularios largos, esta capa ocupa aproximadamente el 14 % del alto de un teléfono probado.

**Recomendación.** En <=920 px, iniciar el `<details>` cerrado y reservar `padding-bottom` equivalente al alto real del pie para el cuerpo del asistente. Alternativamente, dejar el pie en flujo normal hasta el último control o reducirlo a una sola fila con la acción primaria, sin el enlace secundario persistente.

### P2 — “Volver al menú” promete una pantalla que no existe como destino

**Evidencia.** La interfaz usa “Volver al menú” para la salida de la partida y para el final de sesión ([`app.js:176-183`](../app.js#L176-L183); [`index.html:252-255`](../index.html#L252-L255)). Sin embargo, `restartToSetup()` termina llamando a `showLandingScreen()` ([`app.js:5480-5534`](../app.js#L5480-L5534)); la pantalla destino sólo muestra la portada y el botón “Comenzar” ([`index.html:24-32`](../index.html#L24-L32)).

**Impacto.** La etiqueta crea una expectativa de menú con opciones o de volver a la configuración, pero el resultado real es el inicio. La discordancia es especialmente costosa porque la confirmación avisa que se borrará la sesión.

**Recomendación.** Nombrar consistentemente el destino real: “Volver al inicio” en botón, título de confirmación y CTA final. Si el objetivo es la configuración, no llamar a `showLandingScreen()` y decir “Volver a configuración”.

### P2 — La selección inicial del modo mezcla selección y navegación de forma asimétrica

**Evidencia.** El estado inicial muestra “Jugar solo/a” como seleccionado ([`app.js:2399-2408`](../app.js#L2399-L2408)), y el pie conserva “Siguiente” como navegación explícita ([`index.html:134-139`](../index.html#L134-L139)). Pero tocar “Jugar solo/a” navega directamente al paso 2 ([`app.js:6337-6348`](../app.js#L6337-L6348)), mientras tocar “Jugar contra alguien” sólo cambia la selección y abre campos ([`app.js:6351-6358`](../app.js#L6351-L6358)).

**Impacto.** Dos tarjetas del mismo grupo tienen semánticas distintas: una confirma y avanza, la otra sólo selecciona. Esto dificulta anticipar qué ocurrirá al tocar una opción y hace redundante o impredecible el botón “Siguiente”.

**Recomendación.** Separar elección de navegación: ambas tarjetas sólo deberían seleccionar y el pie avanzar. Si se quiere avance automático, aplicarlo de manera coherente tras una selección válida y eliminar la navegación duplicada.

### P2 — El sistema visual pierde continuidad entre portada y producto

**Evidencia.** La portada construye una atmósfera editorial: imagen de biblioteca/ajedrez, superposiciones, título serif dorado y CTA de la misma familia ([`styles.css:213-332`](../styles.css#L213-L332)). El asistente y el juego pasan de inmediato a superficies oscuras neutras, tarjetas utilitarias y tipografía de sistema ([`styles.css:2088-2120`](../styles.css#L2088-L2120); [`styles.css:1124-1230`](../styles.css#L1124-L1230)). En el recorrido visual de escritorio la portada se percibe como un producto distinto del configurador.

**Impacto.** Se invierte esfuerzo en una identidad evocativa antes de entrar, pero no se la lleva al uso repetido, donde ocurren el entrenamiento y el aprendizaje. El resultado parece una landing temática que desemboca en una consola genérica.

**Recomendación.** Mantener el tono ajedrecístico sin sacrificar legibilidad: un encabezado de producto persistente, la tipografía display sólo para hitos, una textura/motivo de baja intensidad o una escala de acentos compartida entre landing, asistente, tablero y feedback. Documentarlo como tokens de superficie, jerarquía y estados, no como excepciones por pantalla.

### P3 — Texto secundario de 13 px queda por debajo del contraste objetivo en superficies de tarjeta

**Evidencia.** El token de texto atenuado es `oklch(60% 0.012 255)` ([`styles.css:19-23`](../styles.css#L19-L23)); los párrafos de resumen se renderizan a 13 px con ese color ([`styles.css:2419-2425`](../styles.css#L2419-L2425)) sobre `--color-surface-2` (`oklch(21.5% 0.016 255)`, [`styles.css:13-16`](../styles.css#L13-L16)). La relación calculada para esa combinación es aproximadamente **4.44:1**, levemente menor al 4.5:1 esperado para texto normal.

**Impacto.** El resumen —que contiene modo, plataforma, usuario, cantidad y tiempo— se ve deliberadamente tenue y se vuelve más difícil de escanear en pantallas pequeñas o con brillo reducido.

**Recomendación.** Aumentar levemente la luminosidad de `--color-text-muted` o emplear `--color-text` para los valores del resumen, conservando el atenuado sólo para etiquetas. Verificar contrastes de todos los pares de tokens, no sólo de los bordes.

## Aspectos rescatables

- La portada ofrece una jerarquía clara: título, propuesta de valor y una única CTA; se lee bien tanto en escritorio como en 375 px.
- El asistente hace explícito el progreso por pasos y las tarjetas seleccionadas tienen un estado visible consistente en color y borde.
- Hay foco visible global, una adaptación deliberada de la barra de ronda bajo 700 px y una preferencia para reducir movimiento ([`styles.css:591-594`](../styles.css#L591-L594), [`styles.css:2037-2051`](../styles.css#L2037-L2051), [`styles.css:2749-2757`](../styles.css#L2749-L2757)). Son una base sólida para corregir los problemas de jerarquía sin rehacer la interfaz.

## Orden sugerido de corrección

1. Hacer visible y accionable el resultado en móvil.
2. Reubicar controles de partida en el breakpoint de una columna.
3. Reparar el solapamiento del pie móvil y cerrar el resumen por defecto.
4. Unificar la navegación y el copy de destino.
5. Consolidar tokens y continuidad de marca; ajustar el contraste del texto secundario.
