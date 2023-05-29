import fs from "fs";
import path from "path";

import { checkIfDiffIsEmpty, ignoreDiffs } from "@/fileUtils";
import { extractVersionsAndFeatures, getFeaturesString } from "@/utils";
import { DIFFS_PATH } from "./consts";

export const purgeAllEmptyDiffs = async () => {
  const existingDiffs = fs.readdirSync(DIFFS_PATH);

  const emptyDiffs = existingDiffs.filter((diff) => {
    const diffPath = path.join(DIFFS_PATH, diff);
    const diffContents = fs.readFileSync(diffPath, "utf8");
    return checkIfDiffIsEmpty(diffContents);
  });

  for (const diff of emptyDiffs) {
    const diffPath = path.join(DIFFS_PATH, diff);
    fs.unlinkSync(diffPath);
  }

  const emptyDiffsKeys = emptyDiffs
    .map((diff) => extractVersionsAndFeatures(diff))
    .map((diff) => {
      if (!diff) {
        return "";
      }
      const { currentVersion, upgradeVersion, features } = diff;
      const featuresString = getFeaturesString(features);
      return `${currentVersion}..${upgradeVersion}${
        featuresString ? `-${featuresString}` : ""
      }`;
    });

  await ignoreDiffs(emptyDiffsKeys);

  return emptyDiffs.length;
};
