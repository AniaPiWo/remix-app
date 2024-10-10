/* eslint-disable @typescript-eslint/no-unused-vars */
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { useState } from "react";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";

// Funkcja "action" do obsługi zapisania danych tekstowych lub przetwarzania pliku
export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  if (formData.has("userInput")) {
    const userInput = formData.get("userInput");
    return json({ userInput });
  }

  if (formData.has("file")) {
    const file = formData.get("file") as File;
    const fileBuffer = await file.arrayBuffer();
    const base64String = Buffer.from(fileBuffer).toString("base64");

    return json({ fileName: file.name, fileContentBase64: base64String });
  }

  return json({ error: "Nieobsługiwany formularz" });
};

// Funkcja "loader" do ładowania początkowych danych
export const loader: LoaderFunction = async () => {
  const initialData = "Witaj na stronie! Wprowadź tekst lub prześlij plik.";
  return json({ initialData });
};

type LoaderData = {
  initialData: string;
};

type ActionData = {
  userInput?: string;
  fileName?: string;
  fileContentBase64?: string;
};

const steps = ["Formularz tekstowy", "Przesyłanie pliku", "Trzeci ekran"];

export default function Index() {
  const actionData = useActionData<ActionData>();
  const loaderData = useLoaderData<LoaderData>();
  const [currentStep, setCurrentStep] = useState(0);

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
    <div className="flex flex-col h-screen items-center justify-center">
      <h1>Stepper w Remix</h1>
      <p>
        Krok {currentStep + 1}: {steps[currentStep]}
      </p>

      {/* Wyświetlanie zawartości w zależności od bieżącego kroku */}
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
          <h2>Trzeci Ekran</h2>
          <p>
            To jest trzeci ekran z tekstem. Możesz dodać tutaj dowolną
            zawartość.
          </p>
        </div>
      )}

      {/* Wyświetlanie wyników z formularza */}
      {actionData?.userInput && <p>Wprowadziłeś: {actionData.userInput}</p>}
      {actionData?.fileName && (
        <div>
          <p>Przesłano plik: {actionData.fileName}</p>
          <p>Zawartość pliku (base64):</p>
          <textarea
            readOnly
            rows={10}
            cols={40}
            value={actionData.fileContentBase64}
          ></textarea>
        </div>
      )}

      {/* Przyciski nawigacji */}
      <div className="mt-4">
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
    </div>
  );
}
