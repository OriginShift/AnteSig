import {
  decodeJsonPointer,
  resolvesJsonPointer,
  type JsonPointerSyntax,
} from "./references.js";

type PathSegment = string | number;

export interface SourceReferenceOccurrence {
  pointer: JsonPointerSyntax;
  ownerPath: readonly PathSegment[];
  metadataPath: readonly PathSegment[];
}

export interface ContextualReferenceIssue {
  message: string;
  path: PathSegment[];
}

const SOURCE_ROOTS = new Set([
  "intent",
  "quotes",
  "selection",
  "capability",
  "simulation",
]);
const REPORT_OWNED_FIELD_NAMES = new Set([
  "display",
  "prose",
  "extension",
  "extensions",
  "sourceReferences",
]);
const ALLOWED_SOURCE_ROOTS_BY_OWNER: Readonly<
  Record<string, ReadonlySet<string>>
> = {
  quotes: new Set(["intent"]),
  selection: new Set(["intent", "quotes"]),
  capability: new Set(["intent", "quotes", "selection"]),
  simulation: SOURCE_ROOTS,
  alignment: SOURCE_ROOTS,
  decision: SOURCE_ROOTS,
  limitations: SOURCE_ROOTS,
};
const ARRAY_INDEX_PATTERN = /^(?:0|[1-9][0-9]*)$/;

function normalizePath(path: readonly PathSegment[]): string[] {
  return path.map(String);
}

function isPathPrefix(prefix: readonly string[], path: readonly string[]) {
  return (
    prefix.length <= path.length &&
    prefix.every((segment, index) => path[index] === segment)
  );
}

function pathsOverlap(left: readonly string[], right: readonly string[]) {
  return isPathPrefix(left, right) || isPathPrefix(right, left);
}

function isArrayIndex(segment: string | undefined): boolean {
  return segment !== undefined && ARRAY_INDEX_PATTERN.test(segment);
}

function rawRootLength(path: readonly string[]): number | undefined {
  if (path[0] === "quotes" && isArrayIndex(path[1]) && path[2] === "raw") {
    return 3;
  }
  if (path[0] === "capability" && path[1] === "raw") {
    return 2;
  }
  if (path[0] !== "simulation") {
    return undefined;
  }
  if (path[1] === "raw") {
    return 2;
  }
  if (
    (path[1] === "receipts" || path[1] === "outcomes") &&
    path[2] === "items" &&
    isArrayIndex(path[3]) &&
    path[4] === "raw"
  ) {
    return 5;
  }
  if (path[1] === "warnings" && path[2] === "items" && isArrayIndex(path[3])) {
    return 4;
  }
  if (
    (path[1] === "coverage" ||
      path[1] === "ordering" ||
      path[1] === "stateContinuity") &&
    path[2] === "raw"
  ) {
    return 3;
  }
  return undefined;
}

export function isRawOwnedPath(path: readonly string[]): boolean {
  const rootLength = rawRootLength(path);
  return rootLength !== undefined && path.length >= rootLength;
}

function isAllowedSourceTarget(path: readonly string[]): boolean {
  if (isRawOwnedPath(path)) {
    return true;
  }
  const [root] = path;
  return (
    root !== undefined &&
    SOURCE_ROOTS.has(root) &&
    !path.some((segment) => REPORT_OWNED_FIELD_NAMES.has(segment))
  );
}

function isRelatedToOwner(
  ownerPath: readonly PathSegment[],
  targetPath: readonly string[],
): boolean {
  const ownerRoot = String(ownerPath[0]);
  const targetRoot = targetPath[0];
  if (targetRoot === undefined) {
    return false;
  }

  return ALLOWED_SOURCE_ROOTS_BY_OWNER[ownerRoot]?.has(targetRoot) ?? false;
}

function ownerKey(path: readonly PathSegment[]): string {
  return JSON.stringify(normalizePath(path));
}

function cyclicOwnerKeys(
  edges: ReadonlyMap<string, ReadonlySet<string>>,
): Set<string> {
  const state = new Map<string, "ACTIVE" | "DONE">();
  const stack: string[] = [];
  const cyclic = new Set<string>();

  const visit = (node: string): void => {
    if (state.get(node) === "DONE") {
      return;
    }
    if (state.get(node) === "ACTIVE") {
      const cycleStart = stack.lastIndexOf(node);
      for (const member of stack.slice(cycleStart)) {
        cyclic.add(member);
      }
      cyclic.add(node);
      return;
    }

    state.set(node, "ACTIVE");
    stack.push(node);
    for (const target of edges.get(node) ?? []) {
      visit(target);
    }
    stack.pop();
    state.set(node, "DONE");
  };

  for (const node of edges.keys()) {
    visit(node);
  }
  return cyclic;
}

export function validateContextualSourceReferences(
  document: unknown,
  occurrences: readonly SourceReferenceOccurrence[],
): ContextualReferenceIssue[] {
  const issues: ContextualReferenceIssue[] = [];
  const ownerPaths = new Map<string, string[]>();
  const validOccurrences: Array<{
    occurrence: SourceReferenceOccurrence;
    targetPath: string[];
  }> = [];

  for (const occurrence of occurrences) {
    ownerPaths.set(
      ownerKey(occurrence.ownerPath),
      normalizePath(occurrence.ownerPath),
    );
    const targetPath = decodeJsonPointer(occurrence.pointer);
    const issuePath = [...occurrence.metadataPath];

    if (!isAllowedSourceTarget(targetPath)) {
      issues.push({
        message:
          "Source reference must target report input evidence, not report-owned metadata or presentation fields",
        path: issuePath,
      });
      continue;
    }
    if (!resolvesJsonPointer(document, occurrence.pointer)) {
      issues.push({
        message: "Source reference does not resolve within the report",
        path: issuePath,
      });
      continue;
    }
    if (!isRelatedToOwner(occurrence.ownerPath, targetPath)) {
      issues.push({
        message:
          "Source reference is unrelated to the owner or points to a later evidence stage",
        path: issuePath,
      });
      continue;
    }

    const normalizedOwner = normalizePath(occurrence.ownerPath);
    if (pathsOverlap(targetPath, normalizedOwner)) {
      issues.push({
        message:
          "Source reference cannot use its owner, an owner ancestor, or an owner descendant as self-authenticating evidence",
        path: issuePath,
      });
      continue;
    }
    validOccurrences.push({ occurrence, targetPath });
  }

  const edges = new Map<string, Set<string>>();
  for (const { occurrence, targetPath } of validOccurrences) {
    const sourceOwner = ownerKey(occurrence.ownerPath);
    const targets = edges.get(sourceOwner) ?? new Set<string>();
    for (const [targetOwner, targetOwnerPath] of ownerPaths) {
      if (
        targetOwner !== sourceOwner &&
        pathsOverlap(targetPath, targetOwnerPath)
      ) {
        targets.add(targetOwner);
      }
    }
    edges.set(sourceOwner, targets);
  }

  const cyclic = cyclicOwnerKeys(edges);
  for (const { occurrence } of validOccurrences) {
    if (cyclic.has(ownerKey(occurrence.ownerPath))) {
      issues.push({
        message: "Source references cannot form a metadata dependency cycle",
        path: [...occurrence.metadataPath],
      });
    }
  }

  return issues;
}
