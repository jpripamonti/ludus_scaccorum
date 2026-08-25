# Informe adversarial — documentación, onboarding y operación

| Campo | Valor |
| --- | --- |
| Agente | Brooks |
| Óptica | Documentación, onboarding técnico, contratos operativos y riesgo de mantenimiento/despliegue incorrecto |
| Snapshot evaluado | rama `main`, commit `dde59b0e41592534cdd4951a94c2376c17eb37e4`, working tree `limpio` |
| Fecha | 2026-08-25 |
| Alcance | `README.md`, `TODO.md`, `progress.md`, `package*.json`, scripts de verificación, avisos de terceros, workflow de Pages y contratos que la implementación expone. No se modificó código de producto. |

## Dictamen

El proyecto es relativamente sencillo de levantar y tiene controles de CI útiles, pero su contrato de operación está incompleto. Un mantenedor puede desplegar contenido con derechos aún no aclarados, dejar usuarios servidos por una versión vieja de la aplicación al no coordinar la caché, o desconocer que las partidas se guardan localmente. El README tampoco permite reproducir el entorno de CI ni explica cómo validar un cambio antes de subirlo.

## Metodología

1. Leí los documentos y los contrasté con `index.html`, `app.js`, `sw.js`, `package.json`, los scripts y el workflow de despliegue del snapshot.
2. Seguí los contratos ejecutables: comandos de npm, construcción del artefacto de Pages, persistencia local, descarga remota y caché del service worker.
3. Ejecuté `npm test` en el snapshot: pasó `smoke-check` y `chess-regression-check` con Node `v22.22.1`.
4. Priorizé por probabilidad de un despliegue/uso erróneo y por reversibilidad. Las referencias de líneas son evidencia del snapshot evaluado.

## Hallazgos priorizados

### P1 — Se despliega una imagen que la propia documentación declara no apta todavía para redistribuir

**Evidencia.** `THIRD_PARTY_NOTICES.md:39-43` dice que no se conoce el origen/licencia de `maestro.png`/`maestro.webp` y ordena no tratarla como autorizada para redistribución hasta resolverlo. Sin embargo, `styles.css:130-133` la usa como fondo de producción y `.github/workflows/deploy-pages.yml:41-44` copia todo `assets/` y lo publica en cada despliegue.

**Impacto.** La documentación identifica un bloqueo legal real, pero el procedimiento automatizado lo ignora. Cualquier push a `main` puede seguir distribuyendo un activo potencialmente no licenciado; un mantenedor razonable puede confundir el inventario con una mera nota informativa.

**Remediación.** Antes del próximo release, confirmar y registrar autoría/licencia y procedencia verificable, o retirar ambos archivos de CSS y del artefacto. Convertir ese requisito en una condición de release (por ejemplo, una entrada de procedencia obligatoria y un chequeo que falle si el estado sigue siendo “unresolved”).

**Control de aceptación.** Revisar que el inventario tenga fuente, licencia elegida y titular/permiso; ejecutar una build del artefacto y comprobar que no contiene el activo si el estado no está resuelto.

### P1 — No existe contrato para invalidar la caché del service worker al publicar

**Evidencia.** La aplicación referencia versiones manuales en `index.html:12,308` (`maestro125` y `maestro54`) y define otra versión manual de caché en `sw.js:1`; el service worker usa una estrategia cache-first (`sw.js:54-66`). No hay instrucciones de release en `README.md:28-42`, ni una comprobación en `scripts/smoke-check.js:24-105` que obligue a actualizar estas versiones de manera coordinada.

**Impacto.** Un cambio de `app.js`, CSS, assets o lista de precaché puede llegar a Pages pero no a clientes con la caché anterior si quien publica no cambia los identificadores correctos. El resultado puede ser una UI, lógica y worker de distintas releases, difícil de reproducir desde soporte.

**Remediación.** Documentar un único procedimiento de release: qué archivos/identificadores se cambian, cómo verificar actualización y cómo hacer rollback. Mejor aún, sustituir contadores manuales por un identificador derivado del commit/contenido y validar en CI que la lista de precaché y las referencias de HTML son coherentes.

**Control de aceptación.** En una sesión con una versión ya cacheada, publicar un cambio de JS/CSS y comprobar en un navegador limpio y uno existente que ambos reciben la nueva versión; dejar la prueba y la versión publicada en la evidencia de release.

### P2 — El README no documenta el ciclo de vida local de partidas públicas ni el alcance efectivo de las consultas

**Evidencia.** El README sólo promete “Downloads public games” y la prioridad de ritmos (`README.md:16-26`). En cambio, la implementación solicita confirmación y aclara que la petición va desde el navegador (`app.js:293-299`), conserva PGN en IndexedDB durante siete días (`app.js:152-154`, `2711-2779`), puede reutilizar una base vencida ante fallos (`app.js:5829-5832`, `6094-6097`) y permite borrarla mediante una confirmación de dos pulsaciones (`app.js:6468-6503`). Además, la interfaz limita el análisis a partidas del último año (`index.html:67-68`) y puede completar con Bullet (`app.js:2193-2202`, `2220-2229`), dato que el texto “¿Cómo funciona?” omite (`index.html:69-71`).

