# Auditoría adversarial de diseño (visual, interacción, arquitectura de información, accesibilidad, copy y móvil)

Snapshot:
- Branch: `main`
- Commit al iniciar: `cc5d3a3`
- Working tree al iniciar: limpio
- Fecha: 2026-08-25

## Cómo se verificó

Servidor local `python3 -m http.server 5010`, navegador integrado. Se desregistró el service worker y se vació el caché antes de medir, para no leer una copia vieja.

Viewports probados: escritorio 1280×720 y móvil 375×812.

Las relaciones de contraste se calcularon de verdad: se leyó el color computado de cada elemento, se lo resolvió a sRGB pintándolo en un `<canvas>` de 1×1 (los tokens están en `oklch()` y no se pueden parsear a ojo), y se aplicó la fórmula de luminancia relativa de WCAG 2.1. Todos los números que aparecen abajo salen de esa medición o de `getBoundingClientRect()`.

**Advertencia sobre pantallas forzadas.** No se puede completar una sesión real sin descargar partidas y esperar al motor. Las pantallas de juego, resultado, cambio de turno, búsqueda de posición y consentimiento se inspeccionaron quitándoles la clase `hidden` a mano y, en algunos casos, inyectando contenido de ejemplo. Cada hallazgo que dependa de eso lo aclara en su evidencia. Los hallazgos que sólo dependen de CSS o de código leído no tienen esa limitación.

**Sobre el modo claro.** No hay ninguna regla `prefers-color-scheme` en `styles.css` (0 coincidencias en 2489 líneas). La app es deliberadamente oscura y única; no se reporta como falta de modo claro, pero sí se reporta abajo la consecuencia concreta de no declarar `color-scheme`.

---

# Hallazgos

## 1. El foco de teclado sobre el tablero es literalmente invisible

**Severidad: alta**

**Dónde:** `styles.css:752-756`, selector `.square:focus-visible`. Afecta a las 64 casillas de `#board`.

**Qué está mal.** El tablero sí se puede recorrer con el teclado: `app.js:4033-4044` pone `tabIndex`, flechas, Enter y Espacio en cada casilla, y `app.js:4148` mantiene el foco móvil. Pero la regla que debería dibujar el recuadro de foco pide un color que no existe:

```css
.square:focus-visible {
  outline: 3px solid var(--color-info);
  outline-offset: -5px;
}
```

`--color-info` no está definido en ningún lado del archivo. Cuando una propiedad usa una variable inexistente, el navegador descarta la declaración entera y devuelve las tres subpropiedades a su valor inicial: `outline-style: none`. Peor: como la regla del autor gana en especificidad, también borra el recuadro que el navegador dibujaría por su cuenta.

Para quien usa la app sin mouse, esto significa que puede mover el foco por las 64 casillas sin ver nunca dónde está. El trabajo de teclado que ya está implementado queda inutilizable.

**Evidencia.**
- `grep -o "var(--[a-z0-9-]*" styles.css` comparado con las variables declaradas: sólo faltan dos, `--clock-ratio` (que se inyecta desde JS en `app.js:2113`, correcto) y `--color-info`, usada una única vez en la línea 753 y nunca declarada.
- Prueba en el navegador: se creó un `<div>` con `style="outline: 3px solid var(--color-info)"`. El estilo computado devolvió `outline-style: "none"` y `outline-width: "3px"` (que es el valor inicial `medium`, no el `3px` escrito). Es decir: la declaración se descartó por completo.
- `getComputedStyle(document.documentElement).getPropertyValue('--color-info')` devuelve la cadena vacía.

**Corrección.** Definir el token que falta junto a los demás y aprovecharlo también para un estilo de foco global (ver hallazgo 6).

```css
/* styles.css, dentro de :root, junto a los tokens de veredicto (línea ~36) */
--color-info:        oklch(80% 0.130 230);   /* 11,03:1 contra --color-bg */
```

Ahora bien, un solo color no alcanza para el tablero: el recuadro cae sobre casillas claras (`#f0d9b5`) y oscuras (`#b58863`), y ese celeste tiene apenas **1,33:1** contra las claras. Hay que usar un anillo de dos tonos, y ponerlo **después** de las reglas de resaltado de jugada de las líneas 800-807, que también usan `box-shadow` con la misma especificidad y hoy ganarían por orden:

```css
/* styles.css — mover este bloque desde la línea 752 hasta después de la línea 807 */
.square:focus-visible {
  outline: none;
  box-shadow:
    inset 0 0 0 3px var(--color-info),
    inset 0 0 0 6px oklch(18% 0.02 255);
  z-index: 7;
}
```

Números del anillo de dos tonos: el aro oscuro exterior da **13,69:1** contra casilla clara y **5,97:1** contra casilla oscura; el celeste interior da **10,33:1** contra ese aro oscuro. Se ve siempre, sobre cualquier casilla y encima de cualquier resaltado de jugada.

**Trabajo: chico** (1 línea de token, 8 líneas de CSS reubicadas).

---

## 2. "Omitir jugada (0 pts)" tiene 2,05:1 de contraste y parece deshabilitado cuando no lo está

**Severidad: alta**

**Dónde:** `styles.css:578-582`, selector `#skip-btn`. El botón vive en `index.html:283`.

**Qué está mal.** El botón usa `color: var(--color-text-dim)` sobre fondo transparente, o sea sobre `--color-bg`. Medido: **2,05:1**. El mínimo de WCAG AA para texto normal es 4,5:1. Y cuando el botón está deshabilitado (que es su estado durante buena parte de la ronda), el `opacity: 0.45` global lo lleva a **1,30:1**, prácticamente el fondo.

Es una de las dos acciones que el jugador tiene disponibles durante la ronda, y es la única salida cuando no encuentra la jugada. Se lee como texto muerto. En la captura de móvil es el elemento más tenue de toda la pantalla, más tenue incluso que las etiquetas secundarias.

**Evidencia.** Color computado `oklch(0.4 0.012 255)` → sRGB (67,72,78); fondo `oklch(0.13 0.018 255)` → sRGB (11,17,24). Relación 2,05:1. Con `opacity: 0.45` compuesto contra el mismo fondo: 1,30:1. Verificado además visualmente en la pantalla de juego en 375×812 con el botón habilitado por código.

**Corrección.**

```css
/* styles.css:578 — reemplazar el bloque #skip-btn */
#skip-btn {
  border-color: var(--color-border-mid);
  background: transparent;
  color: var(--color-text-muted);   /* 4,81:1 sobre --color-bg */
}
#skip-btn:hover:not(:disabled) {
  color: var(--color-text);
  border-color: var(--color-gold-dim);
}
```

Y subir el piso del estado deshabilitado, que hoy afecta a todos los botones:

```css
/* styles.css:563 */
button:disabled {
  opacity: 0.6;      /* era 0.45 */
  cursor: not-allowed;
}
```

**Trabajo: chico.**

---

## 3. El modal de consentimiento no captura el foco, no cierra con Escape y no confirma con Enter

**Severidad: alta**

**Dónde:** `app.js:2850-2897` (`confirmRemoteFetchConsent`), marcado en `index.html:295-307` (`#consent-overlay`).

**Qué está mal.** El diálogo se declara como `role="alertdialog"` y `aria-modal="true"`, pero el código que lo abre no hace nada de lo que ese contrato promete:

- No mueve el foco al diálogo. El foco queda donde estaba, detrás del velo. Quien navega con teclado o con lector de pantalla no se entera de que apareció un diálogo y sigue tabulando por el asistente que está tapado.
- No hay trampa de foco. Tabular saca el foco del diálogo hacia el fondo, que sigue siendo interactivo.
- No hay ningún manejador de `Escape` (`grep -n "Escape" app.js` devuelve **cero** coincidencias en todo el archivo).
- El campo "Volvé a escribir el usuario para confirmar" no está dentro de un `<form>` y no tiene manejador de teclado. Quien escribe el usuario y aprieta Enter — que es lo que todo el mundo hace — no pasa nada. Hay que ir con el mouse hasta "Aceptar".
- No se restaura el foco al cerrar.

Es el peor lugar para tener esto, porque es el punto en que el usuario decide si su nombre de usuario sale hacia un servicio externo.

Llama la atención porque el overlay de cambio de turno **sí** tiene manejo de foco (`app.js:1588`, `app.js:1593`, `app.js:1601-1602`). El patrón existe en el proyecto y no se aplicó acá.

**Evidencia.** Lectura completa de `confirmRemoteFetchConsent`: entre las líneas 2850 y 2897 sólo hay `classList.remove("hidden")`, dos `addEventListener("click", ...)` y la comparación del usuario. Ni un `.focus()`, ni un `keydown`. `grep -n "consentOverlay" app.js` confirma que no hay ningún otro punto del archivo que le agregue comportamiento.

**Corrección.** Dentro de la promesa de `confirmRemoteFetchConsent`, agregar:

```js
const previouslyFocused = document.activeElement;
const focusables = () => [
  consentOverlayUsernameInputEl,
  consentOverlayCancelBtn,
  consentOverlayAcceptBtn,
].filter(Boolean);

const onKeyDown = (event) => {
  if (event.key === "Escape") { event.preventDefault(); onCancel(); return; }
  if (event.key === "Enter" && event.target === consentOverlayUsernameInputEl) {
    event.preventDefault(); onAccept(); return;
  }
  if (event.key !== "Tab") return;
  const items = focusables();
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
};

consentOverlayEl.addEventListener("keydown", onKeyDown);
if (consentOverlayUsernameInputEl) consentOverlayUsernameInputEl.focus();
```

y en `cleanup()`: `consentOverlayEl.removeEventListener("keydown", onKeyDown); previouslyFocused?.focus?.();`

Además, enlazar el error al campo, en `index.html:300`:

