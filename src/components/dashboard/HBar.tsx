/**
 * A horizontal bar: the length is only the proportion. Whatever it stands for is written next to it
 * in text, so the bar is never the only way to read a figure. `tone` picks a chart token.
 */
export default function HBar({ ratio, tone = 'brand', label }: { ratio: number; tone?: 'brand' | 'neutral'; label?: string }) {
  const width = `${Math.min(100, Math.max(ratio * 100, ratio > 0 ? 1 : 0))}%`;
  return (
    <div className="ka-hbar" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <i data-tone={tone} style={{ width }} />
    </div>
  );
}
