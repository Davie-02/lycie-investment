/**
 * WhatsApp Business (Meta Cloud API) messages to customers.
 *
 * Messages a business starts must use a TEMPLATE that Meta has approved. Create
 * one in WhatsApp Manager (category "Utility"), e.g. named `lycie_update`, with
 * a body of exactly one variable:  "{{1}}"  — or "Hello from Lycie Investments: {{1}}".
 * Then set on the server:
 *   WHATSAPP_PHONE_NUMBER_ID   the sending number's id (WhatsApp Manager → API setup)
 *   WHATSAPP_ACCESS_TOKEN      a permanent system-user token with whatsapp_business_messaging
 *   WHATSAPP_TEMPLATE_NAME     e.g. lycie_update
 *   WHATSAPP_TEMPLATE_LANG     e.g. en (default)
 * Until they're set, nothing is sent and email carries every notification.
 */
import { toInternationalDigits } from "./phone";

const GRAPH = "https://graph.facebook.com/v20.0";

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_TEMPLATE_NAME);
}

/** The request body for one template message. Exported for tests. */
export function templateMessage(to: string, text: string) {
  return {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: process.env.WHATSAPP_TEMPLATE_NAME,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
      // Template variables can't contain new lines or long runs of spaces.
      components: [{ type: "body", parameters: [{ type: "text", text: text.replace(/\s+/g, " ").trim().slice(0, 1000) }] }],
    },
  };
}

export async function sendWhatsApp(phone: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!whatsappConfigured()) return { ok: false, error: "WhatsApp isn't set up." };
  const to = toInternationalDigits(phone);
  if (!to) return { ok: false, error: "No usable phone number." };
  try {
    const response = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(templateMessage(to, text)),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { ok: false, error: `WhatsApp answered ${response.status}: ${(await response.text()).slice(0, 300)}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