```html
<input id="consent-overlay-username-input" type="text" class="consent-overlay-username-input"
       autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"
       aria-describedby="consent-overlay-error" />
```

**Trabajo: mediano** (unas 30 líneas de JS, sin texto nuevo de interfaz).

---

## 4. El texto del overlay "Buscando próxima posición" se lee sobre el tablero, con 2,41:1

**Severidad: alta**

**Dónde:** `styles.css:1503-1560`, selectores `.position-search-overlay`, `.position-search-meta`, `.position-search-progress-label`. Elemento `#position-search-overlay` (`index.html:196-206`).

**Qué está mal.** El overlay se pinta con un velo semitransparente (`rgba(10,12,18,0.72)`) directamente encima del tablero, sin ninguna placa opaca detrás del texto. Debajo de cada línea de texto hay casillas claras (`#f0d9b5`) y oscuras (`#b58863`) alternándose, así que el contraste **cambia palabra por palabra dentro de la misma frase**.

Este overlay aparece mientras el usuario espera —a veces varios segundos— y es donde se explica cuánto falta y se ofrece cancelar. Es exactamente el momento en que el texto tiene que leerse sin esfuerzo.

**Evidencia.** Composición del velo sobre casilla clara: 0,72·(10,12,18) + 0,28·(240,217,181) = (74,69,64). Sobre casilla oscura: (58,47,41).

| Elemento | Sobre casilla clara | Sobre casilla oscura | Mínimo AA |
|---|---|---|---|
| `.position-search-meta` (13-16 px, `--color-text-muted`) | **2,41:1** | **3,29:1** | 4,5:1 |
| `.position-search-progress-label` (12-14 px, mismo color) | **2,41:1** | **3,29:1** | 4,5:1 |
| `.position-search-title` (21-32 px, `--color-text`) | 7,71:1 | 10,56:1 | 3,0:1 (texto grande) — pasa |
| barra de progreso dorada | 4,35:1 | — | 3,0:1 (gráfico) — pasa |

Comprobado también en pantalla: se forzó el overlay con texto de ejemplo ("Analizadas 12 de 40 partidas · 3 posiciones encontradas") y la línea es ilegible en los tramos que caen sobre casillas claras.

**Corrección.** Poner una placa opaca detrás del contenido en vez de confiar en el velo.

```css
/* styles.css:1503 — .position-search-overlay: sacar el color de fondo del contenedor */
.position-search-overlay {
  /* ...resto igual... */
  background: rgba(10,12,18,0.55);
}

/* nuevo bloque, inmediatamente después */
.position-search-overlay > * {
  position: relative;
  z-index: 1;
}
.position-search-overlay::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(420px, 88%);
  height: auto;
  inset-block: 22%;
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-float);
}
```

Con `--color-surface` de fondo, `.position-search-meta` sube a **4,81:1**.

**Trabajo: chico** (unas 18 líneas de CSS, sin cambios de texto).

---

## 5. "Comenzar sesión" queda fuera de la pantalla en el paso 3, en un escritorio normal

**Severidad: alta**

**Dónde:** `index.html:132` (`#analyze-btn`), dentro de `.wizard-footer` (`styles.css:2224-2249`).

**Qué está mal.** El paso 3 acumula, en este orden: pregunta, tres fichas de cantidad, campo numérico, etiqueta de tiempo, tres fichas de tiempo, otro campo numérico, caja de resumen, línea de estado, línea de métricas y recién ahí el pie con el botón. En una ventana de 1280×720 el botón que arranca toda la sesión queda **a 800 px del tope, con la ventana midiendo 720 px**: no se ve.

Y `goToWizardStep()` (`app.js:2469-2473`) hace `window.scrollTo({ top: 0 })` cada vez que se cambia de paso, así que el usuario llega al paso 3 mirando el encabezado, con la acción principal escondida abajo y sin ninguna señal de que hay que bajar.

**Evidencia.** Medición con la app real, sin forzar nada: se navegó del inicio al paso 3 escribiendo un usuario. `document.getElementById('analyze-btn').getBoundingClientRect().y` = **800**; `innerHeight` = **720**; `document.documentElement.scrollHeight` = 924.

**Corrección.** Fijar el pie del asistente al borde inferior del panel en pantallas altas, de modo que la acción principal esté siempre visible.

```css
/* styles.css:2224 — reemplazar .wizard-footer */
.wizard-footer {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  gap: 10px;
  align-items: center;
  margin: 0 calc(var(--space-5) * -1) calc(var(--space-5) * -1);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--color-border);
  border-radius: 0 0 var(--radius-2xl) var(--radius-2xl);
  background: var(--color-surface);
}
```

Además conviene sacar el bloque de resumen de la sesión de la columna principal y ponerlo al lado en escritorio, lo que recorta ~120 px de alto (ver *Propuestas de rediseño*, idea 1).

**Trabajo: chico** para el pie fijo; **mediano** si además se reordena el paso 3.

---

## 6. No hay ningún estilo propio de `:focus-visible`, y el del navegador desaparece sobre los botones dorados

**Severidad: alta**

**Dónde:** `styles.css` completo. `grep -n "focus-visible" styles.css` devuelve sólo tres coincidencias: la línea 752 (rota, ver hallazgo 1), la 2140 (que sólo cambia el color del texto de un enlace) y nada más. No existe una regla de foco para `button`.

**Qué está mal.** Los botones heredan el recuadro por omisión del navegador. En Chrome eso es `outline: auto 1px` con el color de acento del sistema — que en la máquina probada resultó naranja, `rgb(229,151,0)`. El problema es que los botones principales de la app ya tienen un borde dorado (`--color-gold-dim`) sobre fondo dorado oscuro: el recuadro naranja de 1 px cae justo encima de un borde del mismo tono y desaparece.

Quien navega con teclado no puede saber si está parado sobre "Comenzar", sobre el selector de idioma o en ningún lado.

**Evidencia.** Se hizo foco real con la tecla Tab (no por código) sobre `#landing-start-btn`: `matches(':focus-visible')` = `true`, `outline-style` = `"auto"`, `outline-color` = `"rgb(229, 151, 0)"`, `outline-width` = `"1px"`. Las capturas del botón con y sin foco son indistinguibles a simple vista.

**Corrección.** Una regla global, después de definir `--color-info` (hallazgo 1):

```css
/* styles.css, después del bloque button:disabled (línea ~566) */
:where(button, [href], input, select, summary):focus-visible {
  outline: 3px solid var(--color-info);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

(El tablero necesita su propio tratamiento, porque el fondo son casillas claras y oscuras; ver la corrección del hallazgo 1.)

`--color-info` sugerido (`oklch(80% 0.130 230)`, un celeste) da **11,03:1** contra `--color-bg` y no se confunde con el dorado de la marca ni con ninguno de los cuatro colores de veredicto.

**Trabajo: chico.**

---

## 7. En teléfono, la portada ocupa el 36 % de la pantalla y el texto se recorta a 18 caracteres de ancho

**Severidad: alta**

**Dónde:** `styles.css:966-967` (dentro de `@media (max-width: 920px)`) y `styles.css:1014-1027` (dentro de `@media (max-width: 480px)`). Selectores `.landing-title` y `.landing-description`, dentro de `#landing-screen`.

**Qué está mal.** Dos reglas recortan el texto por número de caracteres:

```css
.landing-title       { max-width: 12ch; font-size: 22px; }
.landing-description { max-width: 18ch; font-size: 13px; }
```

En un iPhone de 375 px de ancho, la descripción queda en una columna de **147 px** (el 39 % del ancho disponible) con letra de **13 px**, partida en **5 renglones**, mientras a los costados sobran 236 px vacíos. El título se parte en dos líneas cuando entra cómodo en una.

Como `.landing-screen` pierde su `min-height` en móvil (`styles.css:963`), toda la portada termina midiendo **294 px** de alto en una pantalla de **812 px**: el 36 %. Debajo quedan 438 px de fondo negro liso. La ilustración del maestro, que es la única pieza de identidad de la app, se ve recortada en una franja donde apenas se distingue una biblioteca.

Es la primera pantalla. Alguien que abre el link en el teléfono ve una tarjetita apretada arriba y medio celular vacío.

**Evidencia.** Medido en 375×812 tras recargar: `#landing-screen` → `y: 80, height: 294, bottom: 374`. `.landing-description` → `width: 147, height: 91, fontSize: "13px", maxWidth: "147.393px"`, 5 renglones. `document.documentElement.scrollHeight` = 812 (no hay nada más abajo). Captura adjunta al análisis.

**Corrección.** Quitar los recortes por caracteres, subir el cuerpo a 16 px y devolverle alto a la portada.

```css
/* styles.css:963-968 — reemplazar dentro de @media (max-width: 920px) */
.landing-screen { min-height: min(72vh, 620px); border-radius: 15px; }
.landing-content { width: 100%; padding: 32px 20px 28px; gap: 16px; }
.landing-title { max-width: 16ch; font-size: clamp(28px, 8vw, 40px); margin-bottom: 8px; }
.landing-description { font-size: 16px; max-width: 34ch; line-height: 1.45; }
.landing-btn-start { min-width: 0; width: min(280px, 92%); min-height: 58px; font-size: clamp(20px, 4vw, 24px); }

/* styles.css:1014-1027 — reemplazar dentro de @media (max-width: 480px) */
.landing-title { font-size: clamp(28px, 9vw, 36px); line-height: 1.05; }
.landing-description { max-width: 32ch; font-size: 16px; }
.landing-btn-start { width: min(100%, 280px); min-width: 0; min-height: 54px; font-size: 22px; }
```

No cambia ningún texto, así que no hace falta tocar `TRANSLATIONS`.

**Trabajo: chico.**

---

## 8. En modo individual y escritorio, el tablero queda pegado al borde derecho con 280 px de vacío al lado

