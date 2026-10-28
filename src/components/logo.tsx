// Hand-drawn logo from the landing page.
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 44" aria-hidden="true" className={className}>
      <path
        d="M8 6 C 18 4, 30 5, 38 7 C 40 17, 39 28, 37 38 C 26 40, 15 39, 6 37 C 5 27, 6 16, 8 6 Z"
        className="fill-yellow stroke-ink"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle
        cx="22"
        cy="18"
        r="5.5"
        fill="none"
        className="stroke-ink"
        strokeWidth="2.5"
      />
      <path
        d="M12 33 C 14 26, 30 26, 32 33"
        fill="none"
        className="stroke-ink"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
