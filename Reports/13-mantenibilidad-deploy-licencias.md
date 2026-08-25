# Reporte 13 — Mantenibilidad, operación, deploy y licencias

## Identificación del snapshot

- **Agente:** Sagan-II
- **Óptica:** arquitectura, mantenibilidad, complejidad, higiene del repositorio, build/deploy, dependencias/licencias y operación.
- **Rama evaluada:** `main`
- **Commit evaluado:** `dde59b0e41592534cdd4951a94c2376c17eb37e4`
- **Estado del código evaluado:** working tree `limpio` (snapshot congelado antes de generar los reportes).
- **Fecha:** `2026-08-25`

## Resultado ejecutivo

El proyecto tiene una mejora importante respecto de auditorías anteriores: Pages ahora publica una lista explícita de artefactos y ejecuta `npm test`; el inventario de terceros y los checksums de Stockfish ya existen. Aun así, no se puede acreditar la trazabilidad de la fuente GPL del binario ni la titularidad de la imagen de portada. En ingeniería, el mayor riesgo de regresión es que el gate no ejecuta el sitio real en un navegador y que el código y las hojas de estilo concentran demasiadas responsabilidades.

Prioridad propuesta: resolver primero los dos riesgos de redistribución, luego un E2E del artefacto de Pages y el cacheo/versionado; modularizar y retirar legado CSS de modo incremental.

## Metodología

1. Inspección estática del árbol comprometido en el commit indicado: HTML, JavaScript, CSS, service worker, scripts de prueba, workflow y documentación/licencias.
2. Revisión de la composición del artefacto publicado y de los controles de integridad de los binarios vendorizados.
3. Ejecución local de `npm test`: **aprobada** (`smoke-check` y `chess-regression-check`).
4. Medición de complejidad: `app.js` tiene 6.669 líneas y 374 funciones con nombre; los datos de prueba no son una medición de cobertura.

No se modificó código de producto. Los reportes generados durante la auditoría no forman parte del snapshot evaluado.

## Hallazgos priorizados

### A1 — No es posible demostrar la fuente correspondiente del binario GPL de Stockfish

**Evidencia.** El despliegue distribuye los dos artefactos de Stockfish, incluido el `.wasm`, al público (`.github/workflows/deploy-pages.yml:41-45`). El inventario identifica proyectos upstream y hashes (`THIRD_PARTY_NOTICES.md:5-17`; `vendor/SHA256SUMS:1-2`), pero no registra para los binarios presentes un tag o commit exacto, archivo fuente descargado, comando de build, ni un enlace/versionado de la fuente correspondiente. El propio inventario deja esos datos como requisito para futuros reemplazos (`THIRD_PARTY_NOTICES.md:17`), no como un registro del artefacto actual.

**Impacto.** La suma SHA-256 prueba integridad dentro de este repositorio, no origen ni reproducibilidad. Ante una petición de fuente o una revisión de cumplimiento GPLv3, no hay evidencia suficiente para demostrar qué fuente produjo el objeto distribuido. Es un riesgo alto de cumplimiento y de interrupción de la distribución; esta auditoría no afirma por sí sola un incumplimiento ya probado.

**Remediación.** Crear un directorio o release de procedencia inmutable con: URL y hash del archivo fuente, commit/tag de `stockfish.js` y Stockfish, versión de Emscripten, comando de build, red neuronal aplicable, hashes de salida y una ruta clara para obtener el *Corresponding Source*. Hacer que la actualización de `vendor/` falle en CI si ese manifiesto no cambia junto con los hashes.

### A2 — La ilustración de landing se publica aun con licencia/origen sin resolver

**Evidencia.** La hoja de estilo selecciona `maestro.webp` y deja PNG como fallback (`styles.css:130-133`); el workflow publica todo `assets/` (`.github/workflows/deploy-pages.yml:42-44`). El aviso de terceros dice que ambos archivos sólo aparecen como binarios iniciales, que no hay fuente externa documentada y que no deben considerarse habilitados para redistribución hasta resolverlo (`THIRD_PARTY_NOTICES.md:31-43`).

