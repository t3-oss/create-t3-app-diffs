import { z } from "zod";
import { Features } from "./types";

export const getT3Versions = async () => {
  const response = await fetch(
    "https://api.github.com/repos/t3-oss/create-t3-app/releases"
  );

  const responseSchema = z.array(z.object({ tag_name: z.string() }));
  const parsed = responseSchema.safeParse(await response.json());

  if (!parsed.success) {
    return [];
  }

  return parsed.data
    .map((release) => release.tag_name.split("@")[1] ?? "")
    .filter((v) => v !== "");
};

export const getFeaturesString = (features: Features) => {
  return Object.entries(features)
    .filter(([, value]) => value)
    .map(([key]) => key)
    .join("-");
};

export const extractVersionsAndFeatures = (slug: string) => {
  const regex =
    /(?<currentVersion>\d+\.\d+\.\d+).*(?<upgradeVersion>\d+\.\d+\.\d+)/;
  const match =
    (slug.match(regex) as RegExpMatchArray & {
      groups: {
        currentVersion: string;
        upgradeVersion: string;
      };
    }) || null;

  if (!match) {
    return null;
  }
  const { currentVersion, upgradeVersion } = match.groups;

  return {
    currentVersion: currentVersion,
    upgradeVersion: upgradeVersion,
    features: {
      nextAuth: slug.includes("nextAuth"),
      prisma: slug.includes("prisma"),
      trpc: slug.includes("trpc"),
      tailwind: slug.includes("tailwind"),
    },
  };
};

export const arrangements = (array: string[]) => {
  const result: string[][] = [[]];

  for (const element of array) {
    const length = result.length;
    for (let i = 0; i < length; i++) {
      const subset = result[i]?.slice() ?? [];
      subset.push(element);
      result.push(subset);
    }
  }

  return result
    .filter((subset) => subset.length > 0)
    .map((subset) => subset.sort().join("-"));
};
