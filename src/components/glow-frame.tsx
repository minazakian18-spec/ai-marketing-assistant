// Travelling light for AI inputs (dashboard composer and Mavix Agent). Pure
// CSS (motion.css): a soft light moves along the rounded perimeter at a
// constant speed (offset-path) and is only visible inside a 1px band on the
// existing border. Decorative only; no state, no re-renders.
export function GlowFrame() {
  return (
    <span className="mx-frame" aria-hidden="true">
      <span className="mx-ring">
        <span className="mx-light" />
      </span>
      <span className="mx-halo">
        <span className="mx-light" />
      </span>
    </span>
  );
}
