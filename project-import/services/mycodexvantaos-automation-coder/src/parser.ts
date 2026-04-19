import type { ASTNode, Symbol as CodeSymbol } from "./types";

let nodeCounter = 0;

export class ParserService {
  parse(code: string): ASTNode {
    const lines = code.split("\n");
    const root: ASTNode = {
      type: "Program",
      name: "root",
      children: [],
      location: { start: 0, end: code.length, line: 1 },
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("//")) continue;

      const node: ASTNode = {
        type: this.inferNodeType(line),
        name: this.inferNodeName(line),
        children: [],
        location: { start: nodeCounter++, end: nodeCounter, line: i + 1 },
      };
      root.children.push(node);
    }

    return root;
  }

  extractSymbols(code: string, file: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = code.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      const exported = trimmed.startsWith("export ");
      const cleaned = exported ? trimmed.replace("export ", "") : trimmed;

      if (cleaned.startsWith("function ")) {
        const name = cleaned.split("(")[0].replace("function ", "").trim();
        symbols.push({ name, type: "function", exported, file });
      } else if (cleaned.startsWith("class ")) {
        const name = cleaned.split(/[\s{]/)[1] ?? "Anonymous";
        symbols.push({ name, type: "class", exported, file });
      } else if (cleaned.startsWith("interface ")) {
        const name = cleaned.split(/[\s{]/)[1] ?? "Anonymous";
        symbols.push({ name, type: "interface", exported, file });
      } else if (cleaned.startsWith("type ") && cleaned.includes("=")) {
        const name = cleaned.split("=")[0].replace("type ", "").trim();
        symbols.push({ name, type: "type", exported, file });
      } else if (cleaned.startsWith("const ") || cleaned.startsWith("let ") || cleaned.startsWith("var ")) {
        const keyword = cleaned.split(" ")[0];
        const name = cleaned.replace(keyword + " ", "").split(/[\s:=]/)[0];
        symbols.push({ name, type: "variable", exported, file });
      }
    }

    return symbols;
  }

  private inferNodeType(line: string): string {
    if (line.startsWith("import ")) return "ImportDeclaration";
    if (line.startsWith("export ")) return "ExportDeclaration";
    if (line.startsWith("function ") || line.includes("=> ")) return "FunctionDeclaration";
    if (line.startsWith("class ")) return "ClassDeclaration";
    if (line.startsWith("interface ")) return "InterfaceDeclaration";
    if (line.startsWith("const ") || line.startsWith("let ") || line.startsWith("var ")) return "VariableDeclaration";
    return "ExpressionStatement";
  }

  private inferNodeName(line: string): string | undefined {
    const match = line.match(/(?:function|class|interface|const|let|var)\s+(\w+)/);
    return match?.[1];
  }
}