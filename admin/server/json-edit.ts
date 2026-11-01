/* Точечное редактирование JSON-массивов: меняем только нужный объект,
   не переформатируя весь файл. Это важно для маленьких diff'ов в Git. */

interface JsonProperty {
  key: string;
  value: JsonNode;
}

interface JsonNode {
  type: "object" | "array" | "string" | "number" | "boolean" | "null";
  start: number;
  end: number;
  value?: string;
  properties?: JsonProperty[];
  items?: JsonNode[];
}

class Scanner {
  text: string;
  index = 0;

  constructor(text: string) {
    this.text = text;
  }

  skip(): void {
    while (this.index < this.text.length) {
      const char = this.text[this.index];
      if (char === " " || char === "\n" || char === "\r" || char === "\t") this.index += 1;
      else break;
    }
  }

  parse(): JsonNode {
    this.skip();
    const node = this.parseValue();
    this.skip();
    if (this.index !== this.text.length) throw new Error("JSON: лишние данные после значения");
    return node;
  }

  private parseValue(): JsonNode {
    this.skip();
    const char = this.text[this.index];
    if (char === "{") return this.parseObject();
    if (char === "[") return this.parseArray();
    if (char === "\"") return this.parseString();
    if (char === "t" || char === "f") return this.parseBoolean();
    if (char === "n") return this.parseNull();
    return this.parseNumber();
  }

  private parseObject(): JsonNode {
    const start = this.index;
    this.index += 1;
    const properties: JsonProperty[] = [];
    this.skip();
    if (this.text[this.index] === "}") {
      this.index += 1;
      return { type: "object", start, end: this.index, properties };
    }
    while (this.index < this.text.length) {
      this.skip();
      const keyNode = this.parseString();
      this.skip();
      if (this.text[this.index] !== ":") throw new Error("JSON: ожидается ':'");
      this.index += 1;
      const value = this.parseValue();
      properties.push({ key: keyNode.value ?? "", value });
      this.skip();
      const next = this.text[this.index];
      if (next === ",") {
        this.index += 1;
        continue;
      }
      if (next === "}") {
        this.index += 1;
        return { type: "object", start, end: this.index, properties };
      }
      throw new Error("JSON: ожидается ',' или '}'");
    }
    throw new Error("JSON: незакрытый объект");
  }

  private parseArray(): JsonNode {
    const start = this.index;
    this.index += 1;
    const items: JsonNode[] = [];
    this.skip();
    if (this.text[this.index] === "]") {
      this.index += 1;
      return { type: "array", start, end: this.index, items };
    }
    while (this.index < this.text.length) {
      items.push(this.parseValue());
      this.skip();
      const next = this.text[this.index];
      if (next === ",") {
        this.index += 1;
        continue;
      }
      if (next === "]") {
        this.index += 1;
        return { type: "array", start, end: this.index, items };
      }
      throw new Error("JSON: ожидается ',' или ']'");
    }
    throw new Error("JSON: незакрытый массив");
  }

  private parseString(): JsonNode {
    const start = this.index;
    if (this.text[this.index] !== "\"") throw new Error("JSON: ожидается строка");
    this.index += 1;
    while (this.index < this.text.length) {
      const char = this.text[this.index];
      if (char === "\\") {
        this.index += 2;
        continue;
      }
      if (char === "\"") {
        this.index += 1;
        const raw = this.text.slice(start, this.index);
        return {
          type: "string",
          start,
          end: this.index,
          value: JSON.parse(raw) as string,
        };
      }
      this.index += 1;
    }
    throw new Error("JSON: незакрытая строка");
  }

  private parseNumber(): JsonNode {
    const start = this.index;
    while (this.index < this.text.length && /[0-9eE+\-.]/.test(this.text[this.index] ?? "")) {
      this.index += 1;
    }
    if (this.index === start) throw new Error("JSON: ожидается значение");
    return { type: "number", start, end: this.index };
  }

