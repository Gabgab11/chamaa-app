/** The MyChamaa wordmark: "my" in electric blue, "chamaa" in the text colour. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`wordmark${className ? ` ${className}` : ''}`} aria-label="MyChamaa">
      <span className="wm-my" aria-hidden="true">my</span><span aria-hidden="true">chamaa</span>
    </span>
  );
}
