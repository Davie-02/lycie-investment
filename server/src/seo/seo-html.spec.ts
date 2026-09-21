import { absoluteUrl, escapeHtml, jsonLdScript, renderDocument, sitemapXml, snippet } from "./seo-html";

describe("seo html helpers", () => {
  it("escapes everything that could break out of markup", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;");
  });

  it("cannot be tricked into closing the structured-data script", () => {
    const html = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    expect(html.match(/<\/script>/g)).toHaveLength(1); // only our own closing tag
    expect(html).toContain("\\u003c/script>");
  });

  it("shortens long text at a word boundary", () => {
    const text = "Reliable sourcing ".repeat(30);
    const short = snippet(text, 100);
    expect(short.length).toBeLessThanOrEqual(101);
    expect(short.endsWith("…")).toBe(true);
    expect(snippet("short text")).toBe("short text");
  });

  it("makes relative photo paths absolute, leaving full addresses alone", () => {
    expect(absoluteUrl("https://site.com", "/uploads/a.webp")).toBe("https://site.com/uploads/a.webp");
    expect(absoluteUrl("https://site.com", "https://cdn.x/a.webp")).toBe("https://cdn.x/a.webp");
    expect(absoluteUrl("https://site.com", null)).toBeNull();
  });

  it("builds a complete page with canonical, Open Graph and Twitter tags", () => {
    const html = renderDocument({ title: "A & B", description: "d", url: "https://s.com/x", image: "https://s.com/i.jpg", siteName: "S", bodyHtml: "<h1>Hi</h1>" });
    for (const expected of ['<title>A &amp; B</title>', 'rel="canonical" href="https://s.com/x"', 'property="og:image" content="https://s.com/i.jpg"', 'name="twitter:card" content="summary_large_image"', "<h1>Hi</h1>"]) {
      expect(html).toContain(expected);
    }
  });

  it("supports noindex and no-image pages", () => {
    const html = renderDocument({ title: "t", description: "d", url: "u", siteName: "S", bodyHtml: "", noindex: true });
    expect(html).toContain("noindex");
    expect(html).toContain('content="summary"');
  });

  it("writes a valid sitemap", () => {
    const xml = sitemapXml([{ loc: "https://s.com/a?b=1&c=2", lastmod: new Date("2026-01-02T00:00:00Z"), priority: 0.8 }]);
    expect(xml).toContain("<loc>https://s.com/a?b=1&amp;c=2</loc>");
    expect(xml).toContain("<lastmod>2026-01-02T00:00:00.000Z</lastmod>");
    expect(xml).toContain("<priority>0.8</priority>");
  });
});
