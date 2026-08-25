# Auditoría adversarial 10 — rendimiento y confiabilidad

| Campo | Valor |
| --- | --- |
| Agente | **Singer-II** |
| Óptica | Rendimiento web, carga inicial, recursos, motor WebAssembly/Worker, caché/offline, red y degradación |
| Snapshot evaluado | `main` @ `dde59b0e41592534cdd4951a94c2376c17eb37e4` |
| Estado del código evaluado | **working tree limpio** |
| Fecha | 2026-08-25 |

## Veredicto ejecutivo

La aplicación tiene bases de resiliencia útiles —motor en `Worker`, *fallback* local, *timeouts*, reintentos, caché de PGN con TTL y pruebas de humo—, pero el camino de operación normal carga y persiste demasiado pronto. El *service worker* precachea **15.05 MB** de artefactos locales, incluidos el motor WebAssembly de 7.30 MB y dos versiones de la imagen hero; además, intenta inicializar el motor aun si la persona sigue en la portada. En el caso más adverso, el mecanismo de degradación ejecuta una búsqueda de ajedrez síncrona en el hilo principal: precisamente la condición de red/CPU débil puede acabar bloqueando la interfaz.

Prioridad: separar el *app shell* del motor y de medios optativos, iniciar/reintentar el motor bajo demanda y trasladar también el *fallback* a un `Worker`. Para Chess.com, limitar y hacer cancelable la exploración de archivos mensuales.

## Metodología y límites

- Revisión estática de `index.html`, `styles.css`, `app.js`, `sw.js`, scripts de verificación y recursos del snapshot indicado.
- Medición local no destructiva de bytes de archivos: el conjunto precacheado suma 15,054,405 bytes (≈14.36 MiB); `stockfish-18-lite-single.wasm` mide 7,295,411 bytes y `maestro.png` 7,193,042 bytes. La prueba `gzip -9` del WASM dio 5,639,195 bytes: es una referencia de transferencia, no una medición de CDN/HTTP real.
- Se ejecutó `npm test`: `smoke-check` y `chess-regression-check` aprobaron.
- No se midieron LCP/INP, CPU, cuota Cache Storage ni cabeceras de producción en dispositivos/redes reales. Por ello, las severidades reflejan rutas de código y tamaños observables, no RUM.

## Hallazgos

### P1 — El precache de instalación descarga y reserva el motor y ambos formatos de la imagen hero antes de necesitarlos

