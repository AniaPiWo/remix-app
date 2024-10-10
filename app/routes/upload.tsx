/* eslint-disable @typescript-eslint/no-unused-vars */
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { useState } from "react";
import { getAuth } from "@clerk/remix/ssr.server";
import { useClerk, useUser } from "@clerk/remix";
import type {
  ActionFunction,
  AppLoadContext,
  LoaderFunction,
} from "@remix-run/node";
import { createUserFromClerk, getUserByClerkId } from "actions/user";
import { cvToJSON, saveCV, getAllUserCVs } from "actions/cv";

// Funkcja "action" do obsługi zapisania danych tekstowych lub przetwarzania pliku
// tutaj wykonujemy różne akcje po stronie serwera
export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  if (formData.has("userInput")) {
    const userInput = formData.get("userInput");
    return json({ userInput });
  }

  if (formData.has("file")) {
    const file = formData.get("file") as File;
    const fileBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(fileBuffer);

    // Próba konwersji CV na JSON zgodnie ze schematem
    try {
      const extractedCV = await cvToJSON(buffer);
      const { userId } = await getAuth({
        request,
        params: {},
        context: {} as AppLoadContext,
      });

      if (!userId) {
        return json({ error: "User not authenticated" });
      }

      let user = await getUserByClerkId(userId);
      if (!user) {
        user = await createUserFromClerk(userId);
      }

      // Zapis CV do bazy danych
      const savedCV = await saveCV({
        fileBuffer: buffer,
        name: file.name,
        fileName: file.name,
        mimeType: file.type,
        userId: user.id,
        extractedCV,
      });

      return json({ fileName: file.name, extractedCV });
    } catch (error) {
      console.error("Error extracting text from CV:", error);
      return json({ error: "Extracting text from CV failed." });
    }
  }

  return json({ error: "Nieobsługiwany formularz" });
};

// Funkcja "loader" do ładowania początkowych danych
// tutaj zwracamy dane początkowe dla komponentu
export const loader: LoaderFunction = async (args) => {
  const { userId } = await getAuth(args);

  if (!userId) {
    console.log("No user logged in");
    return null;
  }

  let user = await getUserByClerkId(userId);

  if (!user) {
    console.log(`User with Clerk ID: ${userId} not found, creating user...`);
    user = await createUserFromClerk(userId);
  }

  let userCVs: (
    | {
        id: number;
        name: string;
        fileName: string;
        user: {
          id: string;
          name: string | null;
          email: string;
          clerkId: string;
        };
        error: string;
        extractedCV?: undefined;
      }
    | {
        id: number;
        name: string;
        fileName: string;
        user: {
          id: string;
          name: string | null;
          email: string;
          clerkId: string;
        };
        extractedCV: {
          name: string;
          profession: string;
          contact: {
            email: string;
            phone: string;
            portfolio?: string | undefined;
            linkedin?: string | undefined;
            github?: string | undefined;
          };
          experience: (
            | {
                company: string;
                position: string;
                duration: string;
                description: string;
              }
            | undefined
          )[];
          education: (
            | { duration: string; institution: string; degree: string }
            | undefined
          )[];
          bio?: string | undefined;
          soft_skills?: string[] | undefined;
          technologies?: string[] | undefined;
          cetifications?: string[] | undefined;
          native_language?: string | undefined;
          languages?: string[] | undefined;
          projects?:
            | (
                | { url: string; technologies: string[]; description: string }
                | undefined
              )[]
            | undefined;
        };
        error?: undefined;
      }
  )[];
  try {
    userCVs = await getAllUserCVs(user.id);
  } catch (error) {
    console.error(`Failed to retrieve CVs for user ${user.id}:`, error);
    userCVs = [];
  }

  return json({ userDBId: user.id, userCVs });
};

const steps = ["Formularz tekstowy", "Przesyłanie pliku", "Przegląd CV"];

// Komponent Index
export default function Index() {
  const actionData = useActionData<{
    userInput?: string;
    fileName?: string;
    extractedCV?: object;
    error?: string;
  }>();
  const loaderData = useLoaderData<{
    userCVs: {
      id: number;
      name: string;
      fileName: string;
      user: {
        id: string;
        name: string | null;
        email: string;
        clerkId: string;
      };
      extractedCV?: {
        name: string;
        profession: string;
        contact: {
          email: string;
          phone: string;
          portfolio?: string;
          linkedin?: string;
          github?: string;
        };
        experience: {
          company: string;
          position: string;
          duration: string;
          description: string;
        }[];
        education: {
          duration: string;
          institution: string;
          degree: string;
        }[];
        bio?: string;
        soft_skills?: string[];
        technologies?: string[];
        certifications?: string[];
        native_language?: string;
        languages?: string[];
        projects?: {
          url: string;
          technologies: string[];
          description: string;
        }[];
      };
      error?: string;
    }[];
  }>();
  const [currentStep, setCurrentStep] = useState(0);
  const { signOut } = useClerk();
  const { isSignedIn, user } = useUser();

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header with Clerk authentication buttons */}
      <header className="bg-gray-800 text-white py-4 px-6 flex justify-between items-center">
        <h1 className="text-lg font-bold">Remix App with Clerk</h1>
        <div>
          {isSignedIn ? (
            <div className="flex items-center gap-4">
              <span>Welcome, {user?.firstName}</span>
              <button
                onClick={() => signOut()}
                className="bg-red-500 px-4 py-2 rounded hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          ) : (
            <a
              href="/sign-in"
              className="bg-blue-500 px-4 py-2 rounded hover:bg-blue-600"
            >
              Login
            </a>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-col flex-grow items-center justify-center">
        <h1>Stepper w Remix</h1>
        <p>
          Krok {currentStep + 1}: {steps[currentStep]}
        </p>

        {currentStep === 0 && (
          <Form method="post">
            <textarea
              name="userInput"
              rows={5}
              cols={40}
              placeholder="Wprowadź tekst tutaj..."
            ></textarea>
            <br />
            <button type="submit">Zapisz</button>
          </Form>
        )}

        {currentStep === 1 && (
          <Form method="post" encType="multipart/form-data">
            <input type="file" name="file" />
            <br />
            <button type="submit">Wyślij plik</button>
          </Form>
        )}

        {currentStep === 2 && (
          <div>
            <h2>Przegląd CV</h2>
            {actionData?.error && (
              <p className="text-red-500">{actionData.error}</p>
            )}
            {actionData?.extractedCV && (
              <pre>{JSON.stringify(actionData.extractedCV, null, 2)}</pre>
            )}
            {loaderData?.userCVs && loaderData.userCVs.length > 0 ? (
              <div>
                <h3>Twoje CV:</h3>
                <ul>
                  {loaderData.userCVs.map(
                    (cv: {
                      id: number;
                      name: string;
                      fileName: string;
                      user: {
                        id: string;
                        name: string | null;
                        email: string;
                        clerkId: string;
                      };
                      extractedCV?: object;
                      error?: string;
                    }) => (
                      <li key={cv.id}>
                        <p>CV: {cv.name}</p>
                        <pre>{JSON.stringify(cv.extractedCV, null, 2)}</pre>
                      </li>
                    )
                  )}
                </ul>
              </div>
            ) : (
              <p>You have no CVs</p>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-12">
          <button onClick={handleBack} disabled={currentStep === 0}>
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={currentStep === steps.length - 1}
          >
            Next
          </button>
        </div>
      </main>
    </div>
  );
}
