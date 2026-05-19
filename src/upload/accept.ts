export type BlueprintFileValidation =
  | { ok: true; kind: "image" | "pdf" }
  | { ok: false; reason: "Upload a PNG, JPG, or PDF blueprint." };

const uploadError = "Upload a PNG, JPG, or PDF blueprint.";
const maxFileBytes = 20 * 1024 * 1024;
const maxSignatureBytes = 8;

const signatures = [
  {
    kind: "image",
    mime: "image/png",
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    kind: "image",
    mime: "image/jpeg",
    bytes: [0xff, 0xd8, 0xff],
  },
  {
    kind: "pdf",
    mime: "application/pdf",
    bytes: [0x25, 0x50, 0x44, 0x46, 0x2d],
  },
] as const;

const matchesSignature = (
  header: Uint8Array,
  signature: readonly number[],
): boolean => {
  if (header.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => header[index] === byte);
};

const readHeader = async (file: File): Promise<Uint8Array> => {
  const headerBlob = file.slice(0, maxSignatureBytes);

  if (typeof headerBlob.arrayBuffer === "function") {
    return new Uint8Array(await headerBlob.arrayBuffer());
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error("Could not read blueprint file header."));
        return;
      }

      resolve(new Uint8Array(reader.result));
    };
    reader.onerror = () =>
      reject(new Error("Could not read blueprint file header."));
    reader.readAsArrayBuffer(headerBlob);
  });
};

export const validateBlueprintFile = async (
  file: File,
): Promise<BlueprintFileValidation> => {
  if (file.size > maxFileBytes) {
    return { ok: false, reason: uploadError };
  }

  const header = await readHeader(file);
  const match = signatures.find(({ bytes }) => matchesSignature(header, bytes));

  if (!match) {
    return { ok: false, reason: uploadError };
  }

  if (file.type !== "" && file.type !== match.mime) {
    return { ok: false, reason: uploadError };
  }

  return { ok: true, kind: match.kind };
};