**Impacto.** Cada despliegue de Pages redistribuye una obra cuya titularidad o licencia no puede justificarse. El riesgo es independiente de que la imagen pueda haber sido creada para el proyecto: falta documentarlo de forma verificable.

**Remediación.** Registrar por escrito autor, fecha, herramienta y condiciones de uso si fue obra propia/IA; o registrar proveedor, licencia y atribución si fue adquirida. Si no puede probarse, retirar ambos recursos del artefacto y usar un fondo propio mínimo hasta aclararlo.

### M1 — El gate CI no ejecuta el sitio publicado ni valida el contrato HTML–JS

**Evidencia.** Pages ejecuta solamente `npm test` antes de empacar (`.github/workflows/deploy-pages.yml:34-45`). El smoke test comprueba archivos, sintaxis y hashes (`scripts/smoke-check.js:24-107`). La regresión corre `app.js` dentro de `vm` (`scripts/chess-regression-check.js:142-145`), pero su `getElementById` fabrica un elemento para cualquier id y `querySelector` también siempre devuelve uno (`scripts/chess-regression-check.js:95-111`); además el `requestIdleCallback` falso no llama el callback (`scripts/chess-regression-check.js:114-125`). Por ello no puede detectar un id eliminado del HTML ni ejecutar la inicialización real de Worker, IndexedDB y service worker (`app.js:3465-3484`, `app.js:6621-6669`).

**Impacto.** Una refactorización de markup, cache, Web Worker o APIs del navegador puede pasar en verde y romper el flujo en Pages. También se prueba el árbol de trabajo, no el contenido de `_site` que realmente se sube.

**Remediación.** Añadir un E2E de navegador headless que levante exactamente `_site`: verificar carga sin errores, landing → wizard, una sesión con respuestas de red/motor simuladas, cancelación y registro del service worker. Añadir una aserción estática de ids usados por JS contra `index.html` como control rápido complementario.

### M2 — `app.js` concentra estado global, dominio, red, motor y UI en una sola unidad

**Evidencia.** El archivo captura más de cien referencias DOM al cargar (`app.js:1-128`) y mantiene un único `STATE` mutable para tablero, motor, sesión, wizard, temporizador, UI y duelo (`app.js:920-991`). En el mismo archivo conviven el cliente de motor (`app.js:3465-3655`), parser PGN y análisis (`app.js:3657-4018`), render/interacción y pipeline remoto (`app.js:4021-5160`, `app.js:5663-6261`). El snapshot contiene 6.669 líneas y 374 funciones con nombre en ese archivo.

**Impacto.** Cambios visuales o de wizard pueden alterar flujo de sesión y viceversa; el aislamiento de pruebas requiere emular todo el DOM, como ocurre hoy. La probabilidad de regresiones cruzadas y el coste de revisar cada cambio ya son altos.

**Remediación.** Extraer por etapas, sin reescritura: (1) reglas puras de ajedrez/scoring/PGN, (2) cliente Stockfish y proveedores remotos con dependencias inyectadas, (3) estado de sesión y, al final, adaptador DOM. Acompañar cada extracción con pruebas de la API nueva y mantener `app.js` como composición temporal.

### M3 — CSS de dos layouts mantiene selectores obsoletos en el camino de producción

**Evidencia.** `styles.css` declara explícitamente un layout “Legacy” que sería sobrescrito después (`styles.css:617-623`) y conserva, entre otros, el temporizador viejo (`styles.css:656-711`) y `.side-panel` (`styles.css:721-747`). No existe markup ni referencia JavaScript para `.top-status-row`, `.timer-line` o `.side-panel` en el snapshot; el rediseño activo empieza recién en `styles.css:1069-1107`. Algunas reglas antiguas —por ejemplo `.board-actions-secondary`— sí siguen activas, por lo que el bloque no puede borrarse entero sin una migración controlada.

**Impacto.** La cascada conserva reglas de dos arquitecturas, dificulta saber cuál define la interfaz y agranda cada modificación visual. Un selector reintroducido incidentalmente puede activar estilos viejos sin que el autor lo advierta.

