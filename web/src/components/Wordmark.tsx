/** The My Chaama wordmark: "my" in electric blue, "chaama" in the text colour. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`wordmark${className ? ` ${className}` : ''}`} aria-label="My Chaama">
      <span className="wm-my" aria-hidden="true">my</span><span aria-hidden="true">chaama</span>
    </span>
  );
}
