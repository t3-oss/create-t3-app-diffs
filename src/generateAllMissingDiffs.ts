import fs from "fs";
import path from "path";

import { getMissingDiffs } from "@/fileUtils";
import generateDiff from "@/generateDiff";
import { extractVersionsAndFeatures } from "@/utils";

export const generateAllMissingDiffs = async () => {
  console.log("Generating all missing diffs");
  const missingDiffs = await getMissingDiffs(Infinity);

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
      // read files in /tmp/emptyDiffs
      const emptyDiffs = await fs.promises.readdir("/tmp/emptyDiffs");
      console.log(`Empty diffs: ${emptyDiffs.length}`);
      console.log("Empty diff example: ", emptyDiffs[0]);
      // create a new file in the diffs folder named ignoredDiffs that contains the empty diffs if it doesn't exist already
      const ignoredDiffsPath = path.join(
        process.cwd(),
        "diffs",
        "ignoredDiffs.txt",
      );
      // append the empty diffs to the ignoredDiffs file
      await fs.promises.appendFile(ignoredDiffsPath, emptyDiffs.join("\n"));
      // delete the empty diffs
      await Promise.all(
        emptyDiffs.map((emptyDiff) =>
          fs.promises.unlink(path.join("/tmp/emptyDiffs", emptyDiff)),
        ),
      );
    } catch (error) {
      console.error(error);
    }
    const timeEnd = performance.now();
    console.count("Generated batch");
    console.log(`Batch took ${timeEnd - timeStart}ms`);
  }
};
