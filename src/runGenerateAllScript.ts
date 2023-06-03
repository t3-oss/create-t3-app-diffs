import { generateAllMissingDiffs } from "@/generateAllMissingDiffs";
import { updateExistingDiffsMap } from "./updateExistingDiffsMap";

generateAllMissingDiffs()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    updateExistingDiffsMap();
  });
