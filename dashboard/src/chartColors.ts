// Visually distinct colors for overlaying multiple factor lines
const COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#a855f7", // violet
  "#84cc16", // lime
  "#e11d48", // rose
  "#0ea5e9", // sky
  "#d946ef", // fuchsia
  "#eab308", // yellow
  "#6366f1", // indigo
];

export function getColor(index: number): string {
  return COLORS[index % COLORS.length];
}

export default COLORS;
