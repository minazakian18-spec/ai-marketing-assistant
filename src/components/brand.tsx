export function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`mavix-brand ${className}`}>
      <img
        className="mavix-mark"
        src="/mavix-mark.svg"
        width={35}
        height={35}
        alt=""
        aria-hidden="true"
      />
      <span className="mavix-wordmark">Mavix</span>
    </span>
  );
}
