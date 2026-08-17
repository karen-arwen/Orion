export interface SearchReplaceOperation {
  search: string;
  replace: string;
  replaceAll?: boolean;
}

export interface SearchReplaceResult {
  content: string;
  replacements: number;
}

export function applySearchReplaceOperations(
  original: string,
  operations: SearchReplaceOperation[],
): SearchReplaceResult {
  if (operations.length === 0) throw new Error("NO_PATCH_OPERATIONS");
  let content = original;
  let replacements = 0;

  for (const operation of operations) {
    if (!operation.search) throw new Error("EMPTY_SEARCH_BLOCK");
    const occurrences = countOccurrences(content, operation.search);
    if (occurrences === 0) throw new Error("SEARCH_BLOCK_NOT_FOUND");
    if (occurrences > 1 && !operation.replaceAll) throw new Error("SEARCH_BLOCK_NOT_UNIQUE");
    content = operation.replaceAll
      ? content.split(operation.search).join(operation.replace)
      : content.replace(operation.search, operation.replace);
    replacements += operation.replaceAll ? occurrences : 1;
  }

  return { content, replacements };
}

export function buildUnifiedPreview(path: string, before: string, after: string, maxLines = 160): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const rows: string[] = [`--- ${path}`, `+++ ${path}`];
  const max = Math.max(beforeLines.length, afterLines.length);

  for (let index = 0; index < max; index += 1) {
    const oldLine = beforeLines[index];
    const newLine = afterLines[index];
    if (oldLine === newLine) {
      if (rows.length < maxLines && changedNearby(beforeLines, afterLines, index)) {
        rows.push(` ${oldLine ?? ""}`);
      }
      continue;
    }
    if (oldLine !== undefined) rows.push(`-${oldLine}`);
    if (newLine !== undefined) rows.push(`+${newLine}`);
    if (rows.length >= maxLines) {
      rows.push("... diff truncado ...");
      break;
    }
  }

  return rows.join("\n");
}

function countOccurrences(input: string, search: string): number {
  let count = 0;
  let index = input.indexOf(search);
  while (index !== -1) {
    count += 1;
    index = input.indexOf(search, index + search.length);
  }
  return count;
}

function changedNearby(beforeLines: string[], afterLines: string[], index: number): boolean {
  for (let offset = -2; offset <= 2; offset += 1) {
    const position = index + offset;
    if (position < 0) continue;
    if (beforeLines[position] !== afterLines[position]) return true;
  }
  return false;
}