**Severidad: media**

**Dónde:** `styles.css:1312-1316`, selector `body.solo-mode:not(.result-visible) .board-wrap` (propiedad `justify-self: end`), combinado con `styles.css:1295-1300` (`.board-stage-main` en dos columnas) y `styles.css:1460` (`.solo-clock-rail { justify-self: start }`).

**Qué está mal.** El escenario del tablero mide 929 px, pero el tablero se ancla al final de su columna y el riel del reloj al principio de la suya, así que todo el conjunto se empuja contra el borde derecho de la ventana. Queda una franja negra de **281 px** entre el panel del jugador y el tablero, y el rótulo "Posición 3 de 10" flota solo al extremo izquierdo de ese vacío, a casi 300 px del tablero que describe.

Además, el reloj queda pegado al borde derecho de la ventana en vez de junto al tablero, y el panel del jugador tiene `min-height: min(76vh, 860px)` (`styles.css:1085`) con el contenido apilado arriba: en 1280×720 son 692 px de tarjeta con unos 200 px de contenido y ~490 px de tarjeta vacía.

El resultado es una pantalla desbalanceada: todo el peso a la derecha, todo el vacío en el medio.

**Evidencia.** Medido en 1280×720 con la pantalla de juego forzada y el riel del reloj visible: `#board-stage` → `x: 331, w: 929`; `#board` → `x: 612, w: 576`; `#solo-clock-rail` → `x: 1202, w: 58`; `#left-player-panel` → `x: 20, w: 285, h: 692`. Vacío entre el panel y el tablero: 612 − 331 = 281 px.

**Corrección.** Centrar el conjunto tablero + reloj y dejar de estirar el panel a alto completo.

```css
/* styles.css:1295 — reemplazar */
body.solo-mode:not(.result-visible) .board-stage-main {
  grid-template-columns: auto auto;
  justify-content: center;          /* centra el par tablero+reloj */
  justify-items: center;
  align-items: center;
  gap: 14px;
}

/* styles.css:1312 — reemplazar */
body.solo-mode:not(.result-visible) .board-wrap {
  width: min(100%, 80vh, 1120px, calc(100vw - 90px));
  justify-self: center;
}

/* styles.css:1085 — .player-panel */
.player-panel {
  min-height: 0;                    /* era min(76vh, 860px) */
  align-content: start;
  /* ...resto igual... */
}
```

**Trabajo: chico.**

---

## 9. En duelo, el panel del jugador que descansa baja a 46 % de opacidad y su marcador queda por debajo del mínimo legible

**Severidad: media**

**Dónde:** `styles.css:1099`, selector `.player-panel.is-inactive`.

**Qué está mal.** La regla es `opacity: 0.46; filter: grayscale(0.2)`. Bajar la opacidad de un contenedor entero apaga también su fondo, así que el texto se atenúa contra un fondo que también se atenuó. Medido sobre el resultado compuesto:

| Elemento del panel inactivo | Contraste | Mínimo AA |
|---|---|---|
| Nombre del jugador (`.player-panel h2`, 17-22 px) | **3,99:1** | 4,5:1 |
| Valor del marcador (`.player-score-value`, 26-36 px) | **3,83:1** | 3,0:1 (texto grande) — pasa justo |
| Etiquetas "PUNTAJE" / "RELOJ" (10 px mayúsculas) | **1,93:1** | 4,5:1 |

El marcador del rival es justo el dato que el jugador activo quiere mirar mientras piensa. Atenuarlo a ese punto no comunica "es su turno", comunica "esta información está apagada".

Nota: por encima de 1080 px de ancho. En `styles.css:1839` la opacidad ya sube a 0.8 en pantallas más chicas, lo que confirma que el valor 0.46 se sabía problemático.

**Evidencia.** Composición: `--color-surface` (20,26,33) al 46 % sobre `--color-bg` (11,17,24) da (15,21,28); `--color-text` (229,232,236) al 46 % sobre ese fondo da (113,118,124) → 3,99:1. `--color-text-muted` (123,129,135) al 46 % da (65,68,71) → 1,93:1.

**Corrección.** No atenuar el contenedor: atenuar solamente el borde y el fondo, y marcar al jugador activo con una señal positiva.

```css
/* styles.css:1098-1099 — reemplazar ambas líneas */
.player-panel.is-active {
  opacity: 1;
  border-color: var(--color-gold-dim);
  box-shadow: var(--shadow-panel), 0 0 0 1px var(--color-gold-dim);
}
.player-panel.is-inactive {
  opacity: 1;
  background: var(--color-bg);
  border-color: var(--color-border);
}
.player-panel.is-inactive .player-avatar,
.player-panel.is-inactive .player-timer { opacity: 0.7; }
```

**Trabajo: chico.**

---

## 10. "Borrar datos guardados de partidas" es un blanco de 878×42 px invisible que borra sin preguntar

**Severidad: media**

**Dónde:** `styles.css:2126-2137` (`.wizard-text-btn`), `index.html:87` (`#wizard-clear-cache-btn`), manejador en `app.js:6363-6372`.

**Qué está mal.** Dos problemas que se combinan mal.

Primero, el tamaño real no coincide con lo que se ve. `.wizard-text-btn` declara `display: inline-block` y `align-self: flex-start`, pero el elemento es hijo de un contenedor `grid`, así que `align-self` no lo achica horizontalmente y la regla global `button { min-height: 42px }` (`styles.css:544`) gana sobre su `padding: 4px 0`. Resultado medido: el botón mide **878 px de ancho por 42 px de alto** en escritorio, aunque el subrayado que se ve abarca sólo el texto centrado de 11 px. Cualquier clic en esa franja de casi mil píxeles de ancho dispara el borrado.

Segundo, el manejador borra sin confirmar. `app.js:6364` llama directo a `clearAllRemotePgnCache()`.

Es decir: una acción destructiva, sin confirmación, con un área de clic diez veces más grande que su parte visible, colocada justo debajo del campo de usuario donde el dedo del usuario ya está.

**Evidencia.** `document.getElementById('wizard-clear-cache-btn').getBoundingClientRect()` → `{ width: 878, height: 42 }`; `getComputedStyle(...)` → `fontSize: "11px"`, `padding: "4px 0px"`, `minHeight: "42px"`. Lectura de `app.js:6363-6372`: no hay confirmación previa.

**Corrección.** Contener el botón a su texto y pedir confirmación en dos toques (sin usar `window.confirm`, ver hallazgo 11).

```css
/* styles.css:2126 — reemplazar .wizard-text-btn */
.wizard-text-btn {
  justify-self: center;
  width: auto;
  min-height: 32px;
  padding: 6px 10px;
  border: 0;
  background: none;
  font-size: var(--text-base);   /* 13px, era 11px */
  color: var(--color-text-muted);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
```

Y en `app.js:6364`, exigir un segundo toque:

```js
let clearArmed = false;
wizardClearCacheBtn.addEventListener("click", () => {
  if (!clearArmed) {
    clearArmed = true;
    wizardClearCacheBtn.textContent = t("wizard.step2.clearCacheConfirm");
    setTimeout(() => {
      clearArmed = false;
      wizardClearCacheBtn.textContent = t("wizard.step2.clearCache");
    }, 5000);
    return;
  }
  clearArmed = false;
  wizardClearCacheBtn.textContent = t("wizard.step2.clearCache");
  void clearAllRemotePgnCache().then(/* ...igual que hoy... */);
});
```

Texto nuevo, en los dos idiomas:

```js
// es
"wizard.step2.clearCacheConfirm": "Tocá de nuevo para borrar",
// en
"wizard.step2.clearCacheConfirm": "Tap again to delete",
```

**Trabajo: chico.**

---

## 11. "Volver al menú" usa el cuadro de diálogo del navegador, mientras el consentimiento usa un modal propio

**Severidad: media**

**Dónde:** `app.js:5445-5449` (`confirmRestartToSetup`), botones `#restart-btn` (`index.html:284`) y `#summary-menu-btn` (`index.html:247`).

**Qué está mal.** El código llama a `window.confirm(t("confirm.restartToSetup"))`. En cualquier navegador eso abre el diálogo nativo, que en móvil muestra el origen del sitio ("localhost:5010 dice…" o el dominio de GitHub Pages) y usa la tipografía del sistema. Rompe por completo la ambientación oscura y dorada de la app, y en iOS aparece anclado al tope de la pantalla.

Lo llamativo es que el proyecto ya migró el otro `window.confirm` (el de descarga remota) a un modal propio, y ese modal quedó bien diseñado. Quedó a mitad de camino: dos confirmaciones, dos estéticas.

**Evidencia.** `grep -n "window.confirm" app.js` devuelve exactamente dos líneas, 5447 y 5448, ambas dentro de `confirmRestartToSetup`. El texto existe ya traducido en `app.js:181` (es) y su par en inglés.

**Corrección.** Reutilizar `#consent-overlay` generalizándolo, o duplicar su marcado como `#confirm-overlay`. La forma más barata sin tocar mucho: extraer de `confirmRemoteFetchConsent` una función `showModal({ title, body, acceptLabel, cancelLabel })` que devuelva una promesa, y que `confirmRestartToSetup` pase a ser `async`.

Texto sugerido (reemplaza al actual, que dice "Se perderá el progreso" sin decir qué es el progreso):

```js
// es
"confirm.restartToSetup": "Si volvés al menú se borran las posiciones de esta sesión y el puntaje acumulado. ¿Volver igual?",
"confirm.restartAccept": "Volver al menú",
"confirm.restartCancel": "Seguir jugando",
// en
"confirm.restartToSetup": "Going back to the menu clears this session's positions and your running score. Go back anyway?",
"confirm.restartAccept": "Back to menu",
"confirm.restartCancel": "Keep playing",
```

