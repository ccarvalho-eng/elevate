import { useRef, useState, type ChangeEvent } from "react";

import { simplePlan } from "./fixtures/simplePlan";
import { buildModelSpec } from "./model/modelBuilder";
import { validateBlueprintFile } from "./upload/accept";
import { BlueprintViewer } from "./viewer/BlueprintViewer";

const sampleModel = buildModelSpec(simplePlan);

export function App() {
  const validationRequestId = useRef(0);
  const [uploadStatus, setUploadStatus] = useState<{
    message: string;
    valid: boolean;
  } | null>(null);

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
      setUploadStatus({ message: validation.reason, valid: false });
      return;
    }

    setUploadStatus({ message: "Blueprint selected.", valid: true });
  };

  return (
    <main className="app-shell">
      <section className="workspace">
        <div className="upload-panel">
          <p className="eyebrow">Elevate</p>
          <h1>Generate rough house perspectives from a blueprint.</h1>
          <p>
            Upload a PNG, JPG, or PDF plan and inspect a simple roof-off,
            exterior, front, side, or interior perspective.
          </p>
          <input
            aria-label="Upload blueprint"
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            onChange={handleBlueprintChange}
          />
          {uploadStatus ? (
            <p role={uploadStatus.valid ? "status" : "alert"}>
              {uploadStatus.message}
            </p>
          ) : null}
        </div>
        <BlueprintViewer model={sampleModel} />
      </section>
    </main>
  );
}
