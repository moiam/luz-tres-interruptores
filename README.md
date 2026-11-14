# Luz desde tres puntos

Simulador para practicar el cableado de una bombilla controlada desde tres sitios: conmutador + cruzamiento + conmutador.

Web: https://moiam.github.io/luz-tres-interruptores/

## Estructura

```
index.html          Página y estructura de la interfaz
css/styles.css      Estilos (mobile-first, modo claro y oscuro)
js/circuit.js       Datos: piezas, colores de cable, pasos de la solución, nombres
js/sim.js           Simulación eléctrica pura (sin DOM)
js/checks.js        Revisión de colores y errores típicos
js/draw.js          Dibujo SVG del tablero (horizontal en escritorio, vertical en móvil)
js/main.js          Estado, render e interacción (conectar cables, PIA, acciones)
assets/             Icono
tests/              Tests de la simulación (node:test)
```

## Desarrollo

No hace falta compilar nada. Los módulos ES necesitan un servidor local:

```
npm start      # sirve en http://localhost:8000
npm test       # pruebas de la simulación
```

Cada push a `main` se publica solo en GitHub Pages.
