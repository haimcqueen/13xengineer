import { motion } from "motion/react";

type Props = {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
};

const ease = [0.22, 1, 0.36, 1] as const;

export default function Sparkline({
  values,
  width = 220,
  height = 60,
  stroke = "#574F61",
}: Props) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * (height - 8) - 4;
    return [x, y] as const;
  });
  const d = points
    .map(([x, y], i) => (i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`))
    .join(" ");
  const area = `${d} L ${width} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1E5BC9" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#1E5BC9" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill="url(#spark-fill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 1.0, ease }}
      />
      <motion.path
        d={d}
        stroke={stroke}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, delay: 0.4, ease }}
      />
      <motion.circle
        cx={last[0]}
        cy={last[1]}
        fill="#1E5BC9"
        initial={{ r: 0 }}
        animate={{ r: 3 }}
        transition={{ duration: 0.45, delay: 1.55, ease }}
      />
      <motion.circle
        cx={last[0]}
        cy={last[1]}
        fill="#1E5BC9"
        initial={{ r: 3, opacity: 0 }}
        animate={{ r: [3, 11], opacity: [0.35, 0] }}
        transition={{
          duration: 2.2,
          delay: 1.7,
          repeat: Infinity,
          ease: "easeOut",
        }}
      />
    </svg>
  );
}
