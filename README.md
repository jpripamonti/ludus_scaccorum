# Chess Position Battle

Entrenador de ajedrez para 1 o 2 jugadores con base online de partidas públicas.

## Cómo correrlo

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

## Pipeline de usuario (flujo real actual)

1. Abrís el programa.
2. Elegís modo:
   - `Jugar solo/a`.
   - `Jugar contra alguien` (duelo local de 2 jugadores).
3. Elegís plataforma y usuario:
   - `Lichess`.
   - `Chess.com`.
4. Elegís cantidad de posiciones de la sesión.
5. Tocás `Comenzar sesión`.
6. En ese momento el sistema descarga partidas públicas del último año.
7. Con esas partidas se activa Stockfish para detectar la primera posición de error útil.
8. Cuando encuentra la primera posición, arranca el tablero.
9. Jugás la ronda y se evalúa:
   - Mejor jugada del módulo.
   - Jugada de la partida original.
   - Jugada del jugador.
10. `Siguiente posición` busca y prepara la próxima posición al vuelo.

### Diferencia entre 1 jugador y 2 jugadores

- En `1 jugador`, la evaluación se hace al terminar tu jugada.
- En `2 jugadores`, el Jugador 1 mueve y **no se evalúa todavía**.
- Luego mueve el Jugador 2 y recién ahí se evalúan ambas jugadas juntas sobre la misma posición base.

## Puntuación

- Sin jugada: `0` puntos.
- Referencia única: siempre la mejor jugada del módulo.
- Cuanto más cerca de la mejor jugada, mejor calidad y mayor puntaje.
- Sistema activo: `Etiquetas simples (v1)`.

## Notas técnicas

- Motor principal: `vendor/stockfish-18-lite-single.js` (WASM local).
- Si Stockfish no inicia o falla, el sistema cae a evaluador local de respaldo.
- Cache de evaluación por `FEN + depth + movetime` para reducir recomputación.
