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