**Evidencia.** `CORE_ASSETS` incorpora el PNG de 7.19 MB, el WebP de 0.17 MB y el WASM de 7.30 MB ([`sw.js:3`](../sw.js#L3)-[`sw.js:24`](../sw.js#L24)). La portada sólo selecciona uno de los dos formatos mediante `image-set` ([`styles.css:130`](../styles.css#L130)-[`styles.css:133`](../styles.css#L133)), pero el `addAll` instala ambos. La instalación espera que `cache.addAll(CORE_ASSETS)` complete antes de activar el worker ([`sw.js:26`](../sw.js#L26)-[`sw.js:31`](../sw.js#L31)).

**Impacto.** Tras la primera carga se compite por, como mínimo, 14.36 MiB de almacenamiento/transferencia local, aun si se abandona la portada sin empezar una partida. Una caída transitoria de cualquiera de los recursos hace fallar la instalación completa del precache; la app seguirá pudiendo funcionar online, pero no adquiere soporte offline ni comunica ese estado. En móviles con plan medido, el coste excede con mucho lo necesario para mostrar la portada.

**Remediación.** Precachear únicamente el *app shell* mínimo (HTML, CSS, JS, piezas necesarias); servir la portada en WebP y dejar el PNG como *fallback* de red, no como precache doble. Cachear/descargar WASM sólo al comenzar una sesión o tras una acción explícita de “preparar motor”, con progreso y cancelación. Manejar cada grupo de precache de forma independiente y exponer un estado offline/reintento si el grupo optativo falla.

### P1 — El motor se descarga al poco de abrir la portada, tiene sólo 7 s para quedar listo y no hay reintento

**Evidencia.** Al arrancar, `requestIdleCallback` tiene un `timeout` de 3 s (o se usa `setTimeout(..., 0)`), de modo que `setupStockfish()` se ejecuta sin intención de jugar ([`app.js:6655`](../app.js#L6655)-[`app.js:6664`](../app.js#L6664)). Esa función primero hace un `fetch` de la misma URL y luego crea el `Worker`; espera `readyok` sólo 7 s y lo termina si no llega ([`app.js:3431`](../app.js#L3431)-[`app.js:3484`](../app.js#L3484)). El worker debe obtener el WASM de 7.30 MB. Los errores se silencian y el estado queda en el evaluador local; no hay cola de reintento ni observabilidad para la persona usuaria.

**Impacto.** En conexiones lentas, caché fría o CPU modesta, el motor puede degradarse definitivamente para esa carga aunque la red se recupere segundos después. También hay una petición de comprobación del JS antes de que el Worker solicite el mismo recurso; puede satisfacerse de caché HTTP, pero no aporta una garantía y añade latencia/tráfico en frío.

**Remediación.** Crear una única promesa de carga bajo demanda, iniciada al pulsar “Comenzar sesión” o durante una fase de preparación visible. Mantener el Worker si llega tarde, reintentar con *backoff* tras error/timeout y mostrar “motor local temporal” en vez de degradar silenciosamente. Eliminar el `fetch` previo o reutilizar su resultado mediante `Blob`/estrategia de empaquetado que no duplique la solicitud. Medir éxito, tiempo de preparación y tipo de fallback.

### P1 — El fallback del motor bloquea el hilo principal durante la ruta de peor conectividad

**Evidencia.** Si Stockfish no está disponible, `getBestMoveWithEngine` y `evaluateMoveWithEngine` llaman a `searchBestMove` / `evaluatePosition` ([`app.js:3560`](../app.js#L3560)-[`app.js:3650`](../app.js#L3650)). Esas funciones hacen minimax recursivo síncrono sobre todos los movimientos y clones ([`app.js:3366`](../app.js#L3366)-[`app.js:3399`](../app.js#L3399)); el límite es profundidad 3 ([`app.js:141`](../app.js#L141)). La búsqueda de candidatas sólo cede al navegador **antes** de evaluar cada candidata ([`app.js:3940`](../app.js#L3940)-[`app.js:3960`](../app.js#L3960)); una evaluación local individual no cede ni observa la cancelación.

**Impacto.** Una posición de alta ramificación puede producir tareas largas y congelar interacción, reloj y repintado. El riesgo es invertido respecto de la expectativa: la ruta destinada a degradar bien en un dispositivo/red débiles concentra CPU en el hilo de UI. Se pueden analizar hasta 400 candidatas en una ventana de 25 s ([`app.js:147`](../app.js#L147)-[`app.js:148`](../app.js#L148)), por lo que las pausas se pueden repetir.

**Remediación.** Ejecutar también el evaluador local dentro de un Worker y enviar resultados/cancelación por mensaje. Si se mantiene en JS, diseñar búsqueda incremental con presupuesto de nodos/tiempo y cesión cooperativa frecuente; detenerla al cancelar o cambiar de sesión. Definir un presupuesto de interacción (por ejemplo, tareas <50 ms) y validarlo con throttling de CPU.

### P2 — La descarga de Chess.com puede encadenar minutos de espera y reintentos sin cancelar ni informar el avance por archivo

**Evidencia.** Cada petición tiene 15 s de timeout y hasta dos reintentos ([`app.js:155`](../app.js#L155)-[`app.js:156`](../app.js#L156), [`app.js:2641`](../app.js#L2641)-[`app.js:2677`](../app.js#L2677)). Los archivos mensuales de hasta doce meses se recorren secuencialmente para lentas, luego Blitz y Bullet ([`app.js:5982`](../app.js#L5982)-[`app.js:6044`](../app.js#L6044)). Un fallo de mes se registra sólo en la variable local `failedMonths`, que no se consume ni se comunica ([`app.js:5980`](../app.js#L5980), [`app.js:5985`](../app.js#L5985)-[`app.js:5989`](../app.js#L5989)); las URLs fallidas se vuelven a intentar en las pasadas de fallback. Ninguna llamada recibe una señal de cancelación de sesión.

**Impacto.** Sin `Retry-After`, un mes no respondiente puede consumir aproximadamente 46.5 s (tres intentos de 15 s más esperas) antes de continuar. Varios meses degradados multiplican esa espera, y una persona no sabe qué archivo falla ni puede detener la operación. Reintentar fallos en las tres pasadas también aumenta el riesgo de rate limiting del proveedor.

**Remediación.** Usar un `AbortController` de operación propagado a `fetchWithTimeout`, sumar un botón de cancelar y un presupuesto global de descarga. Probar primero archivos más recientes, detenerse cuando se alcance una base útil y cachear fallos por URL durante la operación. Mostrar progreso `{mes actual}/{total}`, meses omitidos y una opción de continuar con datos parciales; aplicar concurrencia baja y limitada sólo si la política del proveedor lo tolera.

### P2 — La estrategia offline puede entregar errores del servidor en vez de la copia válida y retiene contenido sin revalidación

**Evidencia.** Para navegaciones, el fallback a `index.html` ocurre únicamente si `fetch()` rechaza; una respuesta HTTP 404/500 se devuelve tal cual ([`sw.js:50`](../sw.js#L50)-[`sw.js:52`](../sw.js#L52)). Para los demás GET same-origin, la estrategia es cache-first y sólo consulta red en un miss ([`sw.js:54`](../sw.js#L54)-[`sw.js:66`](../sw.js#L66)); el `CACHE_NAME` es manual y los recursos WASM/JS usan URL sin hash de contenido ([`sw.js:1`](../sw.js#L1), [`sw.js:22`](../sw.js#L22)-[`sw.js:23`](../sw.js#L23)). El registro del SW se realiza después de `load` y su error sólo va a consola ([`app.js:6621`](../app.js#L6621)-[`app.js:6628`](../app.js#L6628)).

**Impacto.** Una respuesta de origen degradada puede ocultar una versión cacheada que sí serviría para la SPA. En despliegues, actualizar contenido bajo las mismas URLs requiere coordinación perfecta entre el nombre de caché y los query strings; de lo contrario, cache-first puede conservar artefactos incompatibles. La primera visita offline nunca está cubierta y un fallo de registro no es detectable por la persona usuaria.

**Remediación.** Para navegación, aceptar red sólo si `response.ok`; en caso contrario entregar el shell cacheado. Usar nombres de archivo con hash de contenido y una revisión de precache generada en build, o una política `stale-while-revalidate` acotada para recursos versionados. Añadir una pantalla/indicador de disponibilidad offline, telemetría de instalación y prueba E2E de “offline tras primera visita”, “origen 500” y actualización entre dos versiones.

## Controles positivos observados

- El script de aplicación está al final de `body` ([`index.html:308`](../index.html#L308)), por lo que no bloquea el parseo inicial del documento.
- Stockfish, cuando está disponible, ejecuta la búsqueda en un Worker y hay timeout de evaluación con limpieza de listeners ([`app.js:3487`](../app.js#L3487)-[`app.js:3530`](../app.js#L3530)).
- La red de proveedores usa `AbortController` por timeout, respeta `Retry-After` y cuenta con reintentos ([`app.js:2641`](../app.js#L2641)-[`app.js:2677`](../app.js#L2677)).
- Los PGN se guardan en IndexedDB, tienen TTL de siete días y se admite una copia vencida si falla la actualización ([`app.js:152`](../app.js#L152)-[`app.js:155`](../app.js#L155), [`app.js:5828`](../app.js#L5828)-[`app.js:5837`](../app.js#L5837)).

## Riesgos residuales y validación posterior

Incluso aplicando las correcciones, el rendimiento dependerá de MIME/compresión/CDN de hosting, cuota de Cache Storage, compatibilidad real de WASM/Worker y límites cambiantes de Lichess/Chess.com. Antes de publicar, medir LCP/INP y tiempo a motor listo en móvil de gama media con red rápida/3G simulada; verificar que no se descarga WASM antes de solicitar juego; y automatizar matrices online, offline caliente, primer acceso offline, timeout de motor, proveedor 429 y actualización de service worker.
