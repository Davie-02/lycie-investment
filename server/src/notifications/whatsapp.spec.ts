import { templateMessage, whatsappConfigured } from "./whatsapp";
import { toInternationalDigits } from "./phone";

describe("whatsapp", () => {
  afterEach(() => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_TEMPLATE_NAME;
  });

  it("is off until all settings are present", () => {
    expect(whatsappConfigured()).toBe(false);
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1";
    process.env.WHATSAPP_ACCESS_TOKEN = "t";
    process.env.WHATSAPP_TEMPLATE_NAME = "lycie_update";
    expect(whatsappConfigured()).toBe(true);
  });

  it("builds a one-variable template message with clean text", () => {
    process.env.WHATSAPP_TEMPLATE_NAME = "lycie_update";
    const body = templateMessage("265991383466", "Your booking\nis confirmed.");
    expect(body.template.name).toBe("lycie_update");
    expect(body.template.components[0].parameters[0].text).toBe("Your booking is confirmed.");
  });

  it("turns local Malawi numbers into international digits", () => {
    expect(toInternationalDigits("0991 383 466")).toBe("265991383466");
    expect(toInternationalDigits("+265 991 383 466")).toBe("265991383466");
    expect(toInternationalDigits("12")).toBeNull();
  });
});