  private parseBoolean(): JsonNode {
    const start = this.index;
    const value = this.text.slice(this.index, this.index + 4);
    if (value === "true") {
      this.index += 4;
      return { type: "boolean", start, end: this.index };
    }
    if (this.text.slice(this.index, this.index + 5) === "false") {
      this.index += 5;
      return { type: "boolean", start, end: this.index };
    }
    throw new Error("JSON: некорректный boolean");
  }

  private parseNull(): JsonNode {
    const start = this.index;
    if (this.text.slice(this.index, this.index + 4) === "null") {
      this.index += 4;
      return { type: "null", start, end: this.index };
    }
    throw new Error("JSON: некорректный null");
  }
}

function findArray(raw: string, key: string): JsonNode {
  const root = new Scanner(raw).parse();
  if (root.type !== "object" || !root.properties) throw new Error("JSON: корень должен быть объектом");
  const property = root.properties.find((entry) => entry.key === key);
  if (!property || property.value.type !== "array") {
    throw new Error(`JSON: нет массива «${key}»`);
  }
  return property.value;
}

function itemId(node: JsonNode): string | null {
  if (node.type !== "object" || !node.properties) return null;
  const property = node.properties.find((entry) => entry.key === "id");
  return property?.value.type === "string" ? (property.value.value ?? null) : null;
}

function lineIndent(raw: string, position: number): string {
  const start = raw.lastIndexOf("\n", position - 1) + 1;
  const prefix = raw.slice(start, position);
  return /^[ \t]*$/.test(prefix) ? prefix : "";
}

function indentAt(raw: string, position: number): string {
  let index = position - 1;
  while (index >= 0 && (raw[index] === " " || raw[index] === "\t")) index -= 1;
  return raw[index] === "\n" ? raw.slice(index + 1, position) : "";
}

function serializeItem(item: unknown, indent: string): string {
  return JSON.stringify(item, null, 2)
    .split("\n")
    .map((line, index) => (index === 0 ? line : `${indent}${line}`))
    .join("\n");
}

function replaceRange(raw: string, start: number, end: number, text: string): string {
  return raw.slice(0, start) + text + raw.slice(end);
}

export function updateJsonItem(
  raw: string,
  collectionKey: string,
  item: { id: string },
  originalId?: string,
): string {
  const array = findArray(raw, collectionKey);
  const items = array.items ?? [];
  const key = originalId ?? item.id;

  const index = items.findIndex((node) => itemId(node) === key);
  if (index >= 0) {
    const node = items[index] as JsonNode;
    const indent = indentAt(raw, node.start);
    return replaceRange(raw, node.start, node.end, serializeItem(item, indent));
  }

  if (items.length === 0) {
    const base = lineIndent(raw, array.start);
    const indent = `${base}  `;
    return replaceRange(
      raw,
      array.start + 1,
      array.end - 1,
      `\n${indent}${serializeItem(item, indent)}\n${base}`,
    );
  }

  const last = items[items.length - 1] as JsonNode;
  const indent = indentAt(raw, last.start) || `${lineIndent(raw, array.start)}  `;
  return replaceRange(raw, last.end, last.end, `,\n${indent}${serializeItem(item, indent)}`);
}

export function deleteJsonItem(raw: string, collectionKey: string, id: string): string {
  const array = findArray(raw, collectionKey);
  const items = array.items ?? [];
  const index = items.findIndex((node) => itemId(node) === id);
  if (index === -1) throw new Error(`JSON: запись «${id}» не найдена`);

  if (items.length === 1) {
    return replaceRange(raw, array.start + 1, array.end - 1, "");
  }

  const item = items[index] as JsonNode;
  if (index < items.length - 1) {
    const next = items[index + 1] as JsonNode;
    return replaceRange(raw, item.start, next.start, "");
  }

  const previous = items[index - 1] as JsonNode;
  return replaceRange(raw, previous.end, item.end, "");
}
