import { useEffect, useRef } from 'react';

/** Runs callback every delay ms, cleaned up on unmount */
export const useInterval = (callback: () => void, delay: number): void => {
  const saved = useRef<() => void>(callback);

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!delay) return;
    const id = setInterval(() => saved.current?.(), delay);
    return () => clearInterval(id);
  }, [delay]);
};
