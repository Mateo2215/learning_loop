/**
 * Pure-SVG sparkline for a 1-10 score trend. Server-safe (no client JS).
 */

interface ScoreSparklineProps {
  points: { t: string; score: number }[];
  width?: number;
  height?: number;
}

export function ScoreSparkline({ points, width = 160, height = 40 }: ScoreSparklineProps) {
  if (points.length === 0) return null;

  const n = points.length;
  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const xFor = (i: number) => pad + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  // Score domain 1..10 fixed so visual comparison across materials is honest.
  const yFor = (s: number) => pad + innerH - ((s - 1) / 9) * innerH;

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.score).toFixed(1)}`)
    .join(" ");

  const last = points[points.length - 1];
  const lastX = xFor(n - 1);
  const lastY = yFor(last.score);

  // Color stops on the last point: low/mid/good/great.
  const lastTier =
    last.score <= 3 ? "var(--color-bad)" :
    last.score <= 6 ? "var(--color-warn)" :
    "var(--color-ok)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="block"
    >
      <line
        x1={pad}
        x2={width - pad}
        y1={yFor(7)}
        y2={yFor(7)}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeDasharray="2 3"
      />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeOpacity={0.6} />
      <circle cx={lastX} cy={lastY} r={3} fill={lastTier} />
    </svg>
  );
}
