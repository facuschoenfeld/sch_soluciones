# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Visitantes del sitio público** (prioridad principal). Llegan desde la cuenta de Instagram del negocio o desde un link compartido por WhatsApp, casi siempre desde el celular. Son de la zona: el alcance es local y el tráfico, bajo. Hay dos públicos que pesan **por igual** (confirmado):
  - **Particulares con un problema de PC**: lenta, rota, para formatear, instalar Windows, limpiar o armar. Quieren saber cuánto cuesta y escribir rápido.
  - **Comercios y emprendedores** que necesitan una página web o una aplicación de escritorio a medida. Quieren entender qué se ofrece, el precio de referencia y consultar.
  - La tarea de los dos: encontrar el servicio, ver el precio y contactar por WhatsApp para reservar un turno o hacer una consulta.
- **El dueño (único admin)**: un profesional independiente de Argentina. Usa el panel privado (`/admin`) para mantener el catálogo y los precios, y como mini CRM para registrar clientes, trabajos, cobros y próximos turnos. Lo usa a diario, en la PC o el celular, entre trabajo y trabajo.

## Product Purpose

SCH Soluciones es el sitio de un profesional independiente con dos líneas de servicio:

- **Desarrollo**: páginas web y aplicaciones de escritorio a medida.
- **Servicio técnico de PC**: mantenimiento, reparación, diagnóstico, formateo, instalación de Windows y armado.

El sitio público muestra los servicios con precios reales y lleva al visitante a una conversación de WhatsApp con un mensaje ya armado y editable. El panel privado reemplaza las planillas y anotaciones sueltas: catálogo, precios, clientes, trabajos y cobros.

El éxito se mide en dos cosas:

- Que un visitante pase de Instagram a un WhatsApp con el servicio ya identificado en pocos toques.
- Que el dueño mantenga precios y registros al día sin tocar código.

## Positioning

Lo que un competidor de la zona no puede copiar tal cual (confirmado por el dueño):

- **Precios a la vista**: precios publicados y claros antes de escribir (fijo, "desde" o "a consultar"), sin pedir presupuesto para todo.
- **Trato directo**: una sola persona; el que responde es el que hace el trabajo.
- **Dos líneas en un mismo lugar**: el mismo profesional arregla la PC y hace la web o el sistema.
- **Respuesta rápida por WhatsApp**: sin formularios ni esperas; el mensaje ya llega armado con el servicio.

## Operating Context

- **Entrada**: link en la bio de Instagram y links compartidos por WhatsApp. La vista previa del link (Open Graph estático en `index.html`) es parte de la primera impresión.
- **Contacto**: siempre por WhatsApp (`wa.me` con mensaje precargado). Hay tres plantillas configurables: reservar turno, hacer una consulta y mensaje general. No hay formulario de contacto ni email saliente.
- **Hosting gratuito** (Render + Neon): el servicio se duerme y el primer acceso puede tardar alrededor de un minuto. La espera tiene que verse cuidada ("Estamos cargando, un momento…").
- **Panel**: se usa en sesiones cortas y frecuentes, como cargar un trabajo que entra, cambiar un estado o registrar un pago. También en sesiones más largas para actualizar precios en masa o exportar clientes y trabajos (PDF o CSV).

## Capabilities and Constraints

- **Sitio público**:
  - Rutas: inicio, servicios (con filtros por línea, categoría y búsqueda), detalle de servicio, contacto y "Sobre mí", y 404.
  - Botón flotante de WhatsApp y diálogo con el mensaje editable.
  - Modo claro y oscuro.
  - Rutas y textos en español (es-AR, con voseo).
- **Panel**:
  - Dashboard, servicios, categorías, clientes, trabajos y configuración.
  - Actualización masiva de precios, exportación y cierre de sesión en todos los dispositivos.
  - Un único admin, sin registro público.
- **Precios**:
  - Tipos: precio fijo, "desde" o "a consultar".
  - Moneda: ARS por defecto, USD opcional por servicio.
  - Formato es-AR (`$ 25.000`).
- **Datos personales** (Ley 25.326): los datos de clientes nunca aparecen en el sitio público.
- **Sin disco persistente**: el sitio no puede depender de archivos subidos. Las imágenes futuras irían a un servicio externo o al build. Los íconos son de lucide.
- **Accesibilidad**: mobile-first, con estados de carga, vacío y error en todas las pantallas. Objetivo de Lighthouse móvil: accesibilidad y buenas prácticas ≥ 90.
- **Sin decidir**:
  - Zona de atención: el seed dice "Zona a definir".
  - Dominio propio: por ahora `*.onrender.com`.
  - Portfolio de proyectos, agenda propia de turnos y testimonios: son una fase opcional, después de producción.

## Brand Commitments

- **Nombre**: SCH Soluciones. Tagline actual: "Desarrollo de software y servicio técnico de PC".
- **Voz**: primera persona del singular y voseo rioplatense ("Escribime por WhatsApp", "Elegí el servicio", "Contame qué necesitás"). Directa, cercana y sin promesas infladas.
- **Logo propio**: el dueño tiene uno (confirmado), pero todavía no está en el repositorio. Hoy solo existe `apps/web/public/favicon.svg`. Hay que pedirlo antes de diseñar una identidad, no inventarlo.

## Evidence on Hand

- **Fotos propias**: el dueño las tiene (confirmado); no están en el repositorio.
- **Proyectos de desarrollo** para mostrar: existen (confirmado); no están en el repositorio ni hay sección de portfolio todavía.
- **Catálogo real**: categorías y servicios con precios cargados desde el panel. El seed trae datos de ejemplo.
- **Sin reseñas ni testimonios de clientes**: no inventar testimonios, cantidad de clientes, años de experiencia ni métricas.

## Product Principles

1. **El precio va adelante.** Si un servicio tiene precio, se ve sin hacer clic; "a consultar" se dice claro, no se esconde.
2. **Cada pantalla termina en WhatsApp.** El camino desde cualquier servicio hasta un mensaje armado es corto y obvio, y el mensaje siempre se puede editar antes de enviarlo.
3. **Una persona, dos oficios, un mismo trato.** Las dos líneas conviven con el mismo peso; ninguna parece un agregado de la otra.
4. **Honestidad antes que impacto.** Solo se muestra material real (fotos, proyectos, precios); nada de pruebas sociales inventadas.
5. **El panel es una herramienta de trabajo.** Rapidez, claridad y cero sorpresas con los datos de clientes y cobros pesan más que la expresión visual.

## Accessibility & Inclusion

- WCAG AA: contraste, labels, foco visible y navegación por teclado completa.
- Objetivos táctiles de al menos 44 px.
- Pensado para celulares de gama media y conexiones móviles: la mayoría del público entra desde Instagram en el celular.
