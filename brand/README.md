# AP · Señal — guía del logo

## La idea

Una sola traza de señal escribe las iniciales. La **A** es un pico de onda triangular que sale de una línea plana. La **P** sube recta desde ese pico y su panza es medio periodo de **onda senoidal**, que no se cierra y sigue en una cola: la señal continúa. Dos osciladores en un trazo, código y sonido.

La versión principal añade **separación cromática**: dos copias desplazadas en menta y rosa, el guiño glitch y experimental.

## Archivos

| Archivo | Uso |
|---|---|
| `svg/ap-color.svg` | Principal a color (fondo transparente). Solo sobre fondos oscuros. |
| `svg/ap-color-on-ink.svg` | Principal sobre tinta, cuadrado. Avatares y redes. |
| `svg/ap-white.svg`, `svg/ap-bone.svg` | Una tinta para fondos oscuros o fotos. |
| `svg/ap-black.svg` | Una tinta para fondos claros, documentos e impresión. |
| `svg/ap-orange.svg` | Una tinta en naranja sodio. |
| `svg/ap-favicon-small.svg` | Versión simplificada para 16–32 px: sin fantasmas y con trazo más grueso. |
| `svg/ap-app-icon.svg`, `svg/ap-maskable.svg` | Icono de app y la versión maskable de Android (contenido dentro del 80 %). |
| `png/*.png` | Exportaciones a 1024 px con transparencia. |
| `og-source.html` | Fuente de `public/og.png`, la imagen de 1200×630 para compartir. |

Los iconos web en uso están en `public/`: `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `maskable-512.png` y `site.webmanifest`.

## Color

| Nombre | HEX | Papel |
|---|---|---|
| Tinta | `#0c0d10` | Fondo |
| Hueso | `#ece6da` | Texto y versión a una tinta |
| Naranja sodio | `#ff5b1f` | Inicio del degradado y acento principal |
| Rosa Athetosis | `#ff2e63` | Centro del degradado y fantasma derecho |
| Violeta | `#c79bff` | Final del degradado |
| Menta | `#9be7c4` | Fantasma izquierdo |

El degradado avanza en el sentido de la señal, de izquierda a derecha: naranja (0 %), rosa (55 %) y violeta (100 %).

## Construcción

- Lienzo base de 256 px. El trazo mide 22 unidades, con extremos y uniones redondeados. En la versión pequeña mide 30.
- Las piernas de la A tienen 75° exactos. La pierna derecha baja en V y sube como palo de la P, sin tramo horizontal.
- Los fantasmas se desplazan (−7, −3) en menta y (+7, +3) en rosa.

## Uso

- **Espacio libre:** deja alrededor del logo como mínimo la altura de la panza de la P.
- **Tamaño mínimo:** la versión con fantasmas, desde 32 px. Por debajo, usa `ap-favicon-small.svg`.
- **Fondo:** la versión a color solo funciona sobre fondo oscuro. Sobre claro, usa la de una tinta en negro.
- **No:** girarlo, cambiar el orden de los colores del degradado, cerrar la panza de la P, añadir sombras o contornos, ni separar los fantasmas más de lo indicado.

## En la web

En `index.html` el logo va inline, en tres capas: dos `.l-ghost` y una `.l-main`.

- Al cargar la página, la traza se dibuja y los fantasmas entran con un golpe de glitch (`heroIntro` en `src/motion.js`).
- Al pasar el ratón, la traza se redibuja.
- Mientras suena la ATH-16, los fantasmas tiemblan.
- Con movimiento reducido, el logo aparece estático.

## Pendiente

- Hacer una búsqueda de marcas registradas antes de cualquier uso comercial.
- Cuando haya dominio, poner la URL absoluta en `og:image`. Las redes sociales no aceptan rutas relativas.
