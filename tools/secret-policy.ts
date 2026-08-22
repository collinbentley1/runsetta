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
  if (relativePath !== "Dockerfile" || candidate !== Bun.revision) {
    return false;
  }

  const exactSource =
    "FROM oven/bun:1.4.0-alpine@sha256:07235578f79ef8c6f97d94aee7938e76f5cdba5f21ae5dbfdd3d3d38058437eb AS bun-release";
  const exactDepsCheck =
    `RUN bun -e 'if (Bun.version !== "1.4.0" || Bun.revision !== "${candidate}") throw new Error("Bun image requires 1.4.0+34cbb9a40, got " + Bun.version + "+" + Bun.revision.slice(0, 9))'`;
  const exactRuntimeCheck =
    `RUN ["bun", "-e", "if (Bun.version !== \\\"1.4.0\\\" || Bun.revision !== \\\"${candidate}\\\") throw new Error(\\\"Bun image requires 1.4.0+34cbb9a40, got \\\" + Bun.version + \\\"+\\\" + Bun.revision.slice(0, 9))"]`;
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

  const sourceRef = text.match(
    /^\s*source\s*=\s*"github\.com\/collinbentley1\/platform\/\/terraform\/modules\/bootstrap\?ref=([0-9a-f]{40})"\s*$/m,
  )?.[1];
  const trustedBlock = text.match(
    /^\s*trusted_platform_workflow_shas\s*=\s*\[([\s\S]*?)^\s*\]/m,
  )?.[1];
  if (!sourceRef || !trustedBlock) {
    return false;
  }

  const lines = trustedBlock
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const trustedShas = lines
    .map((line) => line.match(/^"([0-9a-f]{40})",?(?:\s*#.*)?$/)?.[1])
    .filter((sha): sha is string => sha !== undefined);

  return (
    trustedShas.length === lines.length &&
    trustedShas.length >= 1 &&
    trustedShas.length <= 2 &&
    new Set(trustedShas).size === trustedShas.length &&
    trustedShas.includes(sourceRef) &&
    trustedShas.includes(candidate)
  );
}