**Remediación.** Antes de retirar reglas, tomar capturas de regresión de landing/wizard/solo/duelo móvil y escritorio. Luego eliminar selectores sin consumidores comprobados, mover los que sí viven a su bloque actual y prohibir nuevos “compat/legacy” sin fecha de eliminación o issue asociado.

### M4 — El esquema de caché depende de números manuales y permite servir JS/CSS viejos tras un deploy

**Evidencia.** El HTML usa versiones manuales distintas para CSS y JS (`index.html:12`, `index.html:308`); el service worker fija por separado `CACHE_NAME` y la lista de esas URLs (`sw.js:1-24`). Para recursos estáticos usa *cache-first* y busca en todas las caches (`sw.js:54-66`). El smoke test sólo confirma que la URL listada existe (`scripts/smoke-check.js:78-86`), no que un cambio de recurso haya actualizado la versión/cache.

**Impacto.** Si se cambia `app.js`, `styles.css` o un asset y se olvida uno de esos tres números/listas, usuarios con service worker pueden recibir una combinación vieja de HTML, JS y CSS. En esta app, donde JS depende estrechamente de ids y estructura HTML, eso puede convertirse en un fallo de arranque difícil de reproducir.

**Remediación.** Generar un manifiesto versionado/hash durante el empaquetado, usado tanto por HTML como por el worker, o adoptar red-primero para HTML/JS/CSS con fallback offline. Agregar un test de actualización de service worker que compruebe que una nueva revisión invalida los recursos de aplicación.

### M5 — Las acciones con capacidad de publicar Pages no están fijadas a commits inmutables

**Evidencia.** El job tiene permisos de escritura para Pages e identidad OIDC (`.github/workflows/deploy-pages.yml:9-12`) y ejecuta acciones con tags mayores móviles: `actions/checkout@v4`, `setup-node@v4`, `configure-pages@v5`, `upload-pages-artifact@v3` y `deploy-pages@v4` (`.github/workflows/deploy-pages.yml:26-59`).

**Impacto.** Una modificación no esperada de un tag upstream compromete el entorno de CI con capacidad de publicación. Es una exposición de cadena de suministro, aunque las acciones pertenecen a un proveedor ampliamente usado.

**Remediación.** Fijar cada acción a SHA de commit, documentar la versión legible en comentario y habilitar Renovate/Dependabot para actualizar esos SHAs por PR revisable. Mantener los permisos actuales mínimos por job y separar `test` de `deploy` si el proyecto crece.

## Controles existentes y riesgos residuales

| Control actual | Evidencia | Riesgo residual |
| --- | --- | --- |
| Artefacto de Pages por lista explícita | `.github/workflows/deploy-pages.yml:41-45` | Se redujo la publicación accidental de tooling; todavía falta probar el artefacto montado. |
| Validación sintáctica, assets y hashes | `scripts/smoke-check.js:24-107` | No reemplaza un navegador ni acredita procedencia de binarios. |
| Regresiones de reglas y puntaje | `scripts/chess-regression-check.js:147-378` | El DOM y las APIs web son stubs, por lo que no cubre integración visual/runtime. |
| Inventario de terceros | `THIRD_PARTY_NOTICES.md:1-49` | Quedan abiertos Stockfish reproducible e imagen de landing. |
| Worker y caché local para uso sin red | `app.js:2681-2800`, `sw.js:26-75` | El versionado manual hace frágiles las actualizaciones. |

### Nota operativa fuera del árbol versionado

En esta copia local, `git fsck --no-reflogs --full` informó una referencia administrativa inválida (`refs/.DS_Store`) y objetos colgantes. No es un archivo del commit evaluado ni se atribuye al código de `main`, pero conviene reparar o reclonar la copia local antes de usarla para una release o una migración de repositorio.

## Plan de reducción de riesgo

1. **Antes del próximo deploy público:** cerrar la procedencia/licencia de Stockfish y de `maestro.*` (A1–A2).
2. **En el siguiente cambio funcional:** incorporar E2E de `_site` y prueba de actualización del service worker (M1, M4).
3. **Hardening de CI:** fijar acciones por SHA y automatizar sus actualizaciones (M5).
4. **Deuda sostenible:** retirar CSS sin consumidor y extraer primero módulos puros del monolito, con pruebas antes/después (M2–M3).
