/**
 * PPLA scale characters: '1'–'9' and 'A'–'O' (A=10 … O=24). '0' → 10 (same as the parser).
 */

/** Parses a single PPLA scale character (`h`/`v` etc.) into its numeric multiplier (1-24). */
export function parseScaleChar(char: string): number {
  if (char >= 'A' && char <= 'O') {
    return 10 + (char.charCodeAt(0) - 'A'.charCodeAt(0))
  }
  if (char >= '0' && char <= '9') {
    const n = Number(char)
    if (n === 0) {
      return 10
    }
    return n
  }
  return 1
}

/** Inverse of `parseScaleChar`, used when emitting A7 lines (prefers `0` for value 10). */
export function scaleMultiplierToPplaChar(multiplier: number): string {
  const n = Math.max(1, Math.min(24, Math.floor(multiplier)))
  if (n >= 1 && n <= 9) {
    return String(n)
  }
  if (n === 10) {
    return '0'
  }
  if (n >= 11 && n <= 24) {
    return String.fromCharCode('A'.charCodeAt(0) + (n - 10))
  }
  return '1'
}
