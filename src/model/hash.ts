export function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function powerCable(volts: number, amps: number): string {
  if (volts >= 10000) {
    const size = amps > 420 ? 500 : amps > 320 ? 400 : 300;
    return `11 kV XLPE 3×1C ${size} mm²`;
  }
  if (volts >= 3000) {
    const size = amps > 280 ? 240 : amps > 180 ? 185 : amps > 120 ? 120 : 70;
    return `3.3 kV XLPE 3C ${size} mm²`;
  }
  const size =
    amps > 220 ? 185 : amps > 150 ? 120 : amps > 110 ? 95 : amps > 80 ? 70 : amps > 55 ? 50 : amps > 40 ? 35 : amps > 28 ? 25 : amps > 18 ? 16 : amps > 12 ? 10 : 6;
  return `0.6/1 kV XLPE 4C ${size} mm²`;
}

export function flcAmps(kw: number, volts: number, pf: number, eff: number): number {
  return (kw * 1000) / (Math.sqrt(3) * volts * pf * Math.max(eff, 0.5));
}
