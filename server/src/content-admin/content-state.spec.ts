import { CONTENT_TYPES, PUBLIC, RULES, dataFor } from "./content-state";

describe("content state rules", () => {
  it("defines public visibility for every content type", () => {
    for (const type of CONTENT_TYPES) expect(PUBLIC[type]).toBeDefined();
  });

  it("public content is never archived", () => {
    for (const type of CONTENT_TYPES) expect(PUBLIC[type]).toMatchObject({ archivedAt: null });
  });

  it("archiving hides the item and restoring returns it as a draft, not live", () => {
    const archived = dataFor("vehicles", "archive");
    expect(archived).toMatchObject({ isPublished: false });
    expect(archived.archivedAt).toBeInstanceOf(Date);
    expect(dataFor("vehicles", "restore")).toEqual({ archivedAt: null });
  });

  it("publishing also un-archives", () => {
    expect(dataFor("faq", "publish")).toEqual({ isPublished: true, archivedAt: null });
  });

  it("uses each type's own publish flag", () => {
    expect(RULES.notices.published).toMatchObject({ isActive: true });
    expect(dataFor("blog-posts", "unpublish")).toEqual({ publishedAt: null });
    expect(dataFor("blog-posts", "publish").publishedAt).toBeInstanceOf(Date);
  });
});
