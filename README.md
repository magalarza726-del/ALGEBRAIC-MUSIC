# ALGEBRAIC MUSIC — Drum Matrix Lab

Primera versión de una caja de ritmos que usa matrices 8 × 8 y sonidos de batería acústicos grabados.

**GitHub Pages (cuando esté activado):**
https://magalarza726-del.github.io/ALGEBRAIC-MUSIC/

## Funciones

- Secuenciadores A y B: ocho instrumentos por ocho corcheas en un compás de 4/4.
- Cada clic cambia la intensidad 0 (silencio), 1 (suave), 2 (media) o 3 (fuerte). Clic derecho retrocede un nivel; Shift+clic reproduce un golpe.
- Resultado C con suma promediada, diferencia positiva, multiplicación matricial verdadera, producto por elementos, transpuesta, inversión temporal, inversión de intensidad e inversa algebraica (si existe).
- Matrices normalizadas internamente de 0 a 1 y cuantizadas para reproducir a niveles 0–3. Se puede normalizar por escala fija o pico relativo.
- Motor de audio Web Audio con ocho pistas iniciales, sonidos reales de batería acústica CC0, tres capas de fuerza grabadas y dos variaciones por capa. La intensidad controla el volumen, el filtro y la elección de la grabación.
- Control de BPM (40 a 240), reproducción A/B/C, visualización del pulso, master general y mezclador por instrumento: sonido, nivel, panorámica, afinación, silenciar y carga de muestras propias por nivel de fuerza.
- Guardado automático local, importación/exportación de proyectos JSON y exportación WAV de cuatro compases.
- Interfaz responsiva. No necesita frameworks ni backend.

## Habilitar GitHub Pages

1. En el repositorio, entra en Settings → Pages.
2. En Build and deployment / Source, selecciona GitHub Actions.
3. Si el primer workflow falló porque GitHub Pages aún no estaba habilitado, abre Actions → Publicar ALGEBRAIC MUSIC → Run workflow.
4. Abre https://magalarza726-del.github.io/ALGEBRAIC-MUSIC/.

Cada publicación ejecuta pruebas y descarga 60 FLAC acústicos CC0 (tres capas x dos variantes x diez familias), y los coloca dentro del sitio publicado. Una vez publicado por Actions, **los sonidos se sirven desde el propio GitHub Pages**, sin terceros en tiempo de reproducción.

También puedes elegir Deploy from a branch, main y /(root). En ese caso la app obtiene las grabaciones directamente de GitHub en línea; no las incorpora al repositorio. El workflow es la opción recomendada para que el sitio incluya las grabaciones.

## Uso local

Levanta un servidor HTTP (se requiere por los módulos ES):

    python -m http.server 8000

Abre http://localhost:8000. La app obtendrá inicialmente las muestras desde el origen público.

Para construir localmente una versión con sonidos incluidos (requiere Internet):

    python3 scripts/build_site.py
    cd dist
    python3 -m http.server 8000

Pruebas:

    node --check app.js
    node --test tests/*.test.mjs

## Licencia y origen de los sonidos

Las grabaciones de Virtuosity Drums (Versilian Studios / Karoryfer Samples), y el platillo China de Big Rusty Drums (Karoryfer Samples), se distribuyen bajo **CC0 1.0**. El trabajo de preparación en FLAC por el proyecto ferrosintesis conserva articulaciones y capas de velocidad. Se fija su commit exacto para evitar cambios no controlados:

2f26075ea93291535a869f5d356d2e3d934c7868

Fuentes y procedencia:

- https://github.com/0x4D44/ferrosintesis/tree/2f26075ea93291535a869f5d356d2e3d934c7868/crates/ferrosintesis-samples-drumkit
- https://github.com/0x4D44/ferrosintesis/tree/2f26075ea93291535a869f5d356d2e3d934c7868/crates/ferrosintesis-samples-drumkit2
- https://github.com/sfzinstruments/virtuosity_drums
- https://github.com/sfzinstruments/karoryfer.big-rusty-drums
- https://creativecommons.org/publicdomain/zero/1.0/

El código de ALGEBRAIC MUSIC tiene licencia MIT; las muestras acústicas conservan CC0.

## Consideraciones

- Ocho columnas equivalen a ocho corcheas en UN compás 4/4 que se repite.
- El verdadero producto de matrices utiliza C = (A × B) / 8 para mantener la escala de 0 a 1. El producto celda a celda es una operación distinta.
- La inversa algebraica de una matriz singular no existe. La app avisa en lugar de inventar un ritmo.
- Los valores continuos del resultado se conservan en la sesión actual y al exportar el JSON, pero al copiar C a A o B se cuantizan intencionalmente.
- Por restricciones de los navegadores, hay que tocar Reproducir o un pad para activar el audio. La carga del banco inicial puede tardar unos segundos.
- Se recomienda Chrome/Edge/Firefox/Safari actuales con soporte para FLAC y Web Audio.
- Los archivos de audio personalizados permanecen durante la sesión y no se insertan en la exportación JSON. Tras recargar se usa el sonido base configurado.