**Trabajo: mediano.**

---

## 12. El tablero se anuncia como una tabla sin filas

**Severidad: media**

**Dónde:** `app.js:4020` (`boardEl.setAttribute("role", "grid")`) y `app.js:4033` (`square.setAttribute("role", "gridcell")`).

**Qué está mal.** El patrón `grid` de ARIA exige que las celdas estén dentro de elementos con `role="row"`. Acá las 64 casillas cuelgan directamente del contenedor. Los lectores de pantalla que implementan la navegación de tablas no encuentran filas y entregan una lectura degradada; los `aria-rowindex` y `aria-colindex` que se ponen en cada casilla (`app.js:4034-4035`) quedan sin el contexto que los hace útiles.

**Evidencia.** En el navegador: `document.querySelectorAll('#board [role=row]').length` → **0**; los primeros hijos directos de `#board` devuelven `role` = `"gridcell"`, `"gridcell"`, `"gridcell"`.

**Corrección.** Envolver cada rango en un contenedor de fila. En `buildBoard()`, dentro del `ranks.forEach`:

```js
ranks.forEach((rank, rowIndex) => {
  const row = document.createElement("div");
  row.className = "board-row";
  row.setAttribute("role", "row");
  row.setAttribute("aria-rowindex", String(rowIndex + 1));
  orderedFiles.forEach((fileLetter, colIndex) => {
    /* ...igual que hoy, pero row.appendChild(square) en vez de boardEl.appendChild(square) */
  });
  boardEl.appendChild(row);
});
```

y ajustar el CSS del tablero para que las filas no rompan la grilla:

```css
/* styles.css:725 — .board */
.board {
  display: grid;
  grid-template-columns: 1fr;      /* era repeat(8, 1fr) */
  grid-template-rows: repeat(8, 1fr);
}
.board-row {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  min-width: 0;
}
```

**Trabajo: mediano** (toca `buildBoard`, `renderBoard` y los selectores que hacen `boardEl.querySelectorAll(".square")`, que siguen funcionando porque son descendientes).

---

## 13. En el paso 3, las etiquetas están a la izquierda y sus campos flotan centrados a 279 px de distancia

**Severidad: media**

**Dónde:** `styles.css:2091-2104`, selector `.wizard-inline-form input, #wizard-step-2 input, #wizard-step-3 input`. Campos `#session-size` e `#turn-time-seconds` (`index.html:99` y `108`).

**Qué está mal.** La regla es `max-width: 320px; margin: 0 auto; text-align: center`. Las etiquetas, en cambio, son bloques de ancho completo alineados a la izquierda. En escritorio la etiqueta "Personalizado (1 a 200)" arranca en x = 201 y ocupa 878 px, mientras su campo es una cajita de 320 px que arranca en x = 480. Hay **279 px** entre el inicio de la etiqueta y el inicio del campo que describe. Visualmente no se leen como pareja.

Además, el `text-align: center` hace que el "10" del campo se vea como una ficha más y no como algo que se puede escribir. Y el campo de tiempo tiene otro problema: su etiqueta `<label for="turn-time-seconds">Tiempo por ronda</label>` está **60 px más arriba, con toda la fila de fichas 90s/180s/360s en el medio**, así que la etiqueta parece rotular las fichas y no el campo. El campo dice "90" mientras las fichas dicen "90s": la unidad desaparece justo donde hace falta.

**Evidencia.** Medido en 1280×720 en el paso 3 alcanzado por navegación normal:
- `label[for="session-size"]` → `x: 201, width: 878`; `#session-size` → `x: 480, width: 320, textAlign: "center"`.
- `label[for="turn-time-seconds"]` → `y: 402`; `#turn-time-seconds` → `y: 477`. Separación: 60 px, con el grupo de fichas intercalado.

**Corrección.** Alinear el campo con su etiqueta, sacar el centrado del texto y dar al campo numérico de tiempo su propia etiqueta.

```css
/* styles.css:2091 — reemplazar el bloque */
.wizard-inline-form input,
#wizard-step-2 input,
#wizard-step-3 input {
  min-height: 44px;
  font-size: var(--text-md);
  border-radius: var(--radius-md);
  background: var(--color-surface-3);
  color: var(--color-text);
  padding: 8px 12px;
  max-width: 200px;
  width: 100%;
  margin: 0;              /* era 0 auto */
  text-align: left;       /* era center */
}
```

Y en `index.html:101-109`, convertir la etiqueta del grupo en un rótulo y darle etiqueta propia al campo:

```html
<div class="wizard-step-group">
  <p class="wizard-group-label" data-i18n="wizard.step3.timerLabel">Tiempo por ronda</p>
  <div class="wizard-size-grid wizard-timer-grid" role="group"
       data-i18n-aria-label="wizard.step3.timerAriaLabel" aria-label="Tiempo por ronda">
    ...
  </div>
  <label for="turn-time-seconds" data-i18n="wizard.step3.timerCustom">Personalizado (5 a 360 segundos)</label>
  <input id="turn-time-seconds" type="number" min="5" max="360" value="90" />
</div>
```

Texto nuevo:

```js
// es
"wizard.step3.timerCustom": "Personalizado (5 a 360 segundos)",
// en
"wizard.step3.timerCustom": "Custom (5 to 360 seconds)",
```

**Trabajo: chico.**

---

## 14. Cambiar de paso en el asistente no se anuncia ni mueve el foco

**Severidad: media**

**Dónde:** `app.js:2469-2473` (`goToWizardStep`), `index.html:37` (`#wizard-step-indicator`).

**Qué está mal.** Al pulsar "Siguiente", el paso se reemplaza en el DOM y la página vuelve arriba, pero:

- `#wizard-step-indicator` (el "Paso 1 de 3") es un `<p>` sin `aria-live`, así que su cambio no se anuncia.
- El foco se queda en el botón "Siguiente", que ahora pertenece a otro contexto. Quien usa lector de pantalla oye "Siguiente, botón" y nada más: no sabe que la pregunta cambió.
- El nuevo paso no recibe foco ni tiene `tabindex="-1"` para poder recibirlo.

Es el momento central del asistente. El feedback existe para quien ve la pantalla (la barra de progreso se anima) y no existe para nadie más.

**Evidencia.** Lectura de `goToWizardStep`: son cuatro líneas, `clamp` + `renderWizardStep()` + `window.scrollTo()`. `grep -n "aria-live" index.html` no incluye `#wizard-step-indicator`.

**Corrección.** En `index.html:37`:

```html
<p id="wizard-step-indicator" class="wizard-step-indicator" role="status" aria-live="polite">Paso 1 de 3</p>
```

y en `app.js:2469`:

```js
function goToWizardStep(step) {
  STATE.setupWizard.step = clamp(Number(step) || 1, 1, 3);
  renderWizardStep();
  window.scrollTo({ top: 0, behavior: "auto" });
  const heading = document.getElementById(`wizard-step-${STATE.setupWizard.step}-title`);
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
}
```

**Trabajo: chico.**

---

## 15. El panel de resultado apila seis botones iguales, se desborda y entierra la acción principal

**Severidad: media**

**Dónde:** `styles.css:1757-1790` (`.result-overlay-actions`) y `styles.css:1578-1590` (`.result-overlay-panel`, `max-height: min(72vh, 860px); overflow: auto`). Marcado en `index.html:241-248`.

**Qué está mal.** Al terminar una ronda pueden estar visibles a la vez: "Ver la mejor", "Ver la partida", "Explorar tablero", "Reiniciar análisis", "Siguiente posición" y "Volver al menú". Los seis son bloques de ancho completo, apilados, del mismo tamaño y con la misma forma. No hay agrupación entre "cosas para mirar el análisis" y "cosas para avanzar".

Y la que importa —"Siguiente posición"— está en la quinta posición. En una ventana de 1280×720 con contenido mínimo el panel ya se desborda **29 px**, así que el último botón queda cortado dentro de un contenedor con `overflow: auto` que no tiene ninguna pista visual de que se puede desplazar. Con el árbol de jugadas real y el resumen de sesión, el desborde será bastante mayor.

**Evidencia.** Panel forzado con dos tarjetas de resultado de ejemplo, sin árbol de jugadas ni resumen: `.result-overlay-panel` → `scrollHeight: 545`, `clientHeight: 516` (desborde de 29 px). Posiciones de los botones: "Siguiente posición" en `y: 535`, "Volver al menú" en `y: 593`, con el panel terminando en `y: 627` y la ventana en 720. En 375×812 el mismo contenido pone "Siguiente posición" en `y: 779`, con la ventana en 812: apenas entra, y "Volver al menú" queda fuera.

**Corrección.** Separar en dos grupos, poner la acción principal arriba de las secundarias y anclarla al pie del panel.

```html
<!-- index.html:241-248 -->
<div class="result-overlay-actions">
  <div class="result-actions-secondary">
    <button id="reveal-best-btn" type="button" class="wizard-secondary-btn hidden" data-i18n="buttons.revealBest">Ver la mejor</button>
    <button id="reveal-game-btn" type="button" class="wizard-secondary-btn hidden" data-i18n="buttons.revealGame">Ver la partida</button>
    <button id="result-analysis-btn" type="button" class="wizard-secondary-btn" data-i18n="buttons.exploreBoard">Explorar tablero</button>
    <button id="result-analysis-reset-btn" type="button" class="wizard-secondary-btn hidden" data-i18n="buttons.resetAnalysis">Reiniciar análisis</button>
  </div>
  <div class="result-actions-primary">
    <button id="next-btn" disabled data-i18n="buttons.nextPosition">Siguiente posición</button>
    <button id="summary-menu-btn" type="button" class="hidden" data-i18n="buttons.backToMenu">Volver al menú</button>
  </div>
</div>
```

