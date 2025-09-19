export function colorFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  const hex = ((h >>> 0) & 0xffffff).toString(16).padStart(6, "0");
  return `#${hex}`;
}

export function hexToRgba(hex: string, alpha = 0.2): string {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function randomColor(): string {
  const colors = ["#ff6b6b", "#6bc1ff", "#51d88a", "#fbbf24", "#9b5de5"];
  return colors[Math.floor(Math.random() * colors.length)];
}
