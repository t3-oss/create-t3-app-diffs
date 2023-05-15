import { z } from "zod";

export type VersionsGroupedByMajor = Array<{
    major: string;
    versions: string[];
}>;

export interface Features {
    nextAuth?: boolean;
    prisma?: boolean;
    trpc?: boolean;
    tailwind?: boolean;
}

export const paramsSchema = z.object({
    currentVersion: z.string(),
    upgradeVersion: z.string(),
    features: z.object({
        nextAuth: z.boolean().optional(),
        prisma: z.boolean().optional(),
        trpc: z.boolean().optional(),
        tailwind: z.boolean().optional(),
    }),
});
