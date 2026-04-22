import { useEffect, useRef, useState } from 'react';

/**
 * Renders children only when the element scrolls into view (IntersectionObserver).
 * Until then, shows a skeleton placeholder of the same height.
 * @param {number} minHeight - placeholder height while not yet visible
 * @param {number} delay     - extra ms to wait after becoming visible (default 0)
 */
export default function ChartWrapper({ children, minHeight = 320, delay = 0 }) {
  const ref  = useRef(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If already in viewport at mount time, skip observer
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 400) {
      const id = delay ? setTimeout(() => setShow(true), delay) : null;
      if (!delay) setShow(true);
      return () => id && clearTimeout(id);
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        if (delay) setTimeout(() => setShow(true), delay);
        else setShow(true);
      },
      { rootMargin: '300px 0px' }   // start loading 300px before visible
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);

  return (
    <div ref={ref}>
      {show
        ? children
        : <div className="chart-skeleton" style={{ height: minHeight }} />
      }
    </div>
  );
}
