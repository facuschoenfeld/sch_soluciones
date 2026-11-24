---
name: SCH Soluciones
description: Desarrollo de software y servicio técnico de PC, con precios a la vista y contacto por WhatsApp.
colors:
  signal-blue: 'oklch(0.488 0.243 264.376)'
  signal-blue-dark: 'oklch(0.707 0.165 254.624)'
  focus-blue: 'oklch(0.546 0.245 262.881)'
  blue-wash: 'oklch(0.932 0.032 255.585)'
  whatsapp-green: 'oklch(0.527 0.154 150.069)'
  whatsapp-green-deep: 'oklch(0.448 0.119 151.328)'
  error-red: 'oklch(0.577 0.245 27.325)'
  error-red-text: 'oklch(0.505 0.213 27.518)'
  error-red-dark: 'oklch(0.704 0.191 22.216)'
  paper-white: 'oklch(1 0 0)'
  slate-ink: 'oklch(0.208 0.042 265.755)'
  slate-mist: 'oklch(0.968 0.007 247.896)'
  slate-pencil: 'oklch(0.446 0.043 257.281)'
  hairline: 'oklch(0.929 0.013 255.508)'
  field-edge: 'oklch(0.554 0.046 257.417)'
  night-slate: 'oklch(0.129 0.042 264.695)'
  night-raise: 'oklch(0.279 0.041 260.031)'
  night-chalk: 'oklch(0.984 0.003 247.858)'
  night-pencil: 'oklch(0.704 0.04 256.788)'
  night-hairline: 'oklch(1 0 0 / 10%)'
typography:
  display:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 'clamp(2.25rem, 1.75rem + 2.5vw, 4rem)'
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: '-0.03em'
  headline:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: '1.875rem'
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: '-0.025em'
  title:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: '1.125rem'
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 500
    lineHeight: 1
  price:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: '1.25rem'
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: '-0.025em'
    fontFeature: "'tnum'"
  badge:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1.33
rounded:
  sm: '6px'
  md: '8px'
  lg: '10px'
  xl: '14px'
  2xl: '16px'
  full: '9999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  card: '20px'
  lg: '24px'
  xl: '32px'
  section: '64px'
  hero: '96px'
components:
  button-primary:
    backgroundColor: '{colors.signal-blue}'
    textColor: '{colors.paper-white}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '44px'
  button-whatsapp:
    backgroundColor: '{colors.whatsapp-green}'
    textColor: '{colors.paper-white}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '44px'
  button-whatsapp-hover:
    backgroundColor: '{colors.whatsapp-green-deep}'
  button-outline:
    backgroundColor: '{colors.paper-white}'
    textColor: '{colors.slate-ink}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '44px'
  button-outline-hover:
    backgroundColor: '{colors.blue-wash}'
  card:
    backgroundColor: '{colors.paper-white}'
    textColor: '{colors.slate-ink}'
    rounded: '{rounded.xl}'
    padding: '20px'
  input:
    backgroundColor: '{colors.paper-white}'
    textColor: '{colors.slate-ink}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '4px 12px'
    height: '44px'
  badge-category:
    backgroundColor: '{colors.slate-mist}'
    textColor: '{colors.slate-ink}'
    typography: '{typography.badge}'
    rounded: '{rounded.full}'
    padding: '2px 8px'
  chip-category:
    backgroundColor: '{colors.slate-mist}'
    textColor: '{colors.slate-ink}'
    typography: '{typography.body-small}'
    rounded: '{rounded.full}'
    padding: '4px 12px'
  chip-filter:
    backgroundColor: '{colors.paper-white}'
    textColor: '{colors.slate-ink}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: '0 16px'
    height: '44px'
  chip-filter-active:
    backgroundColor: '{colors.signal-blue}'
    textColor: '{colors.paper-white}'
  cta-band:
    backgroundColor: '{colors.signal-blue}'
    textColor: '{colors.paper-white}'
    rounded: '{rounded.2xl}'
    padding: '40px 24px'
  whatsapp-fab:
    backgroundColor: '{colors.whatsapp-green}'
    textColor: '{colors.paper-white}'
    rounded: '{rounded.full}'
    size: '56px'
