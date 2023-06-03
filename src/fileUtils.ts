import { exec } from "child_process";
import fs from "fs";
import gitdiffParser from "gitdiff-parser";
import path from "path";
import os from "os"

import {
  Features,
  arrangements,
  getFeaturesString,
  getT3Versions,
} from "@/utils";
import { DIFFS_PATH, EXISTING_DIFFS_PATH, IGNORED_DIFFS_PATH } from "./consts";

export interface DiffLocation {
  currentVersion: string;
  upgradeVersion: string;
  features: Features;
}

export const executeCommand = (command: string, options?: { cwd?: string }) => {
  const isWindows = os.platform() === "win32";
  let updatedCommand = command;
  if (options?.cwd) {
    const normalizedPath = path.normalize(options.cwd);
    if (isWindows) {
      updatedCommand = `cd ${normalizedPath}; ${command}`;
    } else {
      updatedCommand = `cd ${normalizedPath} && ${command}`;
    }
  }
  return new Promise((resolve, reject) => {
    exec(updatedCommand, { shell: isWindows ? 'powershell.exe' : '/bin/sh' }, (error, stdout) => {
      if (error) {
        console.error(error);
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
};

export const getDiffPath = ({
  currentVersion,
  upgradeVersion,
  features,
}: DiffLocation) => {
  const featuresString = getFeaturesString(features);
  return path.join(
    DIFFS_PATH,
    `diff-${currentVersion}-${upgradeVersion}${featuresString ? `-${featuresString}` : ""
    }.patch`,
  );
};

export const getExistingDiffsMap = () => {
  const existingDiffs = fs.readFileSync(EXISTING_DIFFS_PATH, "utf8");
  const existingDiffsObject = JSON.parse(existingDiffs);

  return existingDiffsObject;
};

export const checkIfDiffIsEmpty = (diff: string) => {
  const files = gitdiffParser.parse(diff);
  if (files.length > 1) {
    return false;
  }

  const file = files[0];
  if (!file?.newPath.includes("package.json")) {
    return false;
  }

  const hunks = file.hunks.map((hunk) => {
    return hunk.changes
      .filter((change) => change.type === "insert" || change.type === "delete")
      .map((change) => change.content.trim())
      .join("");
  });

  return hunks.every(
    (hunk) => hunk.includes("name") || hunk.includes("initVersion"),
  );
};

export const sortT3Versions = (t3Versions: string[]) => {
  return t3Versions.sort((a, b) => {
    const [aMajorStr, aMinorStr, aPatchStr] = a.split(".");
    const aMajor = Number(aMajorStr);
    const aMinor = Number(aMinorStr);
    const aPatch = Number(aPatchStr);
    const [bMajorStr, bMinorStr, bPatchStr] = b.split(".");
    const bMajor = Number(bMajorStr);
    const bMinor = Number(bMinorStr);
    const bPatch = Number(bPatchStr);

    if (aMajor > bMajor) {
      return 1;
    } else if (aMajor < bMajor) {
      return -1;
    }

    if (aMinor > bMinor) {
      return 1;
    } else if (aMinor < bMinor) {
      return -1;
    }

    if (aPatch > bPatch) {
      return 1;
    } else if (aPatch < bPatch) {
      return -1;
    }

    return 0;
  });
};

export const ignoreDiffs = async (diffs: string[]) => {
  const ignoredDiffs = await fs.promises.readFile(IGNORED_DIFFS_PATH, "utf8");
  const ignoredDiffsObject: Record<string, boolean> = JSON.parse(ignoredDiffs);
  const ignoredDiffsArray = Object.keys(ignoredDiffsObject);
  for (const diff of diffs) {
    if (!ignoredDiffsArray.includes(diff)) {
      ignoredDiffsArray.push(diff);
    }
  }

  const sortedIgnoredDiffs = sortT3Versions(ignoredDiffsArray);
  const sortedIgnoredDiffsObject: Record<string, boolean> = {};

  sortedIgnoredDiffs.forEach((element) => {
    sortedIgnoredDiffsObject[element] = true;
  });

  await fs.promises.writeFile(
    IGNORED_DIFFS_PATH,
    JSON.stringify(sortedIgnoredDiffsObject, null, 2),
  );
};

export const getMissingDiffs = async (count: number) => {
  const t3Versions = await getT3Versions();
  const ignoredDiffs = await fs.promises.readFile(IGNORED_DIFFS_PATH, "utf8");
  const ignoredDiffsObject: Record<string, boolean> = JSON.parse(ignoredDiffs);
  const sortedT3Versions = t3Versions.sort((a, b) => {
    const aParts = a.split(".").map(Number);
    const bParts = b.split(".").map(Number);

    for (let i = 0; i < aParts.length; i++) {
      const aPart = aParts[i] as number;
      const bPart = bParts[i] as number;
      if (aPart > bPart) {
        return 1;
      } else if (aPart < bPart) {
        return -1;
      }
    }

    return 0;
  });

  const filteredT3Versions = sortedT3Versions.filter((version) => {
    const [majorStr, minorStr, patchStr] = version.split(".");
    const major = Number(majorStr);
    const minor = Number(minorStr);
    const patch = Number(patchStr);
    if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
      console.warn(`Failed to parse version ${version}`);
      return false;
    }
    // ignore versions under 5.10.3
    if (major < 5) {
      return false;
    }
    if (major === 5 && minor < 10) {
      return false;
    }
    if (major === 5 && minor === 10 && patch < 3) {
      return false;
    }
    return true;
  });

  const existingDiffsMap = getExistingDiffsMap();
  const newDiffsMap: { [key: string]: boolean } = {};

  const features = ["nextAuth", "prisma", "trpc", "tailwind"];

  for (let i = 0; i < filteredT3Versions.length; i++) {
    const currentVersion = filteredT3Versions[i] as string;
    for (let j = i + 1; j < filteredT3Versions.length; j++) {
      const upgradeVersion = filteredT3Versions[j] as string;
      const combinations = arrangements(features);

      const noFeaturesDiff = `${currentVersion}..${upgradeVersion}`;
      if (
        !existingDiffsMap[noFeaturesDiff] &&
        !ignoredDiffsObject[noFeaturesDiff]
      ) {
        newDiffsMap[noFeaturesDiff] = true;
      }

      for (const combination of combinations) {
        const features: Features = {
          nextAuth: combination.includes("nextAuth"),
          prisma: combination.includes("prisma"),
          trpc: combination.includes("trpc"),
          tailwind: combination.includes("tailwind"),
        };

        const key = `${currentVersion}..${upgradeVersion}-${getFeaturesString(
          features,
        )}`;

        if (existingDiffsMap[key] || ignoredDiffsObject[key]) {
          continue;
        }

        newDiffsMap[key] = true;
      }
    }
  }

  console.log(`Found ${Object.keys(newDiffsMap).length} new diffs`);

  const start = 0;
  const end = Math.min(count, Object.keys(newDiffsMap).length);

  return Object.keys(newDiffsMap).slice(start, end).reverse();
};
