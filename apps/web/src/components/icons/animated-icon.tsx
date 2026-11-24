import type { IconHandle } from '@animateicons/react';
import {
  useContext,
  useEffect,
  useId,
  useRef,
  type ComponentType,
  type CSSProperties,
  type RefAttributes,
} from 'react';
import { cn } from '@/lib/utils';
import { IconAnimationContext } from './icon-animation-context';

/** Props que se usan de los íconos de `@animateicons/react` (todos comparten esta forma). */
interface AnimateIconProps {
  id?: string;
  /** Marca el envoltorio para que `Button` ajuste el relleno como con un svg directo. */
  'data-animated-icon'?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export type AnimateIcon = ComponentType<AnimateIconProps & RefAttributes<IconHandle>>;

/** Elemento que dispara la animación: el link/botón/label que contiene al ícono, o una tarjeta. */
const TRIGGER_SELECTOR = '[data-icon-trigger], a, button, label';

/** `matches` con pseudo-clases que algún entorno (jsdom) podría no soportar. */
function safeMatches(element: Element, selector: string) {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

const hasVisibleFocus = (trigger: HTMLElement) =>
  safeMatches(trigger, ':focus-visible') || safeMatches(trigger, ':has(:focus-visible)');

interface AnimatedIconProps {
  icon: AnimateIcon;
  /** Lado en px. Manda también dentro de `Button` (que fuerza `size-4` a los svg). */
  size?: number;
  className?: string;
}

/**
 * Ícono animado (decorativo) que se anima al apuntar o enfocar con teclado el elemento
 * interactivo que lo contiene, no solo el ícono. Con "reducir movimiento" no se anima (lo
 * resuelve la librería). En táctil no se anima: un toque dejaría el hover "pegado" y los
 * siguientes no volverían a animar. Dentro de `IconAnimationContext` en `false` (el panel) queda
 * estático. La librería envuelve el svg en un `div`.
 */
export function AnimatedIcon({ icon: Icon, size = 16, className }: AnimatedIconProps) {
  const id = useId();
  const iconRef = useRef<IconHandle>(null);
  const enabled = useContext(IconAnimationContext);

  useEffect(() => {
    if (!enabled) return;
    const trigger = document.getElementById(id)?.closest<HTMLElement>(TRIGGER_SELECTOR);
    if (!trigger) return;

    const start = () => iconRef.current?.startAnimation();
    const stop = () => iconRef.current?.stopAnimation();
    const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') start();
    };
    const onPointerLeave = () => {
      if (!hasVisibleFocus(trigger)) stop();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Element && safeMatches(event.target, ':focus-visible')) start();
    };
    const onFocusOut = () => {
      if (!safeMatches(trigger, ':hover')) stop();
    };

    trigger.addEventListener('pointerenter', onPointerEnter);
    trigger.addEventListener('pointerleave', onPointerLeave);
    trigger.addEventListener('focusin', onFocusIn);
    trigger.addEventListener('focusout', onFocusOut);
    return () => {
      trigger.removeEventListener('pointerenter', onPointerEnter);
      trigger.removeEventListener('pointerleave', onPointerLeave);
      trigger.removeEventListener('focusin', onFocusIn);
      trigger.removeEventListener('focusout', onFocusOut);
    };
  }, [id, enabled]);

  return (
    <Icon
      ref={iconRef}
      id={id}
      data-animated-icon=""
      size={size}
      aria-hidden="true"
      className={cn('shrink-0 [&>svg]:size-(--icon-size)!', className)}
      style={{ '--icon-size': `${size}px` } as CSSProperties}
    />
  );
}
