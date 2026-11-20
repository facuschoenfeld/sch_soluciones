/**
 * Si el elemento con foco desapareció (ej. se archivó una fila que el filtro oculta), el foco
 * cae en <body> y un usuario de teclado pierde su lugar: se lo lleva al contenido principal.
 */
export function focusMainIfLost(): void {
  requestAnimationFrame(() => {
    if (document.activeElement === document.body || document.activeElement === null) {
      document.getElementById('main')?.focus({ preventScroll: true });
    }
  });
}

/** Para `onCloseAutoFocus` de un diálogo cuyo disparador ya no existe (se borró el ítem). */
export function focusMainOnClose(event: Event): void {
  event.preventDefault();
  document.getElementById('main')?.focus({ preventScroll: true });
}
