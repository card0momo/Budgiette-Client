const MERCHANT_ICON_RULES: Array<{ pattern: RegExp; emoji: string }> = [
  { pattern: /steam/i, emoji: '🎮' },
  { pattern: /oxxo/i, emoji: '🏪' },
  { pattern: /punta del cielo|cafe|café|starbucks/i, emoji: '☕' },
  { pattern: /didi|uber|indriver/i, emoji: '🚗' },
  { pattern: /netflix|spotify|hbo|disney/i, emoji: '🎬' },
  { pattern: /amazon|mercado ?libre/i, emoji: '📦' },
  { pattern: /walmart|soriana|chedraui|costco/i, emoji: '🛒' },
  { pattern: /farmacia|salud|hospital/i, emoji: '💊' },
  { pattern: /transferencia|spei|transfer/i, emoji: '🔁' },
];

const DEFAULT_MERCHANT_EMOJI = '💳';

export function getMerchantEmoji(merchantName: string, description = ''): string {
  const haystack = `${merchantName} ${description}`;
  const rule = MERCHANT_ICON_RULES.find((item) => item.pattern.test(haystack));
  return rule ? rule.emoji : DEFAULT_MERCHANT_EMOJI;
}