---

# Design System: SCH Soluciones

## Overview

**Creative North Star: "La mesa de trabajo"**

El sistema se parece a un banco de taller prolijo: cada herramienta en su lugar, nada que no sirva y todo al alcance de la mano. Sobre una base gris pizarra casi neutra, un único azul marca dónde actuar y un verde reservado abre WhatsApp. El sitio se siente **prolijo, técnico y directo**: confianza por precisión, no por adorno.

La densidad es media y regular. Las superficies son blancas (o pizarra profunda en modo oscuro), separadas por bordes finos y sombras casi imperceptibles. La tipografía es una sola familia, Inter, y la jerarquía sale del peso y del tamaño, no de cambios de fuente. El precio y la acción siguiente siempre son visibles: el diseño los pone adelante y se corre del medio.

El sistema rechaza tres cosas, confirmadas por el dueño:

- **La plantilla genérica**: gradientes llamativos, ilustraciones 3D y frases vacías de landing.
- **La estética gamer/RGB**: neón, negros con brillos, tipografías agresivas.
- **Lo corporativo frío**: fotos de stock y tono institucional.

**Key Characteristics:**

- Un solo acento de marca (Azul Señal) sobre neutros pizarra.
- Verde exclusivo para WhatsApp.
- Superficies casi planas: borde fino, sombra mínima, que sube solo al pasar el mouse o en lo que flota.
- Inter en todos los niveles; títulos en negrita con interletra apenas cerrada.
- Esquinas suaves y consistentes (8 px en controles, 14 px en tarjetas).
- Objetivos táctiles de 44 px y foco visible en todo.
- Modo claro y oscuro con los mismos roles.

## Colors

Neutros pizarra con un único azul de acción y un verde que solo significa "escribir por WhatsApp". Todos los valores son OKLCH, el formato canónico del proyecto (`src/index.css`).

### Primary

- **Azul Señal** (`signal-blue`; en oscuro, `signal-blue-dark`): el color que marca dónde actuar.
  - Dónde se usa: botón principal, links activos de la navegación, el cuadrado del logo, el número de paso en "Cómo funciona", la banda final de llamado a la acción y los estados de trabajo avanzados (Terminado, Entregado).
  - En modo oscuro se aclara para mantener el contraste, y el texto encima pasa a pizarra noche.
- **Azul Foco** (`focus-blue`): solo para el aro de foco. Garantiza al menos 3:1 contra fondo blanco y tarjetas.
- **Lavado Azul** (`blue-wash`): fondo del hover de botones secundarios y el tinte del degradado del hero (al 60 %, hacia el fondo).

### Secondary

- **Verde WhatsApp** (`whatsapp-green`, hover `whatsapp-green-deep`): los botones que abren el diálogo de WhatsApp (el principal del hero, "Consultar" en las tarjetas y el botón flotante). Única excepción: sobre la banda final Azul Señal, el botón de WhatsApp usa la variante secundaria (Bruma Pizarra), porque verde sobre azul no se lee. El hover oscurece y nunca aclara, para que el texto blanco conserve al menos 4.5:1. Es igual en los dos modos.

### Tertiary

- **Rojo Error** (`error-red`; texto sobre tinte `error-red-text`; en oscuro `error-red-dark`): errores de campo, acciones destructivas y el estado "Sin pagar". Sobre fondos tintados se usa la variante de texto para cumplir el contraste AA.

### Neutral

