export function foldHexStringLiterals(text: string): string[] {
  const candidates: string[] = [];
  const expression = /(?:"[0-9a-f]{8,}"|'[0-9a-f]{8,}')(?:\s*\+\s*(?:"[0-9a-f]{8,}"|'[0-9a-f]{8,}'))*/gi;

  for (const match of text.matchAll(expression)) {
    const chunks = [...match[0].matchAll(/["']([0-9a-f]{8,})["']/gi)].map((part) => part[1]!);
    candidates.push(chunks.join(""));
  }

  return candidates;
}
