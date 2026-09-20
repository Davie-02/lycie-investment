import { EmailService } from "./email.service";

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  delete process.env.BREVO_API_KEY;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_PROVIDER;
  delete process.env.EMAIL_REPLY_TO;
  delete process.env.EMAIL_FROM;
});

function mockFetch(status: number, body: unknown) {
  const fn = jest.fn(async () => new Response(JSON.stringify(body), { status }));
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe("EmailService", () => {
  it("is unconfigured without any key", async () => {
    const service = new EmailService();
    expect(service.isConfigured).toBe(false);
    expect(await service.sendChecked({ to: "a@b.com", subject: "s", html: "h" })).toMatchObject({ ok: false });
  });

  it("chooses the provider from whichever key is set", () => {
    process.env.BREVO_API_KEY = "k";
    expect(new EmailService().provider).toBe("brevo");
    delete process.env.BREVO_API_KEY;
    process.env.RESEND_API_KEY = "k";
    expect(new EmailService().provider).toBe("resend");
  });

  it("cleans up a reply-to written with a name or stray quotes", () => {
    const service = new EmailService();
    process.env.EMAIL_REPLY_TO = '"Lycie Investments <info@lycie.com>"';
    expect(service.replyTo).toBe("info@lycie.com");
    process.env.EMAIL_REPLY_TO = "  info@lycie.com ";
    expect(service.replyTo).toBe("info@lycie.com");
  });

  it("ignores an invalid reply-to instead of failing every email", async () => {
    process.env.BREVO_API_KEY = "k";
    process.env.EMAIL_FROM = "Lycie <me@gmail.com>";
    process.env.EMAIL_REPLY_TO = "not an email";
    const fetchFn = mockFetch(201, { messageId: "1" });
    const result = await new EmailService().sendChecked({ to: "c@d.com", subject: "s", html: "h" });
    expect(result.ok).toBe(true);
    const sent = JSON.parse((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.replyTo).toBeUndefined();
    expect(sent.sender).toEqual({ name: "Lycie", email: "me@gmail.com" });
  });

  it("quotes Brevo's own explanation when it refuses a message", async () => {
    process.env.BREVO_API_KEY = "k";
    mockFetch(400, { code: "invalid_parameter", message: "email is not valid in replyTo" });
    const result = await new EmailService().sendChecked({ to: "c@d.com", subject: "s", html: "h" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("email is not valid in replyTo");
    expect(result.error).not.toMatch(/sending address/i);
  });

  it("still gives the sender hint when the sender really is the problem", async () => {
    process.env.BREVO_API_KEY = "k";
    mockFetch(400, { message: "Sender is not valid" });
    const result = await new EmailService().sendChecked({ to: "c@d.com", subject: "s", html: "h" });
    expect(result.error).toMatch(/verify EMAIL_FROM/i);
  });
});
