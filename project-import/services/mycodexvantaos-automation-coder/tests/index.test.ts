import { ParserService } from "../src/parser";
import { AnalyzerService } from "../src/analyzer";

describe("ParserService", () => {
  let parser: ParserService;

  beforeEach(() => {
    parser = new ParserService();
  });

  it("should parse code into AST", () => {
    const code = 'const x = 1;\nfunction hello() {}\nclass Foo {}';
    const ast = parser.parse(code);
    expect(ast.type).toBe("Program");
    expect(ast.children).toHaveLength(3);
    expect(ast.children[0].type).toBe("VariableDeclaration");
    expect(ast.children[1].type).toBe("FunctionDeclaration");
    expect(ast.children[2].type).toBe("ClassDeclaration");
  });

  it("should skip empty lines and comments", () => {
    const code = '// comment\n\nconst x = 1;';
    const ast = parser.parse(code);
    expect(ast.children).toHaveLength(1);
  });

  it("should infer node names", () => {
    const code = 'function greet() {}';
    const ast = parser.parse(code);
    expect(ast.children[0].name).toBe("greet");
  });

  it("should extract symbols from code", () => {
    const code = [
      'export function hello() {}',
      'export class MyClass {}',
      'const internal = 42;',
      'export interface Config {}',
    ].join("\n");
    const symbols = parser.extractSymbols(code, "test.ts");
    expect(symbols).toHaveLength(4);
    expect(symbols[0]).toEqual({ name: "hello", type: "function", exported: true, file: "test.ts" });
    expect(symbols[1]).toEqual({ name: "MyClass", type: "class", exported: true, file: "test.ts" });
    expect(symbols[2]).toEqual({ name: "internal", type: "variable", exported: false, file: "test.ts" });
    expect(symbols[3]).toEqual({ name: "Config", type: "interface", exported: true, file: "test.ts" });
  });
});

describe("AnalyzerService", () => {
  let analyzer: AnalyzerService;

  beforeEach(() => {
    analyzer = new AnalyzerService();
  });

  it("should analyze code and return patterns, issues, metrics", () => {
    const code = 'const x = 1;\nfunction hello() {}\n// TODO: fix this';
    const result = analyzer.analyze(code, "test.ts");
    expect(result.metrics.totalLines).toBe(3);
    expect(result.metrics.codeLines).toBe(2);
    expect(result.issues.some((i) => i.message.includes("TODO"))).toBe(true);
  });

  it("should compute complexity report", () => {
    const code = 'function test() {\n  if (x) {\n    for (let i = 0; i < 10; i++) {\n      console.log(i);\n    }\n  }\n}';
    const report = analyzer.computeComplexity(code);
    expect(report.cyclomatic).toBeGreaterThanOrEqual(3);
    expect(report.cognitive).toBeGreaterThanOrEqual(2);
    expect(report.maintainability).toBeGreaterThan(0);
    expect(report.maintainability).toBeLessThanOrEqual(100);
  });

  it("should detect long line issues", () => {
    const longLine = "const x = " + "a".repeat(120) + ";";
    const result = analyzer.analyze(longLine, "test.ts");
    expect(result.issues.some((i) => i.message.includes("120 characters"))).toBe(true);
  });

  it("should build dependency graph", () => {
    const files = [
      { file: "a.ts", code: 'import { X } from "./b";\nimport { Y } from "pino";' },
      { file: "b.ts", code: 'export const X = 1;' },
    ];
    const graph = analyzer.buildDependencyGraph(files);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(2);
    expect(graph.edges).toHaveLength(2);
    expect(graph.edges[0].type).toBe("import");
  });

  it("should detect observer pattern", () => {
    const code = 'emitter.on("event", handler);\nemitter.emit("event");';
    const result = analyzer.analyze(code, "test.ts");
    const observer = result.patterns.find((p) => p.name === "Observer");
    expect(observer).toBeDefined();
    expect(observer!.occurrences).toBe(2);
  });
});

describe("bootstrap", () => {
  it("should complete without error", async () => {
    const { bootstrap } = await import("../src/index");
    await expect(bootstrap()).resolves.toBeUndefined();
  });
});