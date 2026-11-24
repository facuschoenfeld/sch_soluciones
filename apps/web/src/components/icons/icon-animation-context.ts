import { createContext } from 'react';

/**
 * Si los íconos animados responden al puntero y al foco. El panel lo apaga: sus íconos quedan
 * estáticos aunque use componentes compartidos con el sitio (ej. "Reintentar" de `QueryError`).
 */
export const IconAnimationContext = createContext(true);