```css
/* styles.css:1757 — reemplazar .result-overlay-actions */
.result-overlay-actions { display: grid; gap: var(--space-3); }

.result-actions-secondary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}
.result-actions-secondary button { min-height: 36px; font-size: var(--text-base); }

.result-actions-primary {
  position: sticky;
  bottom: calc(clamp(12px, 1.6vw, 20px) * -1);
  display: grid;
  gap: 8px;
  padding: var(--space-2) 0;
  background: linear-gradient(180deg, transparent 0%, var(--color-surface) 22%);
}
```

Con las cuatro secundarias en dos columnas de 36 px de alto se recuperan ~120 px, y la principal deja de irse de pantalla.

**Trabajo: mediano.**

---

## 16. "Explorar tablero" y "Reiniciar análisis" se ven deshabilitados aunque funcionan

**Severidad: media**

**Dónde:** `styles.css:1769-1774`, selectores `.result-overlay-actions #result-analysis-btn` y `#result-analysis-reset-btn`.

**Qué está mal.** Esos dos botones usan `color: var(--color-text-muted)` mientras "Ver la mejor" y "Ver la partida", que están al lado y tienen exactamente la misma forma y el mismo fondo, usan `--color-text`. La diferencia de tono no comunica ninguna jerarquía: comunica "esto está apagado". En la captura de móvil los dos se leen como deshabilitados junto a dos botones idénticos que sí se ven activos.

Además "Explorar tablero" es probablemente la función más valiosa del panel de resultado —es donde el usuario entiende por qué su jugada estuvo mal— y es la que menos parece pulsable.

**Evidencia.** `--color-text-muted` sobre `--color-surface-2` = 4,45:1; `--color-text` sobre el mismo fondo = 14,2:1. Comprobado visualmente en el panel forzado, en 1280×720 y en 375×812: los cuatro botones son idénticos salvo el tono del texto, y los dos apagados se confunden con `#skip-btn` deshabilitado que está a la vista en el panel izquierdo.

**Corrección.**

```css
/* styles.css:1769 — reemplazar */
.result-overlay-actions #result-analysis-btn,
.result-overlay-actions #result-analysis-reset-btn {
  border-color: var(--color-border-mid);
  background: var(--color-surface-2);
  color: var(--color-text);
}
```

Si se quiere marcar que son secundarios, hacerlo con el peso tipográfico o con el alto (36 px frente a 42 px, como propone el hallazgo 15), no con el color del texto.

**Trabajo: chico.**

---

## 17. No hay respeto por "reducir movimiento" y no se declara el esquema de color

**Severidad: media**

**Dónde:** `styles.css` completo (`grep -n "prefers-reduced-motion"` → 0 coincidencias; `grep -n "color-scheme"` → 0 coincidencias). Animaciones concretas en `styles.css:1598-1604` (`verdictEntrance`, escala + opacidad), `styles.css:940-943` (`stepFade`), `styles.css:2347` (`transition: top 0.4s` en los nodos del árbol de jugadas) y decenas de transiciones más.

**Qué está mal.** Dos cosas distintas que se arreglan en el mismo lugar.

*Movimiento.* La cabecera del resultado entra escalando desde 0.92 con `--ease-spring` (una curva con rebote), los nodos del árbol se desplazan 400 ms cada vez que cambian, y cada paso del asistente hace un fundido con desplazamiento. Quien tiene activado "Reducir movimiento" en su sistema —una preferencia frecuente entre personas con vértigo o sensibilidad vestibular— no recibe nada distinto.

*Esquema de color.* `getComputedStyle(document.documentElement).colorScheme` devuelve `"normal"`. Como la app pinta todo oscuro pero no se lo declara al navegador, los controles que dibuja el sistema quedan claros: las flechitas de los campos `type="number"` del paso 3, la barra de desplazamiento del panel de resultado (`.result-overlay-panel { overflow: auto }`), el resaltado de selección de texto y el cuadro de `window.confirm`. En Windows la barra de desplazamiento del panel de resultado aparece gris claro sobre el panel oscuro.

**Evidencia.** Medido en el navegador: `colorScheme: "normal"`. Búsquedas en `styles.css` confirmadas arriba.

**Corrección.** Dos bloques, ambos al inicio del archivo:

```css
/* styles.css, dentro de :root (línea ~8) */
color-scheme: dark;
```

```css
/* styles.css, al final del archivo */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Conviene además agregar en `index.html:9`, junto a las otras metaetiquetas: `<meta name="theme-color" content="#0b1118" />`.

**Trabajo: chico.**

---

## 18. Los bordes son tan tenues que las tarjetas y los botones no tienen un límite perceptible

**Severidad: media**

**Dónde:** `styles.css:13-14`, tokens `--color-border` y `--color-border-mid`. Usados como único límite en `.wizard-choice-card` (`styles.css:2046`), `button` (`styles.css:542`), `.player-score`, `.player-timer`, `.result-card`, `input`, y prácticamente todo componente del sistema.

**Qué está mal.** WCAG 1.4.11 pide 3:1 entre el borde de un control y lo que lo rodea, cuando ese borde es lo que define al control. Medido:

| Par | Contraste | Mínimo |
|---|---|---|
| `--color-border` sobre `--color-bg` | **1,47:1** | 3,0:1 |
| `--color-border-mid` sobre `--color-bg` | **2,01:1** | 3,0:1 |
| `--color-border` sobre `--color-surface` | 1,39:1 | 3,0:1 |
| `--color-border` sobre `--color-surface-2` | 1,28:1 | 3,0:1 |
| `--color-border-mid` sobre `--color-surface-2` | 1,75:1 | 3,0:1 |

Y el fondo tampoco ayuda: `--color-surface-2` (el relleno de las tarjetas y los botones) contra `--color-bg` da **1,15:1**, y `--color-surface` contra `--color-bg` da **1,06:1**. O sea que una tarjeta no seleccionada del asistente se distingue del panel por menos de 1,3:1 tanto en el relleno como en el borde. En la captura del paso 1 en móvil, la tarjeta "Jugar contra alguien" y el botón "Volver al inicio" son manchas apenas más claras que el fondo; sólo la tarjeta seleccionada (dorada) tiene forma reconocible.

Con brillo bajo, con sol de frente o con visión reducida, el usuario no ve dónde termina un botón y empieza el fondo.

**Evidencia.** Contrastes calculados sobre los valores computados en sRGB, tabla de arriba. Verificado visualmente en las capturas de 375×812 (paso 1 y paso 2 del asistente).

**Corrección.** Subir los dos tokens de borde. El cambio se propaga solo, porque todo el CSS los usa.

```css
/* styles.css:13-14 — reemplazar */
--color-border:      oklch(52%   0.016 255);   /* era 30% */
--color-border-mid:  oklch(60%   0.016 255);   /* era 38% */
```

Con esos valores, medidos:

| Par | Antes | Después |
|---|---|---|
| `--color-border` sobre `--color-bg` | 1,47:1 | **3,67:1** |
| `--color-border` sobre `--color-surface` | 1,39:1 | **3,46:1** |
| `--color-border` sobre `--color-surface-2` | 1,28:1 | **3,20:1** |
| `--color-border-mid` sobre `--color-bg` | 2,01:1 | **5,10:1** |

Es un salto grande y va a cambiar bastante el aspecto: hoy todo se ve como bloques flotando sin contorno, y después se verá como una interfaz con marcos. Si eso resulta demasiado duro en las superficies grandes, la alternativa es partir el token.

Si el resultado se ve demasiado marcado en las superficies grandes, dejar los paneles con el token viejo bajo un alias nuevo (`--color-border-soft`) y reservar los valores subidos para controles: botones, campos y tarjetas seleccionables.

**Trabajo: chico** para el cambio de tokens; **mediano** si se separan bordes de panel y bordes de control.

---

## 19. En modo individual el reloj es el número más chico de la pantalla y está en el borde derecho

**Severidad: media**

**Dónde:** `styles.css:1456-1500` (`.solo-clock-rail`, `.solo-clock-value`, `.solo-clock-track`) y `styles.css:1860` (`.solo-clock-value { font-size: 12px }` por debajo de 1080 px).

**Qué está mal.** El reloj de la ronda se muestra en un riel vertical de 58 px pegado al borde derecho de la ventana, con el número en **13 px** de tipografía monoespaciada (12 px por debajo de 1080 px de ancho) y una barra vertical de 12×170 px que se vacía de arriba hacia abajo.

Comparado con lo que hay alrededor en la misma pantalla: el marcador (`.player-score-value` en modo individual) va a ~24 px, el rótulo de la posición (`.round-status`) a ~24 px, y en modo duelo el mismo reloj se muestra a ~19 px (`styles.css:1206`). O sea: el dato que se está agotando en tiempo real es el más chico de todos, en la periferia de la vista, y el jugador está mirando el centro del tablero.

Encima, una barra que se vacía verticalmente es un patrón poco convencional; la lectura instantánea de "cuánto queda" es peor que en una barra horizontal, que ya se usa en el resto de la app (`.player-timer-bar`, `.progress-bar`, `.wizard-progress-bar`).

**Evidencia.** Medido en 1280×720 con la pantalla de juego forzada y el riel visible: `#solo-clock-rail` → `x: 1202, y: 275, w: 58, h: 211`, con `#board` terminando en x = 1188 y la ventana en 1280. `.solo-clock-value` computado: `font-size: 13px`. Comparativa de tamaños leída del CSS en las líneas 1158, 1166, 1206 y 1266.

**Corrección.** Convertir el riel en una barra horizontal debajo del tablero, con el número grande, y unificar el patrón con el temporizador del duelo.

