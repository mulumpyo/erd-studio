const hexByte = (value: string) => Number.parseInt(value, 16)

export const parseCssColor = (value: string): [number, number, number] | null => {
  const color = value.trim()
  const short = color.match(/^#([0-9a-f]{3})$/i)
  if (short?.[1]) {
    const [r, g, b] = short[1]
    return [hexByte(`${r}${r}`), hexByte(`${g}${g}`), hexByte(`${b}${b}`)]
  }
  const long = color.match(/^#([0-9a-f]{6})$/i)
  if (long?.[1]) {
    return [
      hexByte(long[1].slice(0, 2)),
      hexByte(long[1].slice(2, 4)),
      hexByte(long[1].slice(4, 6)),
    ]
  }
  const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  return null
}

const linearize = (channel: number) => {
  const value = channel / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export const isLightColor = (value: string) => {
  const rgb = parseCssColor(value)
  if (!rgb) return false
  const [r, g, b] = rgb
  const luminance =
    0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
  return luminance > 0.62
}

export const safeCssColor = (value: string, fallback = '#3b82f6') =>
  parseCssColor(value) ? value.trim() : fallback

export const toHex6 = (value: string, fallback = '#3b82f6') => {
  const rgb = parseCssColor(value)
  if (!rgb) return fallback
  return `#${rgb.map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

export const rgbToHsv = (
  r: number,
  g: number,
  b: number,
): [number, number, number] => {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6
    else if (max === gg) h = (bb - rr) / d + 2
    else h = (rr - gg) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return [h, s, max]
}

export const hsvToRgb = (
  h: number,
  s: number,
  v: number,
): [number, number, number] => {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ]
}

export const hsvToHex = (h: number, s: number, v: number) => {
  const [r, g, b] = hsvToRgb(h, s, v)
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

export const hexToHsv = (
  value: string,
  fallback: [number, number, number] = [217, 0.76, 0.96],
): [number, number, number] => {
  const rgb = parseCssColor(value)
  if (!rgb) return fallback
  return rgbToHsv(rgb[0], rgb[1], rgb[2])
}
