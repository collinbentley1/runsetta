export function foldHexStringLiterals(text: string): string[] {
  const candidates: string[] = [];
  const expression = /(?:\\*["'])[0-9a-f]{8,}(?:\\*["'])(?:\s*\+\s*(?:\\*["'])[0-9a-f]{8,}(?:\\*["']))*/gi;

  for (const match of text.matchAll(expression)) {
    const chunks = [...match[0].matchAll(/\\*["']([0-9a-f]{8,})\\*["']/gi)].map(
      (part) => part[1]!,
    );
    candidates.push(chunks.join(""));
  }

  return candidates;
}

const sourceScanIgnoredDirectories = new Set([
  ".build",
  ".git",
  ".swiftpm",
  ".terraform",
  "_platform_policy",
  "dist",
  "node_modules",
]);

export function isSourceScanIgnoredDirectory(name: string): boolean {
  return sourceScanIgnoredDirectories.has(name);
}

export function findCredentialShapedHexLiterals(
  relativePath: string,
  text: string,
): string[] {
  return foldHexStringLiterals(text).filter(
    (candidate) =>
      candidate.length >= 32 &&
      candidate.length < 64 &&
      !isReviewedPlatformWorkflowSha(relativePath, text, candidate) &&
      !isReviewedBunRevision(relativePath, text, candidate),
  );
}

function isReviewedBunRevision(
  relativePath: string,
  text: string,
  candidate: string,
): boolean {
  if (
    relativePath !== "Dockerfile" ||
    !/^744846f844374847c902b5e7fd59b4342a51ef99$/.test(candidate)
  ) {
    return false;
  }

  const exactSource =
    "FROM platform.invalid/bun-release AS bun-release";
  const exactDepsCheck =
    `RUN bun -e 'if (Bun.version !== "1.4.2" || Bun.revision !== "${candidate}") throw new Error("Bun image requires 1.4.2+744846f84, got " + Bun.version + "+" + Bun.revision.slice(0, 9))'`;
  const exactRuntimeCheck =
    `RUN ["bun", "-e", "if (Bun.version !== \\\"1.4.2\\\" || Bun.revision !== \\\"${candidate}\\\") throw new Error(\\\"Bun image requires 1.4.2+744846f84, got \\\" + Bun.version + \\\"+\\\" + Bun.revision.slice(0, 9))"]`;
  const lines = text.split(/\r?\n/);
  const candidateCount = text.split(candidate).length - 1;

  return (
    lines.filter((line) => line === exactSource).length === 1 &&
    lines.filter((line) => line === exactDepsCheck).length === 1 &&
    lines.filter((line) => line === exactRuntimeCheck).length === 1 &&
    candidateCount === 2
  );
}

function isReviewedPlatformWorkflowSha(
  relativePath: string,
  text: string,
  candidate: string,
): boolean {
  if (relativePath !== "infra/terraform/bootstrap/main.tf" || candidate.length !== 40) {
    return false;
  }

  const sourceRefs = [...text.matchAll(
    /^\s*source\s*=\s*"github\.com\/collinbentley1\/platform\/\/terraform\/modules\/bootstrap\?ref=([0-9a-f]{40})"\s*$/gm,
  )];
  const activeShas = [...text.matchAll(
    /^\s*active_workflow_sha\s*=\s*"([0-9a-f]{40})"\s*$/gm,
  )];

  return (
    sourceRefs.length === 1 &&
    activeShas.length === 1 &&
    sourceRefs[0]?.[1] === candidate &&
    activeShas[0]?.[1] === candidate &&
    text.split(candidate).length - 1 === 2
  );
}
