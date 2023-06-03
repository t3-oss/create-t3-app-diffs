import { generateAllMissingDiffs } from "@/generateAllMissingDiffs";
import { updateExistingDiffsMap } from "./updateExistingDiffsMap";

generateAllMissingDiffs()
  .then(() => {
    console.log("Done generating all missing diffs");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    console.log("Updating existing diffs map");
    updateExistingDiffsMap().then(() => {
      console.log("Done!");
      process.exit(0);
    });
  });
