// Steps:
//   1. Read the diffs folder
//   2. Generate a map of all the diffs
//   3. Write the map to existing-diffs.json

import fs from "fs";

import { DIFFS_PATH, EXISTING_DIFFS_PATH } from "./consts";
import { sortT3Versions } from "./fileUtils";
import { extractVersionsAndFeatures, getFeaturesString } from "./utils";

export const updateExistingDiffsMap = async () => {
  const diffs = await fs.promises.readdir(DIFFS_PATH);
  const diffsMap: Record<string, boolean> = {};
  for (const diff of diffs) {
    const versionsAndFeatures = extractVersionsAndFeatures(diff);
    if (!versionsAndFeatures) {
      continue;
    }
    const { currentVersion, upgradeVersion } = versionsAndFeatures;
    const featuresString = getFeaturesString(versionsAndFeatures.features);
    diffsMap[
      `${currentVersion}..${upgradeVersion}${
        featuresString ? `-${featuresString}` : ""
      }`
    ] = true;
  }

  const diffsArray = Object.keys(diffsMap);
  const sortedDiffs = sortT3Versions(diffsArray);
  const sortedDiffsObject: Record<string, boolean> = {};

  sortedDiffs.forEach((element) => {
    sortedDiffsObject[element] = true;
  });

  fs.writeFileSync(
    EXISTING_DIFFS_PATH,
    JSON.stringify(sortedDiffsObject, null, 2),
  );
};
