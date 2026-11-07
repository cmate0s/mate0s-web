# carlos mateos · web personal

Web personal de Carlos Mateos con personalidad de verdad: base limpia a lo Apple,
tonos de papel cálido, Space Grotesk autoalojada, prompt de terminal y un
laboratorio con mis proyectos open source.

100 % estática: HTML + CSS + un poco de JS progresivo. Sin frameworks, sin build,
sin dependencias en runtime. Modo claro y oscuro automáticos.

## Estructura

```
index.html            → toda la página
assets/css/style.css  → el diseño (tokens de color, terminal, animaciones)
assets/js/main.js     → menú móvil, apariencias al scroll, año y huevo de pascua
assets/fonts/         → Space Grotesk (variable, latin, OFL) autoalojada
assets/img/
    carlos-mateos.jpeg   → retrato original (hero y favicon)
    apple-touch-icon.png → icono iOS (retrato)
    favicon-32.png       → favicon (miniatura del retrato)
    favicon.svg          → monograma "cm" (reserva, no enlazada)
```

## Regenerar iconos a partir del retrato

```bash
python3 - <<'EOF'
from PIL import Image
img = Image.open("FotoCarlos.jpeg").convert("RGB")
img.resize((32, 32), Image.LANCZOS).save("assets/img/favicon-32.png")
img.resize((180, 180), Image.LANCZOS).save("assets/img/apple-touch-icon.png")
EOF
```

## Datos reales ya integrados

- Email: cmateos91@gmail.com
- GitHub: https://github.com/cmate0s
- LinkedIn: https://www.linkedin.com/in/carlos-mateos-mart%C3%ADnez
- YouTube: https://youtube.com/@mate0s-dev91
- NeumorStudio: con lo publicado en https://www.neumorstudio.com/

Si algo cambia (email, proyecto de Google Play de Modelito, etc.): buscar en
`index.html` el texto y editarlo.

## Publicación

El repo ya tiene despliegue en `https://mate0s-web.vercel.app` (Vercel, desde este
repo). Si cambias de dominio, actualiza `canonical`, `og:url` y `og:image` en
`index.html` (hay un `TODO-CARLOS` arriba del head).

Sin build: en Netlify/Vercel, build vacío y la raíz como dist. En GitHub Pages
también vale tal cual.

## Accesibilidad

- HTML semántico, "Saltar al contenido", foco visible, contraste AA claro/oscuro.
- Menú móvil con `aria-expanded` (cierra con `Esc`), todo visible sin JS.
- `prefers-reduced-motion` respeta: sin animaciones si las desactivas.
