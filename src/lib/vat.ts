/** VAT contained in a VAT-inclusive amount (FR-INV-12), rounded to paisa. */
export const vatIn = (amount: number, rate: number) => (rate > 0 ? Math.round((amount - amount / (1 + rate / 100)) * 100) / 100 : 0);
