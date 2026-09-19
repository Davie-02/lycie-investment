// Nest sends validation errors as either a single string or an array of
// strings (one per failed field) — normalize both into one readable line.
export async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (Array.isArray(body?.message)) return body.message.join(" ");
    if (typeof body?.message === "string") return body.message;
  } catch {
    // Response body wasn't JSON (e.g. a proxy/500 page) — fall back below.
  }
  return `Request failed (${response.status}).`;
}
