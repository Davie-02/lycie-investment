import { COMPANY_PROFILE } from "./company-profile";
import { SiteContentService } from "./site-content.service";

describe("COMPANY_PROFILE", () => {
  it("contains exactly the contact details from the company profile", () => {
    expect(COMPANY_PROFILE.contact.phone).toBe("+265 999 074 038 / +265 888 074 038");
    expect(COMPANY_PROFILE.contact.email).toBe("talimbamhangoll@gmail.com");
    expect(COMPANY_PROFILE.contact.address).toContain("P.O. Box 440");
    expect(COMPANY_PROFILE.company.established).toBe(2016);
  });

  it("lists the whole team, with plain-Latin names", () => {
    const groups = COMPANY_PROFILE.team.groups as Array<{ members: Array<{ name: string }> }>;
    const names = groups.flatMap((g) => g.members.map((m) => m.name));
    expect(names).toHaveLength(8);
    // eslint-disable-next-line no-control-regex
    expect(names.every((n) => /^[\x00-\x7F]+$/.test(n))).toBe(true);
  });

  it("keeps every service the site has a slot for", () => {
    const items = COMPANY_PROFILE.services.items as Array<{ title: string }>;
    expect(items.map((i) => i.title)).toEqual([
      "Vehicle Importing",
      "Vehicle Dealership",
      "Vehicle Hire",
      "Vehicle Clearing",
      "Transportation Services",
    ]);
  });
});

describe("SiteContentService.applyCompanyProfile", () => {
  it("replaces profile fields but keeps other saved fields such as business hours", async () => {
    const upserts: Array<{ where: { key: string }; update: { value: Record<string, unknown> } }> = [];
    const prisma = {
      siteContent: {
        findMany: async () => [{ key: "contact", value: { phone: "old", businessHours: "Mon-Fri 8-5", whatsappNumber: "+265111" } }],
        upsert: (args: (typeof upserts)[number]) => (upserts.push(args), args),
      },
      $transaction: async (ops: unknown[]) => ops,
    };
    const service = new SiteContentService(prisma as never);
    const result = await service.applyCompanyProfile();

    expect(result.sections).toEqual(expect.arrayContaining(["contact", "company", "team", "clients", "fleet", "about", "services"]));
    const contact = upserts.find((u) => u.where.key === "contact")!.update.value;
    expect(contact.phone).toBe("+265 999 074 038 / +265 888 074 038"); // replaced
    expect(contact.businessHours).toBe("Mon-Fri 8-5"); // kept
    expect(contact.whatsappNumber).toBe("+265111"); // kept
  });
});
