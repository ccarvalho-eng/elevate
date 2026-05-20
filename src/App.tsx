import { useRef, useState, type ChangeEvent } from "react";

import { normalizeImageFile } from "./blueprint/normalize";
import {
  BlueprintExtractionError,
  extractPlanFromCanvas,
} from "./extractor/planExtractor";
import { simplePlan } from "./fixtures/simplePlan";
import { buildModelSpec, type ModelSpec } from "./model/modelBuilder";
import { validateBlueprintFile } from "./upload/accept";
import { renderPdfPage } from "./upload/pdf";
import { BlueprintViewer } from "./viewer/BlueprintViewer";

const sampleModel = buildModelSpec(simplePlan);
const fallbackWarning =
  "Could not extract enough walls, so the sample model is still shown.";

type UploadStatus = {
  message: string;
  tone: "error" | "success" | "warning";
};

const statusRole = (tone: UploadStatus["tone"]) =>
  tone === "error" ? "alert" : "status";

const isKnownGenerationError = (error: unknown): boolean => {
  if (error instanceof BlueprintExtractionError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return [
    "blueprint image",
    "canvas",
    "pdf",
    "could not load",
    "dimensions exceed",
  ].some((text) => error.message.toLowerCase().includes(text));
};

export function App() {
  const validationRequestId = useRef(0);
  const [model, setModel] = useState<ModelSpec>(sampleModel);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);

  const handleBlueprintChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const requestId = validationRequestId.current + 1;
    validationRequestId.current = requestId;
    const file = event.currentTarget.files?.[0];

    if (!file) {
      setUploadStatus(null);
      return;
    }

    const validation = await validateBlueprintFile(file).catch(() => ({
      ok: false as const,
      reason: "Upload a PNG, JPG, or PDF blueprint." as const,
    }));

    if (requestId !== validationRequestId.current) {
      return;
    }

    if (!validation.ok) {
      setUploadStatus({ message: validation.reason, tone: "error" });
      return;
    }

    setUploadStatus({ message: "Generating perspective.", tone: "success" });

    try {
      const normalized =
        validation.kind === "pdf"
          ? await renderPdfPage(file, 0)
          : await normalizeImageFile(file);

      if (requestId !== validationRequestId.current) {
        return;
      }

      const plan = extractPlanFromCanvas(normalized.canvas);

      if (plan.walls.length < 4) {
        setModel(sampleModel);
        setUploadStatus({ message: fallbackWarning, tone: "warning" });
        return;
      }

      setModel(buildModelSpec(plan));
      setUploadStatus({
        message: "Generated perspective from blueprint.",
        tone: "success",
      });
    } catch (error) {
      if (requestId !== validationRequestId.current) {
        return;
      }

      if (isKnownGenerationError(error)) {
        setModel(sampleModel);
        setUploadStatus({ message: fallbackWarning, tone: "warning" });
        return;
      }

      setModel(sampleModel);
      setUploadStatus({
        message:
          "Could not process this blueprint, so the sample model is still shown.",
        tone: "error",
      });
    }
  };

  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="app-topbar" aria-label="Application workspace">
          <p className="app-brand">Elevate</p>
        </header>

        <section className="workspace">
          <aside className="upload-panel">
            <div className="panel-header">
              <span>Properties</span>
              <span>Blueprint</span>
            </div>
            <p className="eyebrow">Elevate</p>
            <h1>Generate rough house perspectives from a blueprint.</h1>
            <p>
              Upload a PNG, JPG, or PDF plan and inspect a simple roof-off,
              exterior, front, side, or interior perspective.
            </p>
            <div className="panel-section">
              <span className="field-label">Source file</span>
              <input
                aria-label="Upload blueprint"
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                onChange={handleBlueprintChange}
              />
            </div>
            {uploadStatus ? (
              <p
                className={`upload-status ${uploadStatus.tone}`}
                role={statusRole(uploadStatus.tone)}
              >
                {uploadStatus.message}
              </p>
            ) : null}
          </aside>
          <BlueprintViewer model={model} />
        </section>

        <footer className="status-strip" aria-label="Viewport status">
          <span>Object Mode</span>
          <span>Perspective</span>
          <span>Units: meters</span>
        </footer>
      </div>
    </main>
  );
}
