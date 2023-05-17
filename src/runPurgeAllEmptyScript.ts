import { purgeAllEmptyDiffs } from "@/purgeAllEmptyDiffs";

purgeAllEmptyDiffs()
  .then((deletedDiffsCount) => {
    console.log(`Done! Deleted ${deletedDiffsCount} diffs`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
