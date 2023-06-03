import path from "path";

export const DIFFS_PATH = path.join(process.cwd(), "diffs");
export const EXISTING_DIFFS_PATH = path.join(process.cwd(), "existing-diffs.json");
export const IGNORED_DIFFS_PATH = path.join(process.cwd(), "ignored-diffs.json");
export const EMPTY_DIFFS_PATH = path.normalize("/tmp/emptyDiffs");
