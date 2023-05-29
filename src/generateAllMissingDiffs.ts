import fs from "fs";

import { executeCommand, getMissingDiffs, ignoreDiffs } from "@/fileUtils";
import generateDiff from "@/generateDiff";
import { extractVersionsAndFeatures } from "@/utils";

export const generateAllMissingDiffs = async () => {
  console.log("Generating all missing diffs");
  const missingDiffs = await getMissingDiffs(Infinity);
  let remainingDiffs = missingDiffs.length;

  const batchSize = 20;

  const batchedMissingDiffs = [];
  for (let i = 0; i < missingDiffs.length; i += batchSize) {
    batchedMissingDiffs.push(missingDiffs.slice(i, i + batchSize));
  }

  for (const batch of batchedMissingDiffs) {
    const promises = batch.map((diffLocation) => {
      const versionsAndFeatures = extractVersionsAndFeatures(diffLocation);

      if (!versionsAndFeatures) {
        return { error: "Invalid diff location", differences: undefined };
      }

      return generateDiff(versionsAndFeatures);
    });

    const timeStart = performance.now();
    try {
      await Promise.all(promises);
      const emptyDiffs = await fs.promises.readdir("/tmp/emptyDiffs");
      if (emptyDiffs.length) {
        await ignoreDiffs(emptyDiffs);
        await executeCommand("rm -rf /tmp/emptyDiffs/*");
      }
    } catch (error) {
      console.error(error);
    }
    const timeEnd = performance.now();
    console.count("Generated batch");
    remainingDiffs -= batch.length;
    console.log(`Batch took ${timeEnd - timeStart}ms. ${remainingDiffs} left`);
  }
};
