# Reportes adversariales

Snapshot analizado:
- Branch: `main`
- Commit: `4473c3cef1c784336cce7bca33f299a4c39b6fdb`
- Estado del working tree al iniciar el analisis: limpio
- Fecha de generacion: `2026-06-23`
- Modelo solicitado para los subagentes: `gpt-5.5`

Nota: estos reportes quedaron generados despues del snapshot anterior. Es decir, los hallazgos estan atados al estado limpio de `main` en ese commit; la carpeta `Reports/` es el artefacto posterior de revision.

## Reportes

| Archivo | Agente | Optica |
| --- | --- | --- |
| [01-security-privacy.md](01-security-privacy.md) | Feynman | Seguridad, privacidad, abuso y supply chain |
| [02-game-correctness-engine.md](02-game-correctness-engine.md) | Anscombe | Correctitud de ajedrez, motor, estado y carreras async |
| [03-ux-accessibility-product.md](03-ux-accessibility-product.md) | Rawls | UX, accesibilidad, producto y QA manual |
| [04-performance-reliability.md](04-performance-reliability.md) | Singer | Performance, confiabilidad, red, worker y offline |
| [05-maintainability-deploy-licensing.md](05-maintainability-deploy-licensing.md) | Sagan | Mantenibilidad, deploy, higiene de repo y licencias |

## Auditoría posterior

| Archivo | Snapshot | Óptica |
| --- | --- | --- |
| [06-diseno-adversarial.md](06-diseno-adversarial.md) | `cc5d3a3`, 2026-08-25 | Diseño visual, interacción, arquitectura de información, accesibilidad, redacción y experiencia en teléfono |

Los 25 hallazgos del informe 06 y sus tres propuestas de rediseño (asistente, barra de la ronda y pantalla de resultado) quedaron implementados; la cuarta propuesta, elegir entre jugar con reloj o sin reloj, quedó fuera de alcance por decisión del dueño del proyecto.

## Auditoría adversarial coordinada — 2026-08-25

Snapshot común evaluado por los diez agentes:

- Branch: `main`
- Commit: `dde59b0e41592534cdd4951a94c2376c17eb37e4`
- Estado del working tree al iniciar cada evaluación: limpio

| Archivo | Agente | Óptica |
| --- | --- | --- |
| [07-diseno-visual-interaccion.md](07-diseno-visual-interaccion.md) | Bauhaus | Diseño visual, interacción, responsive, arquitectura de información y copy |
| [08-seguridad-privacidad.md](08-seguridad-privacidad.md) | Feynman-II | Seguridad, privacidad, abuso, supply chain y PWA |
| [09-correctitud-ajedrez-estado.md](09-correctitud-ajedrez-estado.md) | Anscombe-II | Reglas de ajedrez, estado, PGN/FEN, motor y asincronía |
| [10-performance-confiabilidad.md](10-performance-confiabilidad.md) | Singer-II | Rendimiento, recursos, WebAssembly/Worker, caché, red y degradación |
| [11-pruebas-qa-regresiones.md](11-pruebas-qa-regresiones.md) | Dijkstra | Pruebas, QA, cobertura efectiva y prevención de regresiones |
| [12-accesibilidad-inclusiva.md](12-accesibilidad-inclusiva.md) | Perkins | Semántica, teclado, foco, lectores de pantalla y preferencias de usuario |
| [13-mantenibilidad-deploy-licencias.md](13-mantenibilidad-deploy-licencias.md) | Sagan-II | Arquitectura, mantenibilidad, despliegue, operación y licencias |
| [14-flujos-producto-resiliencia.md](14-flujos-producto-resiliencia.md) | Norman | Flujos de producto, transiciones, recuperación, cancelación y persistencia |
| [15-compatibilidad-estandares-web.md](15-compatibilidad-estandares-web.md) | Crockford | Compatibilidad, estándares web, PWA y degradación progresiva |
| [16-documentacion-operacion.md](16-documentacion-operacion.md) | Brooks | Documentación, onboarding técnico y contratos operativos |

## Lectura sugerida

1. Empezar por los hallazgos altos repetidos: resumen de duelo, carreras async, fallback local del motor, deploy que publica archivos internos y riesgo GPL/Stockfish.
2. Separar "bugs claros" de "hardening" antes de implementar.
3. Convertir los hallazgos elegidos en tareas pequeñas con prueba o check manual asociado.