- **Papel** (`paper-white`): fondo y tarjetas en modo claro.
- **Tinta Pizarra** (`slate-ink`): texto principal en claro. En oscuro es la superficie de tarjetas y diálogos.
- **Bruma Pizarra** (`slate-mist`): fondos apagados como badges de categoría, chips, bandas alternas al 40 % y skeletons.
- **Lápiz Pizarra** (`slate-pencil`): texto secundario (descripciones, ayudas, metadatos). Tiene al menos 4.5:1 sobre fondo y tarjetas.
- **Línea Fina** (`hairline`): bordes de tarjetas, separadores y header.
- **Canto de Campo** (`field-edge`): borde de inputs, selects y chips. Tiene al menos 3:1 contra el fondo (WCAG 1.4.11), más marcado que Línea Fina a propósito.
- **Pizarra Noche** (`night-slate`): fondo en modo oscuro.
- **Relieve Noche** (`night-raise`): superficies apagadas y hover en oscuro.
- **Tiza** (`night-chalk`): texto principal en oscuro.
- **Lápiz Noche** (`night-pencil`): texto secundario en oscuro.
- **Línea Noche** (`night-hairline`): bordes en oscuro (blanco al 10 %).

### Named Rules

**La Regla del Verde Reservado.** El verde significa WhatsApp y nada más. No se usa para éxito, "pagado", confirmaciones ni decoración. Si un botón verde no abre WhatsApp, está mal.

**La Regla de la Señal Única.** El azul es el único acento de marca. No se agregan segundos acentos ni paletas por categoría. Las categorías se distinguen por ícono y nombre, no por color.

**La Regla del Estado Legible.** El color nunca es la única pista. Cada estado (de trabajo, de pago o de error) lleva texto e ícono además del tono.

## Typography

**Display Font:** Inter Variable (con `ui-sans-serif`, `system-ui`, `-apple-system`, Segoe UI y Roboto)
**Body Font:** Inter Variable (la misma pila)

**Character:** Una sola familia autoalojada, sin terceros. Títulos en negrita con interletra apenas cerrada (`-0.025em`) y texto corrido neutro. La voz técnica sale de la disciplina tipográfica, no de una fuente "con personalidad".

### Hierarchy

- **Display** (700; fluido `clamp(2.25rem, 1.75rem + 2.5vw, 4rem)`: ≈38 px en celular, ≈60 px a 1280 px y 64 px desde 1440 px; interlineado 1.05; `-0.03em`): solo el título del hero. Con `text-balance`. La parte en `vw` se mantiene chica frente a la de rem porque no crece con el zoom (WCAG 1.4.4). Como el título se edita desde el panel, corta palabras largas (`overflow-wrap: break-word` y guiones) para no generar scroll horizontal a 320 px.
- **Headline** (700; 1.5 rem en celular y 1.875 rem desde 640 px; ≈1.2; `-0.025em`): títulos de sección ("¿Qué necesitás?", "Servicios destacados") y encabezados de página del panel.
- **Title** (600; 1.125 a 1.25 rem; 1.375): nombre del servicio en la tarjeta, títulos de las tarjetas de línea y de las secciones de formularios.
- **Price** (700; 1.25 rem; `-0.025em`; cifras tabulares): el monto del servicio, un paso por encima del nombre. La unidad ("por equipo") lo sigue en Body small con Lápiz Pizarra, en línea (no flex, que descarta el espacio) y sin cortes internos, para que se lea de corrido y baje entera si no entra.
- **Body** (400; 1 rem; 1.5): texto corrido. El subtítulo del hero sube a 1.125-1.25 rem en Lápiz Pizarra, con interlineado amplio (1.625) y hasta 672 px de ancho. Las descripciones en markdown usan interlineado amplio (`leading-relaxed`).
- **Body small** (400; 0.875 rem; ≈1.43): descripciones de tarjetas, ayudas de campos y metadatos.
- **Label** (500; 0.875 rem; interlineado 1): labels de formularios, botones y navegación.
- **Badge** (500; 0.75 rem): badges de categoría y de estado.

### Named Rules

**La Regla de Una Sola Familia.** Inter para todo. La jerarquía se arma con peso (400, 500, 600 y 700) y tamaño, nunca con una segunda fuente decorativa.

**La Regla del Precio con Peso.** El monto de un servicio va en Price (700, 1.25 rem, cifras tabulares), un paso más grande que el nombre y en el color del texto principal; nunca apagado ni en letra chica. Solo la unidad baja a texto secundario.

## Layout