```css
/* styles.css:1456 — reemplazar .solo-clock-rail y sus hijos */
.solo-clock-rail {
  display: none;
  width: 100%;
  max-width: min(100%, 80vh, 1120px);
  padding: 8px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-2);
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}
.solo-clock-value {
  font-family: var(--font-mono);
  font-size: clamp(20px, 2vw, 28px);   /* era 13px */
  line-height: 1;
  color: var(--color-text);
  font-weight: 500;
}
.solo-clock-track {
  position: relative;
  width: 100%; height: 10px;           /* era 12 × 170 vertical */
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface-3);
  overflow: hidden;
}
.solo-clock-bar {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: var(--clock-ratio, 100%);
  height: 100%;
  background: var(--color-gold);
  transition: width 100ms linear, background var(--dur-base) ease;
}
```

Con esto se pueden borrar los bloques de excepción de `styles.css:1859-1861` y `styles.css:1902-1922`, porque el riel ya nace horizontal.

Y en `styles.css:1295`, el escenario del tablero vuelve a una sola columna: `grid-template-columns: minmax(0, 1fr)`.

**Trabajo: mediano.**

---

## 20. El texto de ejemplo del campo de usuario tiene 3,26:1 y el campo pelea con el teclado del teléfono

**Severidad: media**

**Dónde:** `index.html:79` (`#online-user-input`), y la ausencia de una regla `::placeholder` en `styles.css`.

**Qué está mal.** Dos cosas en el mismo campo, que es el único dato que la app le pide al usuario.

*Contraste.* No hay ninguna regla `::placeholder` en todo el CSS, así que el navegador usa su color por omisión, `rgb(117,117,117)`. Sobre `--color-surface-3` (34,39,45) eso da **3,26:1**, por debajo del 4,5:1 de AA. El texto "Ej: MagnusCarlsen", que es la única pista de qué formato se espera, es el más difícil de leer del paso.

*Teclado móvil.* El campo es `<input type="text" autocomplete="off">` y nada más. En un teléfono, el teclado va a poner mayúscula inicial automáticamente, va a ofrecer autocorrección y va a subrayar el nombre como error ortográfico. Un usuario de Chess.com llamado `elpepe_82` verá `Elpepe_82` propuesto y probablemente no note el cambio.

**Evidencia.** `getComputedStyle(input, '::placeholder').color` → `"rgb(117, 117, 117)"`, `fontSize: "14px"`; fondo computado `oklch(0.27 0.014 255)` → (34,39,45); relación 3,26:1. Atributos del campo leídos en el DOM: exactamente `id`, `type`, `placeholder`, `autocomplete`.

**Corrección.**

```css
/* styles.css, después del bloque input:focus (línea ~461) */
input::placeholder {
  color: var(--color-text-muted);   /* 3,82:1 sobre --color-surface-3 */
  opacity: 1;                        /* Firefox aplica 0.54 por omisión */
}
```

Y para llegar cómodo a 4,5:1, aclarar el fondo del campo del asistente en `styles.css:2097`: `background: var(--color-surface-2)` en vez de `--color-surface-3`, lo que lleva el texto de ejemplo a 4,45:1.

En `index.html:79`:

```html
<input id="online-user-input" type="text" placeholder="Ej: MagnusCarlsen"
       autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"
       inputmode="text" aria-describedby="online-status" />
```

**Trabajo: chico.**

---

## 21. En teléfono, "Volver al inicio" es el botón más grande del pie del asistente

**Severidad: media**

**Dónde:** `styles.css:2284-2295`, dentro de `@media (max-width: 920px)`. Botones `#source-back-btn`, `#wizard-prev-btn`, `#wizard-next-btn` (`index.html:129-132`).

**Qué está mal.** La regla es `.wizard-footer { grid-template-columns: 1fr 1fr }` con `#source-back-btn { grid-column: 1 / -1 }`. Traducido: la salida del asistente ocupa una fila entera a ancho completo, **arriba** de "Anterior" y "Siguiente", que se reparten la fila de abajo.

En el paso 1 el efecto es peor: como "Anterior" está oculto, el pie muestra "Volver al inicio" a ancho completo y debajo "Siguiente" a ancho completo, apilados justo debajo de las dos tarjetas de modo, que también son bloques del mismo ancho. Quedan cuatro rectángulos idénticos en fila y "Volver al inicio" se lee como una tercera opción de juego.

La jerarquía está invertida: la acción que abandona el flujo es la más prominente del pie; la que avanza está debajo y comparte el espacio.

**Evidencia.** Captura en 375×812 del paso 1: cuatro bloques apilados de ancho completo, en el orden "Jugar solo/a", "Jugar contra alguien", "Volver al inicio", "Siguiente". Captura del paso 2: "Volver al inicio" a ancho completo, y debajo "Anterior | Siguiente" al 50 % cada uno. Reglas confirmadas en `styles.css:2284-2295`.

**Corrección.** Dejar "Volver al inicio" como texto discreto y darle la fila principal a la navegación.

```css
/* styles.css:2284-2295 — reemplazar */
.wizard-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.wizard-footer #source-back-btn {
  grid-column: 1 / -1;
  order: 2;                       /* después de la navegación, no antes */
  min-height: 36px;
  border-color: transparent;
  background: transparent;
  color: var(--color-text-muted);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.wizard-footer #wizard-prev-btn.hidden + #wizard-next-btn { grid-column: 1 / -1; }
.wizard-footer #wizard-next-btn,
.wizard-footer #analyze-btn { margin-left: 0; order: 1; }
.wizard-footer #wizard-prev-btn { order: 1; }
.wizard-footer #source-back-btn,
.wizard-footer #wizard-prev-btn,
.wizard-footer #wizard-next-btn,
.wizard-footer #analyze-btn { min-width: 0; width: 100%; }
```

**Trabajo: chico.**

---

## 22. El panel del asistente es una caja con 226 px vacíos y doble marco

**Severidad: baja**

**Dónde:** `styles.css:396-409` (`#setup-panel`, con `min-height: min(72vh, 780px)` y `align-content: start`) y `styles.css:1929-1940` (`.setup-wizard`, con su propio `border` y `background`).

**Qué está mal.** Dos marcos redondeados anidados, separados por 17 px, con fondos casi idénticos (`--color-bg` afuera, `--color-surface` adentro, 1,40:1 entre sí). No aportan jerarquía; parecen un descuido de composición.

Y el marco de afuera se estira a `min(72vh, 780px)` con el contenido pegado arriba. En el paso 1 —el más corto— quedan **226 px** de caja vacía debajo del pie del asistente.

Sólo ocurre por encima de 920 px de ancho: en `styles.css:960` el `min-height` ya se anula para móvil.

**Evidencia.** Medido en 1280×720 en el paso 1, alcanzado por navegación normal: `#setup-panel` → `y: 86, height: 518`; `#setup-wizard` → `y: 103, height: 275`. Espacio muerto debajo del contenido: 226 px.

**Corrección.** Quedarse con un solo marco (el interior, que es el que tiene la sombra y el fondo) y dejar que el alto lo determine el contenido.

```css
/* styles.css:396-409 — dentro de #setup-panel */
#setup-panel {
  position: relative;
  min-height: 0;                 /* era min(72vh, 780px) */
  display: grid;
  align-content: center;         /* era start */
  justify-items: center;
  gap: var(--space-4);
  padding: var(--space-6) var(--space-4);
  background: transparent;       /* era var(--color-bg) */
  border: 0;                     /* el marco lo pone .setup-wizard */
  box-shadow: none;
  min-width: 0;
}
```

**Trabajo: chico.**

---

## 23. Las etiquetas del árbol de jugadas usan 10 px con 1,9:1 de contraste

**Severidad: baja**

**Dónde:** `styles.css:2483-2489` (`.node-authors`, `--text-xs` = 10 px con `--color-text-dim`) y `styles.css:2403-2410` (`.node-label`, también `--text-xs` = 10 px).

**Qué está mal.** `.node-authors` combina el tamaño de fuente más chico del sistema (10 px), mayúsculas, `letter-spacing` y el color más apagado de la paleta. Sobre `--color-surface-2` da **1,90:1**. Es el texto que dice de quién es cada jugada dentro del árbol de comparación: sin eso, los nodos coloreados no se pueden atribuir.

`.node-label` está mejor de contraste (usa los colores de veredicto, entre 3,93:1 y 6,66:1) pero sigue en 10 px con mayúsculas y espaciado, lo que en la práctica lo vuelve difícil de leer en teléfono.

**Evidencia.** `--color-text-dim` (67,72,78) sobre `--color-surface-2` (20,26,33) = 1,90:1. Tamaños leídos del token `--text-xs: 10px` en `styles.css:52`. Nota: este hallazgo sale de leer el CSS, no de ver el árbol con datos reales, porque no se pudo completar una ronda.

**Corrección.**

```css
/* styles.css:2483 — reemplazar .node-authors */
.node-authors {
  font-size: var(--text-sm);          /* 11px, era 10px */
  color: var(--color-text-muted);     /* 4,45:1, era 1,90:1 */
  font-weight: 600;
  text-transform: none;               /* las mayúsculas no aportan a esta altura */
  letter-spacing: 0.02em;
}

/* styles.css:2403 — .node-label */
.node-label {
  font-family: var(--font-mono);
  font-size: var(--text-sm);          /* 11px */
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.2;
}
```

Y para el color de error, que es el único veredicto por debajo de AA (`--color-blunder` sobre `--color-blunder-bg` = **3,93:1**), aclararlo un punto:

```css
/* styles.css:34 */
--color-blunder:     oklch(64% 0.190 22);   /* era 58% 0.210 → sube de 3,93:1 a 5,10:1 */
```

**Trabajo: chico.**

---

## 24. La barra de progreso de la sesión individual se dibuja con estilos en línea y no dice nada

**Severidad: baja**

**Dónde:** `app.js:1913-1920` (`renderProgressPips`), pintada en `#solo-progress-line` (`index.html:173`). Función muerta `soloProgressText()` en `app.js:1922-1924`.

