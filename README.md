# ALGEBRAIC MUSIC — Drum Matrix Lab

Caja de ritmos matricial 8 × 8 con 31 sonidos CC0, grabaciones acústicas con múltiples intensidades y kits electrónicos trap, 808, bounce y vintage.

**GitHub Pages (cuando esté activado):**
https://magalarza726-del.github.io/ALGEBRAIC-MUSIC/

## Funciones

- Secuenciadores A y B: ocho instrumentos por ocho corcheas en un compás de 4/4.
- Cada clic cambia la intensidad 0 (silencio), 1 (suave), 2 (media) o 3 (fuerte). Clic derecho retrocede un nivel; Shift+clic reproduce un golpe.
- Resultado C con suma algebraica real, suma promediada (son distintas), diferencia positiva, multiplicación matricial verdadera, producto por elementos, transpuesta, inversión temporal, inversión de intensidad e inversa algebraica (si existe).
- Matrices A y B normalizadas a 0–1; C conserva **el resultado algebraico sin normalizar (incluye negativos)** y la proyección normalizada audible. Normalización fija, por pico relativo o mín./máx.; cuantización a niveles 0–3 para reproducir.
- Motor Web Audio con ocho pistas, **31 presets** (13 acústicos y 18 electrónicos), hasta cuatro variaciones de toma para cada fuerza acústica, opciones de one-shots TR-808 derivados, ambiente estéreo de sala configurable y controles de nivel. La intensidad controla la capa grabada (cuando existe), el volumen y un filtro suave.
- Control de BPM (40 a 240), reproducción A/B/C, visualización del pulso, master general y mezclador por instrumento: sonido, nivel, panorámica, afinación, silenciar y carga de muestras propias por nivel de fuerza.
- Guardado automático local, importación/exportación de proyectos JSON y exportación WAV de cuatro compases.
- Interfaz responsiva. No necesita frameworks ni backend.

## Habilitar GitHub Pages

1. En el repositorio, entra en Settings → Pages.
2. En Build and deployment / Source, selecciona GitHub Actions.
3. Si el primer workflow falló porque GitHub Pages aún no estaba habilitado, abre Actions → Publicar ALGEBRAIC MUSIC → Run workflow.
4. Abre https://magalarza726-del.github.io/ALGEBRAIC-MUSIC/.

Cada publicación ejecuta pruebas y descarga **164 archivos de sonido CC0** (130 FLAC acústicos más 34 WAV electrónicos), y los coloca dentro del sitio publicado. Las familias acústicas aportan hasta cuatro tomas alternativas y los presets electrónicos pueden tener una o varias muestras. Una vez publicado por Actions, **los sonidos se sirven desde el propio GitHub Pages**, sin terceros en tiempo de reproducción.

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

Las grabaciones de Virtuosity Drums (Versilian Studios / Karoryfer Samples), y el platillo China de Big Rusty Drums (Karoryfer Samples), se distribuyen bajo **CC0 1.0**. Los sonidos electrónicos del proyecto de GitHub **Boochi44/free-drum-samples** también se publican bajo CC0 y contienen muestras de tres kits de producción hip-hop/trap. El trabajo de preparación en FLAC por el proyecto ferrosintesis conserva articulaciones y capas de velocidad. Se fija su commit exacto para evitar cambios no controlados:

2f26075ea93291535a869f5d356d2e3d934c7868

Fuentes y procedencia:

- https://github.com/0x4D44/ferrosintesis/tree/2f26075ea93291535a869f5d356d2e3d934c7868/crates/ferrosintesis-samples-drumkit
- https://github.com/0x4D44/ferrosintesis/tree/2f26075ea93291535a869f5d356d2e3d934c7868/crates/ferrosintesis-samples-drumkit2
- https://github.com/sfzinstruments/virtuosity_drums
- https://github.com/sfzinstruments/karoryfer.big-rusty-drums
- https://github.com/Boochi44/free-drum-samples/tree/77ba31428a079dd8f17c8e144c1e649ea0a198b3
- https://creativecommons.org/publicdomain/zero/1.0/

El código de ALGEBRAIC MUSIC tiene licencia MIT; las muestras acústicas conservan CC0.

## Consideraciones

- Ocho columnas equivalen a ocho corcheas en UN compás 4/4 que se repite.
- El verdadero producto de matrices utiliza C = (A × B) / 8 para mantener la escala de 0 a 1. El producto celda a celda es una operación distinta.
- La inversa algebraica de una matriz singular no existe. La app avisa en lugar de inventar un ritmo.
- C muestra la **matriz bruta** antes de normalizar, la **matriz continua** proyectada a [0,1] y la matriz cuantizada. El resultado matemático no cambia con el modo de normalización, pero la proyección audible sí. La normalización mín./máx. de una inversa con negativos puede activar posiciones que eran cero: es una transformación deliberada de rango.
- La inversión de fuerza intercambia 1 y 3, dejando 2 y 0 intactos. Al copiar C a A o B se cuantiza intencionalmente.
- Por restricciones de los navegadores, hay que tocar Reproducir o un pad para activar el audio. La carga del banco inicial puede tardar unos segundos.
- Se recomienda Chrome/Edge/Firefox/Safari actuales con soporte para FLAC y Web Audio.
- Los archivos de audio personalizados permanecen durante la sesión y no se insertan en la exportación JSON. Tras recargar se usa el sonido base configurado.
- Los acústicos tienen tomas grabadas por intensidad y round-robin; los electrónicos con un solo one-shot no cuentan con capas grabadas reales y su dinámica se obtiene por control de volumen y filtrado. Los presets con tres WAV poseen variaciones de timbre, no necesariamente golpes grabados con diferentes fuerzas.
