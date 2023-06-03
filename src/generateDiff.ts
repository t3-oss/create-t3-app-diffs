import fs from "fs";
import os from "os";
import path from "path";
import { rimraf } from "rimraf";
import { z } from "zod";

import { checkIfDiffIsEmpty, executeCommand, getDiffPath } from "@/fileUtils";
import { getFeaturesString } from "@/utils";
import {
  EMPTY_DIFFS_PATH,
  GENERATED_DIFFS_PATH,
  IGNORED_DIFFS_PATH,
} from "./consts";

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

  // Create diffDir if it doesn't exist
  if (!fs.existsSync(diffDir)) {
    fs.mkdirSync(diffDir);
  }

  // Check if ~/.gitconfig exists
  const author = fs.existsSync(path.join(process.env.HOME ?? "", ".gitconfig"));
  if (!author) {
    // Configure git author
    await executeCommand(`
      git config --global user.email "t3-bot@example.com"
      git config --global user.name "T3 Bot"
    `);
  }

  const getCommand = (version: string, folderName: string) =>
    `pnpm create t3-app@${version} ${folderName} --CI ${featureFlags} --noInstall`;

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
    await executeCommand(getCommand(currentVersion, "current"), {
      cwd: diffDir,
    });
    await executeCommand(getCommand(upgradeVersion, "upgrade"), {
      cwd: diffDir,
    });

    await executeCommand(`git add .`, { cwd: currentProjectPath });
    await executeCommand(`git commit -m "Initial commit"`, {
      cwd: currentProjectPath,
    });

    const isWindows = os.platform() === "win32";

    // copy the upgrade project over the current project
    if (isWindows) {
      // Use robocopy on windows
      try {
        await executeCommand(
          `robocopy ${upgradeProjectPath} ${currentProjectPath} /MIR /XD .git`,
          { silent: true },
        );
      } catch (error: any) {
        if ((error?.code as number) > 8) {
          // if error code is < 8, it means the command was successful so we can ignore the error
          // https://ss64.com/nt/robocopy-exit.html
          throw error;
        }
      }
    } else {
      // Use rsync on linux
      await executeCommand(
        `rsync -a --delete --exclude=.git/ ${upgradeProjectPath}/ ${currentProjectPath}/`,
      );
    }

    // Generate the diff
    await executeCommand(`git add .`, { cwd: currentProjectPath });
    await executeCommand(`git diff --staged > ${diffPath}`, {
      cwd: currentProjectPath,
    });

    // Read the diff
    const differences = fs.readFileSync(diffPath, "utf8");

    await rimraf(diffDir);

    console.log(
      `Generated diff: ${currentVersion}..${upgradeVersion}${
        featuresString ? `-${featuresString}` : ""
      }`,
    );

    // create a directory for empty diffs
    if (!fs.existsSync(EMPTY_DIFFS_PATH)) {
      fs.mkdirSync(EMPTY_DIFFS_PATH);
    }

    if (checkIfDiffIsEmpty(differences)) {
      // Delete the diff if it's empty
      await rimraf(diffPath);
      const emptyDiffPath = path.join(
        EMPTY_DIFFS_PATH,
        `${currentVersion}..${upgradeVersion}${
          featuresString ? `-${featuresString}` : ""
        }`,
      );
      // Create a file with the filename to indicate that the diff is empty
      fs.writeFileSync(emptyDiffPath, "");

      return { differences: "", url };
    } else {
      const generatedDiffPath = path.join(
        GENERATED_DIFFS_PATH,
        `${currentVersion}..${upgradeVersion}${
          featuresString ? `-${featuresString}` : ""
        }`,
      );
      fs.writeFileSync(generatedDiffPath, "");
    }

    // Send the diff back to the client
    return { differences, url };
  } catch (error) {
    return { error };
  }
}
