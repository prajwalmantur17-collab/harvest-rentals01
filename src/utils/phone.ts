/** Remove spaces, dashes and brackets; keep digits and one leading "+". */
export function normalizePhone(input: string): string {
  const trimmed = input.trim()
  const plus = trimmed.startsWith('+') ? '+' : ''
  let digits = trimmed.replace(/\D/g, '')
  // 0 + 10-digit mobile number (trunk prefix) -> 10 digits
  if (!plus && digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return plus + digits
}

export function isValidPhone(input: string): boolean {
  return /^\+?[0-9]{10,13}$/.test(normalizePhone(input))
}

/** International digits for wa.me and tel: links. Bare 10-digit numbers are treated as Indian (+91). */
export function toInternationalDigits(phone: string): string {
  const n = normalizePhone(phone)
  const digits = n.replace(/\D/g, '')
  if (n.startsWith('+')) return digits
  if (digits.length === 10) return `91${digits}`
  return digits
}

export function toTelHref(phone: string): string {
  return `tel:+${toInternationalDigits(phone)}`
}

export function toWhatsAppHref(phone: string, text?: string): string {
  const base = `https://wa.me/${toInternationalDigits(phone)}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}
