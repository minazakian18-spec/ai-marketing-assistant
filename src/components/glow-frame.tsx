// Travelling light for AI inputs (dashboard composer and Mavix Agent). Pure
// CSS (motion.css): a soft light moves along the rounded perimeter at a
// constant speed (offset-path) and is only visible inside a 1px band on the
// existing border. The streak is made of a few overlapping segments that
// follow each other on the path, so a long light bends around the corners
// instead of being cut off. Decorative only; no state, no re-renders.
const SEGMENTS = [0, 1, 2, 3, 4];

function Streak() {
  return (
    <>
      {SEGMENTS.map((i) => (
        <span key={i} className="mx-light" style={{ ["--i" as string]: i }} />
      ))}
    </>
  );
}

export function GlowFrame() {
  return (
    <span className="mx-frame" aria-hidden="true">
      <span className="mx-ring">
        <Streak />
      </span>
      <span className="mx-halo">
        <Streak />
      </span>
    </span>
  );
}