- **Contenedor**:
  - Sitio público: centrado, de hasta 1152 px (`max-w-6xl`) con 16 px de margen lateral.
  - Lectura (detalle de servicio): 768 px (`max-w-3xl`). Formularios del panel: también 768 px.
  - Panel: barra lateral fija de 256 px desde 1024 px; por debajo, menú en hoja lateral.
- **Ritmo vertical**:
  - Secciones del inicio separadas por 64 px (`py-16`); el hero llega a 96 px desde 640 px.
  - Las bandas alternas usan Bruma Pizarra al 40 % con borde fino arriba y abajo, en lugar de sombras.
- **Grillas**:
  - Servicios: 1 columna en celular, 2 desde 640 px y 3 desde 1024 px, con 16 px de separación.
  - Líneas de servicio: 2 columnas desde 768 px.
  - Formularios: campos lado a lado desde 640 px. En grillas de 3 columnas, 2 en pantallas medianas y 3 desde 1024 px, para que los labels no se partan.
- **Espaciado**:
  - Escala de 4 px. Dentro de un campo, 8 px; entre campos y tarjetas, 16 px.
  - Relleno interno: 20 px en tarjetas de servicio y 24 px en tarjetas de línea y secciones de formulario.
- **Header**: sticky, de 64 px (`--sticky-header-height`), translúcido con desenfoque. La reserva de scroll (`scroll-padding-top`) se calcula de esa misma variable.
- **Mobile-first**: todo se diseña primero a 360-390 px. Botones y links interactivos de al menos 44 px de alto. Única excepción: los links del nav de escritorio (≈36 px, desde 768 px, donde se usa mouse).

- **Movimiento** (decidido con el usuario, noviembre de 2026): el movimiento acompaña estados, no decora.
  - **Entrada del hero**: el título aparece palabra por palabra (600 ms, demora de 45 ms por palabra con tope de 8 pasos). Es el único momento focal de la portada.
  - **Aparición al scrollear** (`.reveal`, `lib/reveal-on-scroll.ts`): títulos de sección, tarjetas, pasos y la banda final suben 1.5 rem y aparecen (700 ms) una sola vez al entrar en pantalla; los que entran juntos se escalonan 80 ms (tope de 4 pasos). Se ocultan solo si el script corrió (`html.reveal-ready`) y sin "reducir movimiento". El hero no la lleva. Un elemento con el foco de teclado adentro se muestra aunque no haya entrado. (Se probó antes una versión ligada al scroll con `animation-timeline`: se descartó porque, al terminar en el borde inferior de la pantalla, no se notaba.)
  - **Respuestas**: la tarjeta de servicio tiñe el borde de azul y avanza su flecha al apuntar o enfocar, sin moverse. El botón principal del hero avanza la flecha y cede al 98 % al presionar. Los chips de filtro se rellenan de azul desde el centro.
  - Easing `cubic-bezier(0.16, 1, 0.3, 1)` para respuestas y entradas. Con "reducir movimiento" no hay desplazamientos; quedan solo fundidos o cambios de color.

## Elevation & Depth

Casi plano. Las superficies descansan con un borde fino (Línea Fina) y una sombra mínima; la profundidad la dan los bordes y los cambios de tono, no las sombras. La sombra sube solo como respuesta: al pasar el mouse sobre una tarjeta clickeable, o en lo que realmente flota sobre el contenido.

### Shadow Vocabulary

- **Reposo de control** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`, `shadow-xs`): inputs, selects y botones con borde.
- **Reposo de tarjeta** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`, `shadow-sm`): tarjetas de servicio, de línea y secciones del panel.
- **Tarjeta en hover** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`, `shadow-md`): solo tarjetas clickeables al pasar el mouse.
- **Flotante** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`, `shadow-lg`): diálogos, hojas laterales, el botón flotante de WhatsApp, el aviso de carga lenta y las barras fijas del panel.

### Named Rules

**La Regla del Plano por Defecto.** En reposo, las superficies son planas. Una sombra más fuerte que `shadow-sm` solo aparece por estado (hover) o porque el elemento flota de verdad (diálogo, botón flotante, barra fija).

