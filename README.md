# Chess Position Battle

Entrenador de ajedrez para 1 o 2 jugadores:

1. Subis uno o varios archivos PGN.
2. Chess Position Battle detecta automaticamente el jugador objetivo.
3. El sistema detecta errores de ese jugador con Stockfish.
4. Juegas una sesion intentando encontrar la mejor jugada en cada posicion de error.

## Como correrlo

1. Instalar dependencias:

```bash
npm install
```

2. Iniciar servidor local:

```bash
npm start
```

3. Abrir en navegador:

- http://127.0.0.1:5010

## Flujo de juego

1. Pantalla principal: elegis modo y fuente de partidas:
- `Modo normal`: menos configuracion y menos detalle tecnico visible.
- `Modo ingeniero`: controles avanzados y detalle tecnico completo.
- Cargar PGN (`.pgn`) desde tu computadora.
- Descargar PGN de un usuario de Lichess (partidas publicas).
  - Normal: prioriza `Classical/Rapid` del ultimo año y completa con `Blitz` si hace falta.
  - Ingeniero: permite configurar prioridad de ritmos y fallback.
- Descargar PGN de un usuario de Chess.com (partidas publicas).
  - Normal: prioriza `Rapid/Daily` de los ultimos 12 meses y completa con `Blitz` si hace falta.
  - Ingeniero: permite elegir `Rapid/Daily`, definir minimo de lentas y habilitar/deshabilitar fallback a `Blitz`.
2. Segunda pantalla: configuras:
- Jugador detectado automaticamente desde los PGN.
- En modo ingeniero: tiempo por jugada, umbral y sistema de puntuacion.
- En modo normal: configuracion recomendada simplificada.
- Formato de sesion:
  - `Individual (1 jugador)`.
  - `Competitivo local (2 jugadores)`: ambos juegan la misma posicion, con el mismo reloj y reglas.
- Tiempo por posicion (reloj del jugador, visible durante la ronda).
3. Click en `Analizar PGN y detectar errores`.
4. Chess Position Battle baraja partidas y posiciones candidatas.
5. En cuanto detecta la primera posicion en el umbral, arranca el juego sin esperar el analisis completo.
6. Cada `Siguiente posicion` busca la proxima posicion al vuelo.
7. Luego de cada jugada, el juego muestra:
- Mejor jugada del modulo.
- Jugada real de la partida.
- Tu jugada.
- Delta contra la mejor jugada del modulo (referencia unica).
- Centipeones perdidos y puntos obtenidos.
- Indicador visual compacto de rendimiento (calidad + delta + puntos + barra de precision).
- Boton `Reintentar posicion` para rehacer la ronda actual rapidamente.

Regla de puntuacion:

- Si no jugas una movida en una posicion, sumas 0 puntos.
- La referencia de puntaje es siempre la mejor jugada del modulo.
- Cuanto mas cerca este tu jugada de la mejor del modulo, mas puntos obtenes.

Sistemas de puntuacion disponibles:

- `Centipawns (curva suave)`: 0..100 con curva exponencial segun cp perdidos.
- `Centipawns (lineal)`: 0..100 lineal; 0 cp = 100, 400 cp o mas = 0.
- `Etiquetas por centipawns`: clasifica (`muy buena`, `buena`, `dudosa`, `mala`, `blunder`) y puede restar puntos.
- `Etiquetas por expected points`: usa perdida de expected points (derivada de la evaluacion del modulo) y asigna etiquetas + puntos.
- `Priorizar jugada exacta`: gran premio si jugas exactamente la mejor del modulo; las demas jugadas puntuan mucho menos.

## Formato de PGN

- Se aceptan archivos con una o multiples partidas.
- Los tags `White` y `Black` se usan para identificar el color del jugador objetivo.
- Chess Position Battle detecta automaticamente el jugador por frecuencia en tags `White` y `Black`.

## Notas tecnicas

- El motor principal en navegador es `vendor/stockfish-18-lite-single.js` (WASM local).
- Si el motor no inicia o falla, se usa un evaluador local de fallback (menos preciso).
- El analisis usa cache por FEN + profundidad + movetime para evitar recomputos.
