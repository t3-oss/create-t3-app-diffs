import fs from "fs";
import path from "path";
import { z } from "zod";
import { rimraf } from "rimraf";
import os from "os";

import { checkIfDiffIsEmpty, executeCommand, getDiffPath } from "@/fileUtils";
import { getFeaturesString } from "@/utils";
import { IGNORED_DIFFS_PATH } from "./consts";

const paramsSchema = z.object({
  currentVersion: z.string(),
  upgradeVersion: z.string(),
  features: z.object({
    nextAuth: z.boolean().optional(),
    prisma: z.boolean().optional(),
    trpc: z.boolean().optional(),
    tailwind: z.boolean().optional(),
  }),
});

export default async function generateDiff(params: unknown) {
  const { success } = paramsSchema.safeParse(params);
  if (!success) {
    return { error: "Invalid request body" };
  }
  const { currentVersion, upgradeVersion, features } =
    paramsSchema.parse(params);
  const featureFlags = Object.entries(features)
    .filter(([, value]) => value)
    .map(([key]) => `--${key}=true`)
    .join(" ");

  const diffPath = getDiffPath({ currentVersion, upgradeVersion, features });
  const featuresString = getFeaturesString(features);
  const diffDir = `/tmp/${currentVersion}..${upgradeVersion}${
    featuresString ? `-${featuresString}` : ""
  }`;
  const url = `/diff/${currentVersion}..${upgradeVersion}${
    featuresString ? `-${featuresString}` : ""
  }`;

  const currentProjectPath = path.join(diffDir, "current");
  const upgradeProjectPath = path.join(diffDir, "upgrade");

  // Make sure the directories don't exist
  await rimraf(currentProjectPath);
  await rimraf(upgradeProjectPath);

  // Check if ~/.gitconfig exists
  const author = fs.existsSync(path.join(process.env.HOME ?? "", ".gitconfig"));
  if (!author) {
    // Configure git author
    await executeCommand(`
      git config --global user.email "t3-bot@example.com"
      git config --global user.name "T3 Bot"
    `);
  }

  const getCommand = (version: string, path: string) =>
    `pnpm create t3-app@${version} ${path} --CI ${featureFlags} --noInstall`;

  if (fs.existsSync(diffPath)) {
    const differences = fs.readFileSync(diffPath, "utf8");

    return { differences, url };
  }

  // check if the diff is ignored
  const ignoredDiffs = fs.readFileSync(IGNORED_DIFFS_PATH, "utf8");
  const ignoredDiffsObject = JSON.parse(ignoredDiffs);
  if (
    ignoredDiffsObject[
      `${currentVersion}..${upgradeVersion}${
        featuresString ? `-${featuresString}` : ""
      }`
    ]
  ) {
    return { differences: "", url };
  }

  try {
    await executeCommand(getCommand(currentVersion, currentProjectPath));
    await executeCommand(getCommand(upgradeVersion, upgradeProjectPath));

    // Git init the current project
    await executeCommand(`
      cd ${currentProjectPath} &&
      git init &&
      git add . &&
      git commit -m "Initial commit" &&
      cd ../
    `);

    const isWindows = os.platform() === "win32";

    // copy the upgrade project over the current project
    if (isWindows) {
      // Use robocopy on windows
      await executeCommand(
        `robocopy ${upgradeProjectPath} ${currentProjectPath} /MIR /XD .git`,
      );
    } else {
      // Use rsync on linux
      await executeCommand(
        `rsync -a --delete --exclude=.git/ ${upgradeProjectPath}/ ${currentProjectPath}/`,
      );
    }

    // Generate the diff
    await executeCommand(`
      cd ${currentProjectPath} &&
      git add . &&
      git diff --staged > ${diffPath} &&
      cd ../
    `);

    // Read the diff
    const differences = fs.readFileSync(diffPath, "utf8");

    await rimraf(diffDir)

    console.log(
      `Generated diff: ${currentVersion}..${upgradeVersion}${
        featuresString ? `-${featuresString}` : ""
      }`,
    );

    // create a directory for empty diffs
    if (!fs.existsSync("/tmp/emptyDiffs")) {
      fs.mkdirSync("/tmp/emptyDiffs");
    }

    if (checkIfDiffIsEmpty(differences)) {
      // Delete the diff if it's empty
      await rimraf(diffPath)
      // Create a file with the filename to indicate that the diff is empty
      fs.writeFileSync(
        `/tmp/emptyDiffs/${currentVersion}..${upgradeVersion}${
          featuresString ? `-${featuresString}` : ""
        }`,
        "",
      );

      return { differences: "", url };
    }

    // Send the diff back to the client
    return { differences, url };
  } catch (error) {
    return { error };
  }
}
