import { useEffect } from 'react';

/**
 * Custom hook to lock scrolling on the body, documentElement, and admin main content area.
 * Keeps track of original styles and restores them when unlocked or unmounted.
 */
export default function useScrollLock(lock: boolean) {
  useEffect(() => {
    if (!lock) return;

    const originalStyles = new Map<HTMLElement, string>();
    const elementsToLock: HTMLElement[] = [document.body, document.documentElement];

    // Find main/scrollable elements
    const mainEl = document.getElementById('admin-main-content') || document.querySelector('main');
    if (mainEl instanceof HTMLElement) {
      elementsToLock.push(mainEl);
    }

    const rootEl = document.getElementById('root');
    if (rootEl) {
      elementsToLock.push(rootEl);
    }

    // Save originals and set overflow to hidden
    elementsToLock.forEach((el) => {
      originalStyles.set(el, el.style.overflow);
      el.style.overflow = 'hidden';
    });

    return () => {
      // Restore originals
      elementsToLock.forEach((el) => {
        const original = originalStyles.get(el);
        if (original !== undefined) {
          el.style.overflow = original;
        } else {
          el.style.overflow = '';
        }
      });
    };
  }, [lock]);
}