## Shapes

Esquinas suaves y consistentes, derivadas de un radio base de 10 px:

- **Controles**: 8 px en botones, inputs y selects; 6 px en elementos chicos y focos de links.
- **Contenedores**: 14 px en tarjetas y secciones; 16 px en la banda final de llamado a la acción y el aviso de carga lenta.
- **Diálogos**: 10 px.
- **Píldoras**: badges, chips de categoría, botón flotante de WhatsApp y número de paso.

Los íconos son de lucide, de trazo de 2 px y puntas redondeadas, a 16 px en botones y 20-24 px en encabezados de tarjeta. Van solos o dentro de un cuadrado de 8-10 px de radio con fondo Azul Señal. El logo provisorio (llave inglesa sobre cuadrado azul) sigue esa misma forma.

## Components

### Buttons

Firmes y sobrios: se ven sólidos, responden claro y no llaman la atención sin motivo.

- **Shape:** esquinas suaves (8 px). En la práctica, todos los botones del sitio y del panel llevan alto mínimo de 44 px (`min-h-11`).
- **Primary:** fondo Azul Señal con texto blanco, Label (500, 0.875 rem), 16 px de relleno lateral e ícono de 16 px a 8 px del texto. El hover baja la opacidad del fondo al 90 %.
- **WhatsApp:** fondo Verde WhatsApp con texto blanco y el ícono de burbuja de chat. El hover pasa a `whatsapp-green-deep` (más oscuro). Es la acción principal de cada tarjeta y del hero.
- **Outline:** fondo del lienzo, borde fino y sombra de control. El hover pasa a Lavado Azul. Es la acción secundaria ("Ver detalle", "Cancelar").
- **Ghost / Link:** ghost para botones de ícono (tema, menú); link en Azul Señal con subrayado en hover ("Ver todos los servicios", "Volver").
- **Focus:** borde Azul Foco con un aro de 3 px al 50 %. Deshabilitado: 50 % de opacidad. Los botones que guardan en línea usan `aria-disabled` en lugar de `disabled`, para no perder el foco.

### Chips

- **Style:** píldora Bruma Pizarra con ícono de 14 px y texto de 0.875 rem. Se usa para listar las categorías dentro de cada tarjeta de línea.
- **Filtros del listado** (línea y categoría): botones píldora de 44 px de alto con 16 px de relleno lateral, Label y `aria-pressed`. Sin seleccionar: fondo del lienzo, borde Canto de Campo y hover en Bruma Pizarra. Seleccionado: fondo y borde Azul Señal con texto blanco.

### Cards / Containers

- **Corner Style:** 14 px.
- **Background:** Papel en claro y Tinta Pizarra en oscuro.
- **Shadow Strategy:** reposo de tarjeta; hover a "tarjeta en hover" solo si toda la tarjeta es clickeable (ver Elevation & Depth).
- **Border:** Línea Fina, siempre.
- **Internal Padding:** 20 px en la tarjeta de servicio y 24 px en las tarjetas de línea y las secciones del panel.
- **Tarjeta clickeable:** el link vive solo en el título y su pseudo-elemento cubre la tarjeta. El foco se dibuja sobre la tarjeta entera, con un contorno de 2 px desplazado 2 px.

### Inputs / Fields

- **Style:**
  - Borde Canto de Campo de 1 px, fondo transparente (en oscuro, Canto de Campo al 30 %), radio de 8 px y 44 px de alto.
  - Texto de 1 rem en celular (evita el zoom de iOS) y 0.875 rem desde 768 px.
  - Los selects son nativos, con un chevron de 16 px en Lápiz Pizarra.
