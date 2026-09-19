import { adminNewSubmissionEmail, escapeHtml, hireRequestReceivedEmail } from "./email-templates";

describe("escapeHtml", () => {
  it("escapes all HTML-significant characters", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;"
    );
  });
});

describe("email templates never render user input as HTML", () => {
  const payload = `<a href="https://evil.example">Click to verify</a>`;

  it("escapes the customer's name in hire emails", () => {
    const { html } = hireRequestReceivedEmail({
      fullName: payload,
      vehicleName: "Toyota Hilux",
      pickupDate: new Date("2026-10-01"),
      returnDate: new Date("2026-10-03"),
      days: 2,
      totalCost: 90000,
      currency: "MWK",
    });
    expect(html).not.toContain("<a href=");
    expect(html).toContain("&lt;a href=");
  });

  it("escapes every summary line in admin notification emails", () => {
    const { html } = adminNewSubmissionEmail("review", [payload]);
    expect(html).not.toContain("<a href=");
    expect(html).toContain("&lt;a href=");
  });
});
