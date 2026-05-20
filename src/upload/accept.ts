export type BlueprintFileValidation =
  | { ok: true; kind: "image" | "pdf" }
  | { ok: false; reason: "Upload a PNG, JPG, or PDF blueprint." };

const uploadError = "Upload a PNG, JPG, or PDF blueprint.";
const maxFileBytes = 20 * 1024 * 1024;
const maxSignatureBytes = 12;

const signatures = [
  {
    kind: "image",
    mime: "image/png",
    matches: (header: Uint8Array) =>
      matchesBytes(header, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    kind: "image",
    mime: "image/jpeg",
    matches: (header: Uint8Array) =>
      matchesBytes(header, 0, [0xff, 0xd8, 0xff]),
  },
  {
    kind: "image",
    mime: "image/webp",
    matches: (header: Uint8Array) =>
      matchesBytes(header, 0, [0x52, 0x49, 0x46, 0x46]) &&
      matchesBytes(header, 8, [0x57, 0x45, 0x42, 0x50]),
  },
  {
    kind: "pdf",
    mime: "application/pdf",
    matches: (header: Uint8Array) =>
      matchesBytes(header, 0, [0x25, 0x50, 0x44, 0x46, 0x2d]),
  },
] as const;

const genericMimeTypes = new Set(["", "application/octet-stream"]);

const canonicalMimeType = (mimeType: string): string => {
  if (["image/jpg", "image/pjpeg", "image/x-jpeg"].includes(mimeType)) {
    return "image/jpeg";
  }

  return mimeType;
};

const matchesBytes = (
  header: Uint8Array,
  offset: number,
  signature: readonly number[],
): boolean => {
  if (header.length < offset + signature.length) {
    return false;
  }

  return signature.every((byte, index) => header[offset + index] === byte);
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
  const match = signatures.find(({ matches }) => matches(header));

  if (!match) {
    return { ok: false, reason: uploadError };
  }

  if (
    !genericMimeTypes.has(file.type) &&
    mimeKind(canonicalMimeType(file.type)) !== match.kind
  ) {
    return { ok: false, reason: uploadError };
  }

  return { ok: true, kind: match.kind };
};

const mimeKind = (mimeType: string): "image" | "pdf" | "unknown" => {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType === "application/pdf") {
    return "pdf";
  }

  return "unknown";
};