**Qué está mal.** Tres cosas.

*Los estilos están en línea.* La función arma cada marca con `style="display:inline-block;height:5px;width:20px;border-radius:999px;background:var(--color-gold);..."`. El proyecto hizo un trabajo deliberado de mover todo a tokens (lo dice el encabezado de `styles.css`); esto se saltea el sistema y además impide ajustarlo por media query.

*No tiene nombre accesible.* El contenedor sólo lleva `title="Posiciones evaluadas"` (`index.html:173`). Un `title` en un `<p>` no produce un nombre accesible confiable, y adentro hay N `<span>` vacíos: un lector de pantalla no obtiene ningún valor.

*Escala mal.* `#session-size` admite hasta 200. Con 200 posiciones se generan 200 marcas de 10 a 20 px más 4 px de separación dentro de un panel de 245 px de ancho: más de una docena de renglones de guiones.

**Evidencia.** Lectura de `app.js:1913-1920`. `grep -n "soloProgressText" app.js` devuelve una sola línea (su propia definición): nunca se llama, así que la versión en texto del progreso está escrita y desconectada. `body.solo-mode #session-progress { display: none }` en `styles.css:1278` confirma que la línea numérica también se oculta en modo individual.

**Corrección.** Reemplazar las marcas por una barra proporcional con texto, usando las clases que ya existen.

```js
// app.js:1913 — reemplazar renderProgressPips
function renderProgressPips(played, total) {
  const pct = total > 0 ? Math.round((played / total) * 100) : 0;
  return `<span class="solo-progress-text">${soloProgressText()}</span>
    <span class="solo-progress-track" role="progressbar"
          aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${played}"
          aria-label="${t("labels.positionsEvaluatedTitle")}">
      <span class="solo-progress-fill" style="width:${pct}%"></span>
    </span>`;
}
```

```css
/* styles.css:1171 — reemplazar .solo-progress-line */
.solo-progress-line { display: grid; gap: 6px; margin: -6px 0 0; }
.solo-progress-text { font-size: var(--text-base); color: var(--color-text-muted); }
.solo-progress-track {
  height: 6px; border-radius: var(--radius-pill);
  background: var(--color-surface-3); overflow: hidden;
}
.solo-progress-fill { display: block; height: 100%; background: var(--color-gold); }
```

`soloProgressText()` deja de estar muerta y devuelve "Posiciones evaluadas: 3 / 10" / "Positions played: 3 / 10", que ya existen traducidas (`labels.positionsEvaluatedTitle`).

**Trabajo: chico.**

---

## 25. El mismo modo tiene tres nombres, "Blunder" quedó en inglés dentro del castellano, y el aviso de privacidad habla de "backend"

**Severidad: baja**

**Dónde:** `app.js:159-300` (diccionario `es`) y `app.js:490-620` (diccionario `en`); `index.html:141`.

**Qué está mal.** Varios problemas de redacción, agrupados porque se arreglan en el mismo archivo.

*El modo individual tiene tres nombres.* El asistente lo llama "Jugar solo/a" (`wizard.step1.solo`), la pantalla de juego lo llama "Modo estudio (solo/a)" (`game.studyMode`, `app.js:347`) y el selector heredado lo llama "Modo Estudio (1 jugador)" (`compat.gameFormat.solo`). Lo mismo con el duelo: "Jugar contra alguien" frente a "Duelo de Caballeros (2 jugadores)". El usuario elige una cosa y después ve otra palabra en pantalla.

*"Blunder" en la lista castellana.* `quality.blunder` vale `"Blunder"` en los dos idiomas, mientras sus siete hermanas son "Perfecta", "Muy buena", "Buena", "Interesante (!?)", "Dudosa", "Mala". Es la única palabra en inglés de la escala, y es justo la del peor resultado, la que más se ve.

*"Interesante (!?)" mete notación de ajedrez en una etiqueta en lenguaje llano.* El resto de la escala no usa símbolos.

*"backend propio" en el aviso de privacidad.* `privacy.remoteFetchConfirm` dice "esta app no usa backend propio". Es exactamente el punto donde el usuario decide si su nombre de usuario sale hacia un servicio externo, y la explicación usa una palabra que sólo entiende alguien que programa.

*Frase con "partidas" repetida.* `wizard.step2.howItWorksBody` empieza "El sistema obtiene tus partidas recientes de partidas a ritmo Lento (Clásico/Rápido)". Y "El sistema" es impersonal justo después de dos frases que dicen "Vamos a…".

*`Lichess.com` en el selector oculto.* `index.html:141` dice `<option value="lichess" selected>Lichess.com</option>`. El sitio es lichess.org. Está en el bloque de compatibilidad oculto, así que no se ve, pero es texto de interfaz con un dato mal.

**Evidencia.** Comparación de los dos diccionarios con un script: 265 claves en cada idioma, sin faltantes, pero nueve cadenas idénticas entre `es` y `en`, entre ellas `quality.blunder = "Blunder"` y `evaluation.delta = "Delta"`. Resto verificado leyendo `app.js:159-300` e `index.html:136-143`.

**Corrección.** En `TRANSLATIONS`:

```js
// es
"quality.blunder": "Error grave",
"quality.interesting": "Interesante",
"compat.gameFormat.solo": "Modo estudio (1 jugador)",
"compat.gameFormat.duel": "Modo duelo (2 jugadores)",
"game.studyMode": "Modo estudio",
"wizard.step2.howItWorksBody": "Buscamos tus partidas recientes de ritmo lento (clásico y rápido). Si no alcanzan, sumamos partidas de blitz. Descargamos sólo hasta juntar las posiciones que pediste.",
"privacy.remoteFetchConfirm": "Vamos a pedirle a {provider} las partidas públicas de {user}. El pedido sale desde tu navegador directamente hacia ese sitio: esta app no tiene servidor propio y no guarda tus datos en ningún lado. ¿Continuar?",

// en
"quality.blunder": "Serious mistake",
"quality.interesting": "Interesting",
"compat.gameFormat.solo": "Study mode (1 player)",
"compat.gameFormat.duel": "Duel mode (2 players)",
"game.studyMode": "Study mode",
"wizard.step2.howItWorksBody": "We look through your recent slow games (classical and rapid). If there aren't enough, we add blitz games. We only download as many as we need to build the positions you asked for.",
"privacy.remoteFetchConfirm": "We're going to ask {provider} for {user}'s public games. The request goes straight from your browser to that site: this app has no server of its own and stores nothing about you anywhere. Continue?",
```

Y en `index.html:141`: `<option value="lichess" selected>Lichess</option>`.

**Trabajo: chico.**

---

# Propuestas de rediseño

Cuatro ideas que cambian la experiencia, no que parchean un detalle. Van ordenadas de menor a mayor riesgo.

---

## A. Un solo lienzo para el asistente: pregunta arriba, resumen al costado, acción siempre a la vista

**Qué problema resuelve.** Los hallazgos 5, 13, 21 y 22 son síntomas del mismo diseño: el asistente es una columna única que crece hacia abajo dentro de una caja con alto fijo, con etiquetas y campos que no se alinean y con el botón principal al final del scroll. Hoy el paso 3 mide 924 px de alto y su botón queda fuera de una ventana de 720 px.

**Cómo se vería.** En escritorio, dos columnas dentro de un solo marco: a la izquierda la pregunta del paso y sus controles; a la derecha, fija, una tarjeta con el resumen de la sesión que se va llenando (modo, plataforma, usuario, posiciones, tiempo) y funciona como recordatorio de lo ya decidido. Debajo, un pie pegado al borde inferior del marco con "Anterior" y "Siguiente / Comenzar sesión" siempre visibles, y "Volver al inicio" como texto discreto a la izquierda. Cada campo con su etiqueta encima y alineado a la izquierda, no centrado. En móvil, una sola columna con el mismo pie fijo, y el resumen colapsado en un `<details>` al final.

**Qué archivos toca.** `styles.css` (bloque "SETUP WIZARD", líneas 1925-2296) e `index.html` (líneas 33-158, para mover `#wizard-summary-box` fuera del paso 3 y envolverlo en una columna). `app.js` sólo si se quiere que el resumen se actualice desde el paso 1 — hoy `renderWizardStep()` ya lo recalcula, así que probablemente alcance con quitarle el `hidden`.

**Riesgo.** Bajo-medio. `#wizard-summary-box` está dentro de `#wizard-step-3`, que se oculta entero al cambiar de paso; sacarlo de ahí exige revisar el código que lo pinta. La regla `body.landing-active #setup-panel { display: none }` (`styles.css:367`) y `body.playing-mode #setup-panel { display: none !important }` (`styles.css:1809`) siguen funcionando porque operan sobre el panel exterior. Hay que reprobar los tres pasos en 375, 768 y 1280 px.

---

## B. Barra de estado de la ronda: reloj, progreso y contexto en una sola tira encima del tablero

**Qué problema resuelve.** Los hallazgos 8, 19 y 24. Hoy la información de la ronda está esparcida en cuatro lugares que no se relacionan: el rótulo de posición flota solo arriba a la izquierda a 280 px del tablero, el reloj es un riel de 13 px pegado al borde derecho de la ventana, las marcas de progreso son guiones sin número dentro del panel izquierdo, y el dato de la partida original queda debajo del tablero. El jugador mira el centro del tablero y tiene que hacer cuatro saltos de ojo para saber en qué ronda está y cuánto tiempo le queda.

**Cómo se vería.** Una tira horizontal del ancho exacto del tablero, apoyada justo encima de él: a la izquierda "Posición 3 de 10" con una barra de progreso fina debajo; en el centro, de quién es el turno ("Juegan las negras" o el nombre del jugador en duelo); a la derecha, el reloj en tipografía monoespaciada grande (28 px) con su barra horizontal debajo, que cambia a ámbar y luego a rojo con los mismos umbrales que ya existen (`urgency-mid`, `urgency-high`). El tablero centrado debajo, sin nada a los costados. La ficha de la partida original, debajo del tablero, como está hoy.