**Impacto.** Usuarios, soporte y contribuidores no disponen de una fuente estable para responder qué datos se transmiten, dónde quedan, cuánto tiempo, cómo borrarlos o por qué una sesión puede usar datos viejos/Bullet. Aumenta los incidentes de privacidad percibida y los reportes que no se pueden reproducir.

**Remediación.** Añadir al README una sección bilingüe “Datos y proveedores” con: llamada directa al proveedor, datos enviados (usuario y solicitudes), almacenamiento local/TTL de siete días, posible uso de caché vencida sólo ante error, cómo borrar los datos y límites de cortesía. Alinear la ayuda del wizard con el fallback Bullet y su advertencia de calidad.

**Control de aceptación.** Revisión de texto contra las constantes y flujos anteriores; prueba manual de descargar, recargar, usar caché y borrar datos, validando que la documentación describe cada resultado observado.

### P2 — El onboarding técnico no es reproducible ni enseña la puerta de calidad que exige CI

**Evidencia.** El único onboarding es `npm install` y `npm start` (`README.md:28-37,68-77`). `start` depende de Python 3 (`package.json:7`) y las pruebas de Node no se mencionan (`package.json:8-10`). El deploy sí fija Node 22 y ejecuta `npm test` antes de publicar (`.github/workflows/deploy-pages.yml:29-35`).

**Impacto.** Es previsible que contribuidores usen una versión distinta de Node, no tengan Python 3, o abran un PR sin ejecutar las mismas pruebas que bloquean el deploy. También queda indocumentado que el proyecto no requiere dependencias npm de producción y que el servidor es estático: eso induce instalaciones y diagnósticos innecesarios.

**Remediación.** Incorporar una guía mínima de contribución: prerrequisitos explícitos (Node 22 para paridad con CI y Python 3), `npm test`, significado y cobertura de `check`/`test:chess`, URL local, y una breve secuencia “antes de push”. Documentar las limitaciones de esas pruebas: no sustituyen una prueba del navegador, de service worker ni de los proveedores remotos.

**Control de aceptación.** Una persona sin conocimiento previo debe poder clonar, verificar versiones, iniciar el servidor y reproducir el gate de CI copiando sólo las instrucciones publicadas.

### P3 — `progress.md` mezcla historial con estado vigente y contiene contratos ya obsoletos

**Evidencia.** El archivo registra que el wizard tenía “4 pasos” (`progress.md`, entrada 2026-02-26), mientras la interfaz actual afirma tres pasos (`index.html:32-33`) y contiene tres secciones de wizard (`index.html:42-119`). El mismo historial conserva puntuaciones y estructuras posteriormente reemplazadas sin una marca de obsolescencia. `TODO.md:3-10`, por el contrario, sólo expresa un problema de producto y no remite a criterios, dueño ni decisión pendiente.

**Impacto.** Un mantenedor que tome `progress.md` como guía puede restaurar una decisión retirada o depurar contra un flujo inexistente. El único TODO accionable tampoco permite saber quién debe decidir, cómo medir que la solución elimina el problema ni dónde se implementaría.

**Remediación.** Renombrar o encabezar `progress.md` como historial archivado, con fecha/snapshot y advertencia explícita de que no es especificación. Mantener una sección corta de “estado actual” enlazada desde README. Convertir cada TODO vigente en una ficha con objetivo, criterio observable, responsable y referencia a código/prueba una vez decidida la solución.

**Control de aceptación.** Toda afirmación de comportamiento vigente debe poder rastrearse a una especificación actual o a pruebas; el historial no debe ser la fuente de verdad operativa.

## Controles existentes que conviene preservar

- El workflow ejecuta `npm test` antes de armar y subir el artefacto (`.github/workflows/deploy-pages.yml:34-55`).
- `smoke-check` verifica sintaxis, referencias de assets y los SHA-256 de Stockfish (`scripts/smoke-check.js:53-105`); el inventario exige actualizar esas sumas al reemplazar los binarios (`THIRD_PARTY_NOTICES.md:15-17`).
- La consulta remota pide reescribir el nombre de usuario y limita la frecuencia desde el navegador (`app.js:2977-2992`, `scripts/chess-regression-check.js:348-376`).
- El inventario de terceros ya expone incertidumbres en vez de afirmar indebidamente una licencia; debe pasar de señalización a requisito de release.

## Riesgos residuales

Incluso tras documentar y automatizar los contratos, la disponibilidad de Lichess/Chess.com, sus cambios de API y las políticas de GitHub Pages siguen fuera del control del proyecto. También se requiere una decisión del propietario para cerrar la procedencia de la imagen y elegir el régimen de redistribución de las piezas; ningún texto por sí solo sustituye esa confirmación. Por último, las pruebas actuales verifican lógica y estática, no una sesión real contra proveedores ni la actualización del PWA, por lo que cada release debería conservar evidencia manual o automatizada de esos dos recorridos.
