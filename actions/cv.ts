/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";
import { prisma } from "lib/prisma";
import { openai } from "lib/openai";
import { generateObject } from "ai";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

export const CVSchema = z.object({
  name: z.string(),
  profession: z.string(),
  contact: z.object({
    email: z.string().email(),
    phone: z.string(),
    portfolio: z.string().optional(),
    linkedin: z.string().optional(),
    github: z.string().optional(),
  }),
  bio: z.string().optional(),
  soft_skills: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
  cetifications: z.array(z.string()).optional(),
  native_language: z.string().optional(),
  languages: z.array(z.string()).optional(),
  experience: z.array(
    z
      .object({
        company: z.string(),
        position: z.string(),
        duration: z.string(),
        description: z.string(),
      })
      .optional()
  ),
  education: z.array(
    z
      .object({
        institution: z.string(),
        degree: z.string(),
        duration: z.string(),
      })
      .optional()
  ),
  projects: z
    .array(
      z
        .object({
          url: z.string(),
          description: z.string(),
          technologies: z.array(z.string()),
        })
        .optional()
    )
    .optional(),
});

export const cvToJSON = async (buffer: Buffer) => {
  try {
    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: CVSchema,
      prompt:
        "analyze and extract data from the CV attached to the prompt. Complete the data according to the CVSchema schema. If the schema does not contain fields that appear in the CV, create a new field in the returned object." +
        buffer.toString(),
    });
    console.log("Extracted text:", result.object);
    return result.object;
  } catch (error) {
    console.error("Error extracting text:", error);
    throw new Error("Extracting text from CV failed.");
  }
};

const computeFileHash = (buffer: Buffer): string => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

type SaveCVParams = {
  fileBuffer: Buffer;
  name: string;
  fileName: string;
  mimeType: string;
  userId: string;
  extractedCV: object;
};

export async function saveCV({
  fileBuffer,
  name,
  fileName,
  mimeType,
  userId,
  extractedCV,
}: SaveCVParams) {
  try {
    const cvHash = computeFileHash(fileBuffer);

    const savedCV = await prisma.cV.create({
      data: {
        cv: fileBuffer,
        name,
        fileName,
        mimeType,
        userId,
        cvHash,
        extractedCV: extractedCV as Prisma.JsonObject,
      },
    });

    //console.log("successfully saved CV");
    return savedCV;
  } catch (error) {
    //console.error("Error saving CV:", error);
    throw new Error(`Failed to save CV - ${error}`);
  }
}

export async function getCV(userId: string) {
  try {
    const cv = await prisma.cV.findFirst({
      where: {
        userId,
      },
    });

    if (!cv || !cv.extractedCV) {
      throw new Error("CV not found or extracted data is missing");
    }

    console.log("Retrieved CV:", cv.extractedCV);

    const parsedCV = CVSchema.safeParse(cv.extractedCV);
    if (!parsedCV.success) {
      throw new Error("Extracted CV data does not match the expected format");
    }

    return parsedCV.data;
  } catch (error) {
    throw new Error(`Failed to get CV - ${error}`);
  }
}

export async function getCVById(cvId: number) {
  try {
    const cv = await prisma.cV.findUnique({
      where: {
        id: cvId,
      },
    });

    if (!cv || !cv.extractedCV) {
      throw new Error("CV not found or extracted data is missing");
    }

    console.log("Retrieved CV by ID:", cv.extractedCV);

    const parsedCV = CVSchema.safeParse(cv.extractedCV);
    if (!parsedCV.success) {
      throw new Error("Extracted CV data does not match the expected format");
    }

    return parsedCV.data;
  } catch (error) {
    throw new Error(`Failed to get CV by ID - ${error}`);
  }
}

export async function getAllUserCVs(userDBId: string) {
  try {
    // Fetch CVs for the specific user by filtering with userDBId
    const cvs = await prisma.cV.findMany({
      where: {
        userId: userDBId,
      },
      include: {
        user: true,
      },
    });

    if (!cvs || cvs.length === 0) {
      throw new Error(`No CVs found for user with ID: ${userDBId}`);
    }

    const parsedCVs = cvs.map((cv) => {
      const parsedCV = CVSchema.safeParse(cv.extractedCV);

      if (!parsedCV.success) {
        console.error(`Invalid CV data for user: ${cv.userId}`);
        return {
          id: cv.id,
          name: cv.name,
          fileName: cv.fileName,
          user: cv.user,
          error: "Extracted CV data does not match the expected format",
        };
      }

      return {
        id: cv.id,
        name: cv.name,
        fileName: cv.fileName,
        user: cv.user,
        extractedCV: parsedCV.data,
      };
    });

    return parsedCVs;
  } catch (error) {
    console.error(`Error retrieving CVs for user ${userDBId}:`, error);
    throw new Error(`Failed to retrieve CVs for user ${userDBId} - ${error}`);
  }
}
