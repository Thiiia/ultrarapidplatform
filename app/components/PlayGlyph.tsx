/** The visible triangle is centred within the same square in every transport control. */
export function PlayGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M6.5 5.5L17.5 12L6.5 18.5V5.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
