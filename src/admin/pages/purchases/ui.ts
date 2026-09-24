/** The workspace chip class for a payment tone (see paymentTone in utils/purchases). */
export const chipTone = (tone: string) => (tone === "good" ? "ws-chip ws-chip--good" : tone === "bad" ? "ws-chip ws-chip--bad" : tone === "warn" ? "ws-chip ws-chip--warn" : "ws-chip");
