import { clusterQuestions, isCovered, stem } from "./question-clusters.util";

describe("stem", () => {
  it("joins common word forms", () => {
    expect(stem("importing")).toBe(stem("imports"));
    expect(stem("import")).toBe("import");
  });
  it("leaves short words alone", () => {
    expect(stem("uses")).toBe("uses");
  });
});

describe("clusterQuestions", () => {
  const questions = [
    "How long does importing a car from Japan take?",
    "how many weeks to import a vehicle from japan",
    "Import time from Japan?",
    "Do you accept mobile money for hire deposit?",
    "Can I pay my hire deposit with airtel money",
    "What is the hire deposit?",
    "hello",
    "ok thanks",
  ];
  const clusters = clusterQuestions(questions);

  it("groups differently-worded questions about the same topic", () => {
    const importCluster = clusters.find((c) => c.keywords.includes("import"));
    expect(importCluster?.count).toBe(3);
    const depositCluster = clusters.find((c) => c.keywords.includes("deposit"));
    expect(depositCluster?.count).toBe(3);
  });

  it("ignores greetings with no topic words", () => {
    expect(clusters.flatMap((c) => c.samples).some((s) => s === "hello")).toBe(false);
  });

  it("does not merge unrelated topics over one shared word", () => {
    const result = clusterQuestions(["hire toyota corolla weekend", "hire deposit refund policy"]);
    expect(result).toHaveLength(2);
  });

  it("orders the biggest topics first and picks the shortest example", () => {
    expect(clusters[0].count).toBeGreaterThanOrEqual(clusters[1].count);
    const importCluster = clusters.find((c) => c.keywords.includes("import"))!;
    expect(importCluster.representative).toBe("Import time from Japan?");
  });
});

describe("isCovered", () => {
  const [cluster] = clusterQuestions([
    "how long does importing take from japan",
    "import time from japan",
  ]);

  it("recognises a topic an FAQ already answers", () => {
    expect(isCovered(cluster, ["How long does it take to import a vehicle from Japan?"])).toBe(true);
  });

  it("does not treat an unrelated FAQ as coverage", () => {
    expect(isCovered(cluster, ["What are your opening hours?", "Do you offer vehicle hire?"])).toBe(false);
  });
});

describe("stem edge cases", () => {
  it("does not mangle words ending in -ss", () => {
    expect(stem("business")).toBe("business");
  });
});
