import path from "path";

export const DIFFS_PATH = path.join(process.cwd(), "diffs");
export const IGNORED_DIFFS_PATH = path.join(DIFFS_PATH, "ignored-diffs.txt");