Un solo componente sirve para modo individual y para duelo: en duelo la parte central muestra el nombre del jugador al turno y el reloj es el suyo; los dos paneles laterales quedan sólo para los marcadores.

**Qué archivos toca.** `index.html` (líneas 186-218: fusionar `.board-stage-status` y `#solo-clock-rail` en un único `.round-bar`), `styles.css` (líneas 1254-1330 y 1456-1500, más los bloques responsive 1813-1923) y `app.js` (los puntos que escriben `#solo-clock-value`, `#player-a-timer-value`, `#round-status` y `#solo-progress-line`, alrededor de las líneas 1950, 2113, 4351 y 4398).

**Riesgo.** Medio. Es el cambio estructural más grande de la lista. Hay lógica de urgencia del reloj repartida entre las clases `.solo-clock-rail.urgency-*` y `.player-timer.urgency-*`; unificarlas exige tocar el JS que las aplica. Los tres bloques de media query que hoy hacen malabares para volver horizontal el riel vertical (`styles.css:1859-1861`, `1902-1922`) desaparecen, lo que baja la complejidad neta. Reprobar duelo completo: turno 1, cambio de turno, turno 2, resumen.

---

## C. La pantalla de resultado como una lectura, no como una lista de botones

**Qué problema resuelve.** Los hallazgos 15 y 16. El panel de resultado es hoy un contenedor con `overflow: auto` que ya se desborda 29 px con contenido mínimo, con seis botones de ancho completo indistinguibles entre sí, con la acción principal en quinto lugar y dos botones que parecen deshabilitados. Y la parte que enseña —el árbol de jugadas comparado— compite por espacio con esa pila de botones.

**Cómo se vería.** El panel se lee de arriba abajo como una explicación: (1) el veredicto grande, con su color; (2) las dos jugadas enfrentadas, la tuya y la del motor, en tarjetas; (3) el porqué, que es donde hoy vive el árbol de jugadas, ahora con espacio; (4) al pie, pegada al borde inferior del panel, una única fila con la acción que hace avanzar. Las cuatro herramientas de exploración ("Ver la mejor", "Ver la partida", "Explorar tablero", "Reiniciar análisis") pasan a ser una fila de fichas chicas de 36 px justo debajo del tablero, donde su efecto ocurre — porque las cuatro modifican lo que se ve en el tablero, no lo que dice el panel. Eso las saca de la pila y las pone donde el usuario ya está mirando cuando las quiere usar.

**Qué archivos toca.** `index.html` (líneas 220-250), `styles.css` (líneas 1567-1790), `app.js` (los manejadores de `#reveal-best-btn`, `#reveal-game-btn`, `#result-analysis-btn` y `#result-analysis-reset-btn`, que sólo cambian de contenedor, no de comportamiento).

**Riesgo.** Bajo-medio. Los botones cambian de lugar en el DOM pero conservan sus `id`, así que el JS sigue encontrándolos. Lo que sí hay que revisar es `body.result-visible`, que controla el reacomodo del tablero (`styles.css:1290-1293`, `1316`, `1471`): si las fichas de exploración quedan fuera del panel, tienen que aparecer y desaparecer con la misma clase. Hay que verificar el modo duelo, donde el panel muestra además el resumen final.

---

## D. Un modo "sin reloj" y un modo "con reloj", elegidos explícitamente

**Qué problema resuelve.** Uno que no es un defecto visual sino de producto, y que se ve en la forma del paso 3. Hoy el asistente pregunta cuántas posiciones y cuánto tiempo por ronda como si fueran dos ajustes del mismo tipo, con el mismo componente (tres fichas más un campo numérico). Pero son decisiones de naturaleza distinta: la cantidad define el largo de la sesión; el reloj define si esto es entrenamiento de cálculo tranquilo o simulación de apuro. Y el reloj tiene consecuencias que el asistente no explica: cuando se agota, la ronda se resuelve sola. El valor por omisión, 90 segundos, es agresivo para alguien que recién empieza y está mirando una posición de media partida por primera vez.

**Cómo se vería.** El paso 3 pasa a preguntar dos cosas claramente distintas. Primero, "¿Cuántas posiciones?" con las tres fichas de siempre. Segundo, "¿Querés reloj?" con dos tarjetas del mismo tipo que las del paso 1: **"Sin apuro"** (sin reloj, la ronda dura lo que dure) y **"Contra reloj"**, y sólo si se elige la segunda aparecen las fichas de 90 / 180 / 360 segundos, igual que hoy aparecen los campos de nombres al elegir duelo (`#duel-config`, `index.html:53`). El patrón ya existe en el asistente, así que no se inventa nada nuevo.

Texto nuevo:

```js
// es
"wizard.step3.timerQuestion": "¿Querés jugar con reloj?",
"wizard.step3.timerOff": "Sin apuro",
"wizard.step3.timerOffHint": "Tomate el tiempo que necesites en cada posición",
"wizard.step3.timerOn": "Contra reloj",
"wizard.step3.timerOnHint": "Si se acaba el tiempo, la ronda se resuelve sola",
// en
"wizard.step3.timerQuestion": "Do you want a clock?",
"wizard.step3.timerOff": "No rush",
"wizard.step3.timerOffHint": "Take as long as you need on each position",
"wizard.step3.timerOn": "Against the clock",
"wizard.step3.timerOnHint": "When time runs out, the round resolves on its own",
```

**Qué archivos toca.** `index.html` (líneas 101-109), `TRANSLATIONS` en `app.js`, y la lógica de reloj: `normalizeTurnTimeSeconds`, el arranque del temporizador y el camino de "se acabó el tiempo" (que ya existe y ya muestra un mensaje explicativo, según el commit `7dc03ee`). En `styles.css` alcanza con reutilizar `.wizard-card-grid` y `.wizard-choice-card`.

**Riesgo.** Medio-alto, porque es el único de los cuatro que cambia el modelo de datos: hay que introducir un estado "sin reloj" que hoy no existe. El campo `#turn-time-seconds` tiene `min="5"`, así que 0 no es representable y habría que manejar el modo sin reloj como una bandera aparte, no como un valor. Todo el código que lee `STATE.setupWizard.turnTimeSeconds`, que pinta `#player-a-timer` / `#solo-clock-rail`, y que decide la urgencia, necesita un camino de "no hay reloj". En modo duelo, además, hay que decidir qué pasa si un jugador no juega nunca: probablemente el reloj deba seguir siendo obligatorio ahí, y la elección quedar sólo para el modo individual.

---

# Anexo: números medidos

| Elemento | Selector / archivo | Valor medido | Umbral |
|---|---|---|---|
| `#skip-btn` habilitado | `styles.css:578` | 2,05:1 | 4,5:1 |
| `#skip-btn` deshabilitado | `styles.css:563` | 1,30:1 | 4,5:1 |
| `.position-search-meta` sobre casilla clara | `styles.css:1525` | 2,41:1 | 4,5:1 |
| `.position-search-meta` sobre casilla oscura | `styles.css:1525` | 3,29:1 | 4,5:1 |
| `.node-authors` | `styles.css:2483` | 1,90:1 | 4,5:1 |
| Etiquetas del panel inactivo (duelo) | `styles.css:1099` | 1,93:1 | 4,5:1 |
| Nombre del jugador inactivo | `styles.css:1099` | 3,99:1 | 4,5:1 |
| Texto de ejemplo del campo de usuario | UA, sin regla `::placeholder` | 3,26:1 | 4,5:1 |
| `--color-blunder` sobre `--color-blunder-bg` | `styles.css:34-35` | 3,93:1 | 4,5:1 |
| `--color-border` sobre `--color-bg` | `styles.css:13` | 1,47:1 | 3,0:1 |
| `--color-border-mid` sobre `--color-bg` | `styles.css:14` | 2,01:1 | 3,0:1 |
| `--color-surface-2` sobre `--color-bg` | `styles.css:11` | 1,15:1 | 3,0:1 |
| `--color-surface` sobre `--color-bg` | `styles.css:10` | 1,06:1 | 3,0:1 |
| `--color-text-muted` sobre `--color-surface-3` | `styles.css:16` | 3,82:1 | 4,5:1 |
| Recuadro de foco de `.square` | `styles.css:752` | no se dibuja | — |
| `#analyze-btn` en 1280×720 | `index.html:132` | y = 800, ventana = 720 | visible |
| Portada en 375×812 | `styles.css:963` | 294 px de 812 (36 %) | — |
| `.landing-description` en 375 px | `styles.css:967` | 147 px de ancho, 13 px, 5 líneas | — |
| Vacío entre panel y tablero (individual, 1280) | `styles.css:1312` | 281 px | — |
| Distancia etiqueta ↔ campo (paso 3) | `styles.css:2091` | 279 px | — |
| Área de clic de "Borrar datos guardados" | `styles.css:2126` | 878 × 42 px | texto de 11 px |
| Desborde de `.result-overlay-panel` | `styles.css:1578` | 29 px con contenido mínimo | 0 |
| Vacío bajo el asistente (paso 1, 1280) | `styles.css:396` | 226 px | — |
| Casilla del tablero en 375 px | `styles.css:1898` | 40,6 px | 44 px |
| `.solo-clock-value` | `styles.css:1473` | 13 px | — |
| Filas ARIA en `#board` | `app.js:4020` | 0 (con 64 `gridcell`) | 8 |
| Reglas `prefers-reduced-motion` | `styles.css` | 0 | ≥1 |
| `color-scheme` declarado | `styles.css` | `normal` | `dark` |
