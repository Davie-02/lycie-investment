export function formatCurrency(amount: number, currency: string = "MWK"): string {
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

export function formatMileage(km: number): string {
  return `${km.toLocaleString("en-US")} km`;
}
