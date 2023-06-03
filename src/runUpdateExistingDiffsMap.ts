import { updateExistingDiffsMap } from "@/updateExistingDiffsMap";

updateExistingDiffsMap()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
