import { IngestionService, TransformationService, ExportService, bootstrap } from "../src";

describe("IngestionService", () => {
  let svc: IngestionService;
  beforeEach(() => { svc = new IngestionService(); });

  it("should register a source and ingest data", async () => {
    const src = await svc.registerSource("csv", "file");
    const result = await svc.ingest(src.id, [{ a: 1 }, { a: 2 }]);
    expect(result.recordsIngested).toBe(2);
    expect(await svc.getRecords(src.id)).toHaveLength(2);
  });

  it("should list and remove sources", async () => {
    const s = await svc.registerSource("api", "http");
    expect(await svc.listSources()).toHaveLength(1);
    expect(await svc.removeSource(s.id)).toBe(true);
    expect(await svc.listSources()).toHaveLength(0);
  });
});

describe("TransformationService", () => {
  let svc: TransformationService;
  beforeEach(() => { svc = new TransformationService(); });

  it("should create and execute a filter pipeline", async () => {
    const pipe = await svc.createPipeline("filter-active", [
      { name: "only-active", type: "filter", config: { field: "status", value: "active" } },
    ]);
    const { result, summary } = await svc.execute(pipe.id, [
      { status: "active", n: 1 }, { status: "inactive", n: 2 }, { status: "active", n: 3 },
    ]);
    expect(result).toHaveLength(2);
    expect(summary.recordsIn).toBe(3);
    expect(summary.recordsOut).toBe(2);
  });

  it("should create and execute a map pipeline", async () => {
    const pipe = await svc.createPipeline("add-tag", [
      { name: "tag", type: "map", config: { addField: "tagged", addValue: true } },
    ]);
    const { result } = await svc.execute(pipe.id, [{ x: 1 }]);
    expect((result[0] as Record<string, unknown>).tagged).toBe(true);
  });

  it("should list and delete pipelines", async () => {
    const p = await svc.createPipeline("tmp", []);
    expect(await svc.listPipelines()).toHaveLength(1);
    expect(await svc.deletePipeline(p.id)).toBe(true);
    expect(await svc.listPipelines()).toHaveLength(0);
  });
});

describe("ExportService", () => {
  let svc: ExportService;
  beforeEach(() => { svc = new ExportService(); });

  it("should register target and export data", async () => {
    const t = await svc.registerTarget("s3", "cloud");
    const result = await svc.exportData(t.id, [{ row: 1 }, { row: 2 }]);
    expect(result.recordsExported).toBe(2);
    expect(await svc.getExported(t.id)).toHaveLength(2);
  });

  it("should list and remove targets", async () => {
    const t = await svc.registerTarget("db", "sql");
    expect(await svc.listTargets()).toHaveLength(1);
    expect(await svc.removeTarget(t.id)).toBe(true);
    expect(await svc.listTargets()).toHaveLength(0);
  });
});

describe("bootstrap", () => {
  it("should complete without error", async () => {
    await expect(bootstrap()).resolves.toBeUndefined();
  });
});