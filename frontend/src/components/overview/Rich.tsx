/** Renders a string where `backticked` segments become inline mono code. */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) =>
        i % 2 ? (
          <code key={i} className="mono rounded bg-surface-2 px-1 py-px text-[12px] text-ink">
            {part}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
