import { effectiveAccess, baseAccess, cleanOverrides } from "./modules";
import { accessForRoute } from "./route-access";

describe("module access", () => {
  it("gives the system administrator everything", () => {
    const access = effectiveAccess("OWNER", null, { sales: "none" });
    expect(Object.values(access).every((level) => level === "manage")).toBe(true);
  });

  it("starts employees from their department and applies overrides both ways", () => {
    expect(baseAccess("EMPLOYEE", "sales").sales).toBe("edit");
    expect(baseAccess("EMPLOYEE", "sales").finance).toBe("none");
    const access = effectiveAccess("EMPLOYEE", "sales", { finance: "view", customers: "none" });
    expect(access.finance).toBe("view");
    expect(access.customers).toBe("none");
  });

  it("gives staff with no department nothing but the dashboard", () => {
    expect(Object.values(effectiveAccess("EMPLOYEE", null, null)).every((level) => level === "none")).toBe(true);
  });

  it("ignores junk in stored overrides", () => {
    expect(cleanOverrides({ sales: "edit", hacker: "manage", finance: "superuser" })).toEqual({ sales: "edit" });
    expect(cleanOverrides("nope")).toEqual({});
  });

  it("maps routes to modules and levels", () => {
    expect(accessForRoute("GET", "/api/vehicles")).toEqual({ kind: "modules", modules: ["sales"], level: "view" });
    expect(accessForRoute("PATCH", "/api/hire-requests/abc/status")).toEqual({ kind: "modules", modules: ["hire"], level: "edit" });
    expect(accessForRoute("POST", "/api/content-admin/faq/bulk")).toEqual({ kind: "modules", modules: ["marketing"], level: "edit" });
    expect(accessForRoute("GET", "/api/admin-tools/export/inquiries")).toEqual({ kind: "modules", modules: ["sales"], level: "manage" });
    expect(accessForRoute("POST", "/api/pricing/convert-listings")).toEqual({ kind: "modules", modules: ["finance"], level: "manage" });
    expect(accessForRoute("POST", "/api/admin-users")).toEqual({ kind: "modules", modules: ["system", "hr"], level: "manage" });
    expect(accessForRoute("GET", "/api/auth/session")).toEqual({ kind: "staff" });
    expect(accessForRoute("GET", "/api/something-new")).toBeNull();
    expect(accessForRoute("PATCH", "/api/site-content/language")).toEqual({ kind: "modules", modules: ["system"], level: "edit" });
    expect(accessForRoute("PATCH", "/api/site-content/hero")).toEqual({ kind: "modules", modules: ["marketing"], level: "edit" });
  });
});
