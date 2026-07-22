interface Props {
  value: number; // 0-100
  label: string;
  size?: number;
}

export function ScoreGauge({ value, label, size = 120 }: Props) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const tone =
    value >= 85
      ? "text-status-success"
      : value >= 60
        ? "text-status-warning"
        : "text-status-error";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={8}
            className="stroke-border fill-none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`fill-none transition-all ${tone}`}
            style={{ stroke: "currentColor" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-semibold ${tone}`}>{value}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            /100
          </span>
        </div>
      </div>
      <div className="text-[12px] font-medium text-foreground">{label}</div>
    </div>
  );
}