- **Montos:** el símbolo ("$" o "US$") va dentro del campo, a la izquierda y en Lápiz Pizarra, para que el borde izquierdo coincida con los campos vecinos.
- **Focus:** borde Azul Foco con un aro de 3 px al 50 %.
- **Error / Disabled:** en error, borde Rojo Error con aro rojo al 20 % y mensaje debajo en 0.875 rem, peso 500. Los avisos que no bloquean llevan ícono de triángulo en `error-red-text`. Excepción pendiente de unificar: el aviso del número de WhatsApp en Configuración usa ámbar suelto (`business-settings-form.tsx`). Deshabilitado: 50 % de opacidad.
- **Campo compuesto:** label arriba, control, ayuda y error, siempre alineados arriba en grillas de varias columnas.

### Navigation

- **Header público:**
  - Sticky de 64 px, fondo del lienzo al 75-90 % con desenfoque y borde inferior fino.
  - Logo: cuadrado Azul Señal de 32 px con la llave inglesa, más el nombre del negocio en 600.
  - Links en Label con relleno de 12 × 8 px y radio de 8 px. Inactivos en Lápiz Pizarra; hover en Bruma Pizarra con texto principal; activo en Azul Señal.
  - Debajo de 768 px, botón de menú de 44 px que abre una hoja lateral con links de 1 rem.
- **Panel:** barra lateral de 256 px en Bruma Pizarra al 40 %, con links de 44 px de alto.

### Botón flotante de WhatsApp

El elemento más reconocible del sitio: un círculo Verde WhatsApp de 56 px con el ícono de burbuja de chat y sombra flotante, fijo abajo a la derecha (16 px, respetando el área segura). Está en todas las páginas públicas y abre el mismo diálogo de mensaje editable que los demás botones verdes.

### Tarjeta de servicio

De arriba abajo:

1. Badges (la categoría en Bruma Pizarra y "Destacado" con borde).
2. Nombre en Title.
3. Descripción corta en Body small.
4. Monto en Price con la unidad en chico al lado y, si hay, tiempo estimado con ícono de reloj.
5. Dos botones del mismo ancho: "Consultar" (WhatsApp) y "Ver detalle" (outline).

El bloque de precio se empuja al fondo para que las tarjetas de una fila alineen precios y botones.

## Do's and Don'ts

### Do:

- **Do** usar Azul Señal como único acento de marca: acción principal, navegación activa y logo.
- **Do** reservar Verde WhatsApp para lo que abre WhatsApp (botón flotante, "Consultar" y el botón del hero), con hover más oscuro (`whatsapp-green-deep`).
- **Do** mostrar el monto en Price (700, 1.25 rem, cifras tabulares) en el color del texto principal, con la unidad en texto secundario, siempre visible en la tarjeta sin entrar al detalle.
- **Do** dar 44 px de alto mínimo a todo lo que se toca (salvo el nav de escritorio), y foco visible (borde Azul Foco con aro de 3 px, o contorno de 2 px desplazado 2 px).
- **Do** acompañar cada estado de color con texto e ícono de lucide.
- **Do** separar superficies con borde Línea Fina y bandas de Bruma Pizarra al 40 % antes que con sombras.
- **Do** definir todo color nuevo como token en `src/index.css`, con su par de modo oscuro, y verificar AA (4.5:1 en texto, 3:1 en bordes de controles y foco).

### Don't:

- **Don't** parecer una plantilla genérica: nada de gradientes llamativos, ilustraciones 3D ni frases vacías de landing. El único degradado permitido es el lavado tenue del hero (Lavado Azul al 60 % hacia el fondo).
- **Don't** caer en estética gamer/RGB: ni neón, ni brillos sobre negro, ni tipografías agresivas. El modo oscuro es pizarra azulada, no negro puro.
- **Don't** usar fotos de stock ni tono corporativo frío. Solo fotos y proyectos reales del dueño, cuando estén.
- **Don't** usar el verde para éxito, "pagado" o confirmaciones; esos estados van en azul o pizarra con ícono.
- **Don't** usar sombras por encima de `shadow-sm` en reposo; `shadow-lg` es solo para lo que flota.
- **Don't** agregar una segunda familia tipográfica ni pesos por debajo de 400.
- **Don't** usar colores de Tailwind sueltos (`text-amber-700`, `bg-green-500`) en lugar de los tokens del sistema.
