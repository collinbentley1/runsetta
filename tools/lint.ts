import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  findCredentialShapedHexLiterals,
  isSourceScanIgnoredDirectory,
} from "./secret-policy";

const root = join(import.meta.dir, "..");
const failures: string[] = [];
const forbiddenNeedles = ["lang" + "chain", "lang" + "serve"];

await requireContains(
  "Dockerfile",
  "FROM platform.invalid/bun-release AS bun-release",
  "Dockerfile must retain the platform-injected Bun release base.",
);
await requireContains(
  "Dockerfile",
  "FROM platform.invalid/dhi-bun-dev AS deps",
  "Dockerfile must retain the platform-injected DHI development base.",
);
await requireContains(
  "Dockerfile",
  "FROM platform.invalid/dhi-bun-runtime AS runtime",
  "Dockerfile must retain the platform-injected DHI runtime base.",
);
await requireContains("public/index.html", 'rel="icon"', "The document must link a favicon.");
await rejectContains("public/index.html", "https://", "The frontend should not load third-party assets.");
await rejectContains(
  "public/assets/styles.css",
  "@import",
  "Styles should not import third-party design libraries.",
);
await rejectContains("src/client.ts", "react", "The frontend should stay framework-free.");
await rejectForbiddenSourceText();

await import("./verify-socket-config.ts");

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

async function requireContains(path: string, needle: string, message: string): Promise<void> {
  const text = await readFile(join(root, path), "utf8");
  if (!text.includes(needle)) {
    failures.push(`${path}: ${message}`);
  }
}

async function rejectContains(path: string, needle: string, message: string): Promise<void> {
  const text = await readFile(join(root, path), "utf8");
  if (text.includes(needle)) {
    failures.push(`${path}: ${message}`);
  }
}

async function rejectForbiddenSourceText(): Promise<void> {
  for await (const filePath of walk(root)) {
    const text = await readFile(filePath, "utf8").catch(() => "");
    const relativePath = filePath.slice(root.length + 1);

    for (const needle of forbiddenNeedles) {
      if (text.toLowerCase().includes(needle.toLowerCase())) {
        failures.push(`${relativePath}: forbidden legacy dependency marker found.`);
      }
    }

    for (const _candidate of findCredentialShapedHexLiterals(relativePath, text)) {
      failures.push(`${relativePath}: credential-shaped hexadecimal string literal found.`);
    }
  }
}

async function* walk(directory: string): AsyncGenerator<string> {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!isSourceScanIgnoredDirectory(entry.name)) {
        yield* walk(path);
      }
    } else if (entry.isFile()) {
      yield path;
    }
  }
}
