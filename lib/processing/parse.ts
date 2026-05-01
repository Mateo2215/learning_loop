import mammoth from "mammoth";
import type { SourceType } from "@/lib/db/types";

export interface ParseResult {
  text: string;
  sourceType: SourceType;
  filename: string | null;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — enough for ~50 pages of text

/**
 * Extract plain text from an uploaded file. Throws on unsupported types or oversized files.
 * Output is the raw extracted text — compression and processing happen later in the pipeline.
 */
export async function parseFile(file: File): Promise<ParseResult> {
  if (file.size > MAX_BYTES) {
    throw new Error(`Plik za duży (${Math.round(file.size / 1024)} KB). Maksymalnie 5 MB.`);
  }

  const filename = file.name;
  const ext = filename.split(".").pop()?.toLowerCase();

  if (ext === "docx") {
    const buf = Buffer.from(await file.arrayBuffer());
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return { text: value.trim(), sourceType: "docx", filename };
  }

  if (ext === "md" || ext === "markdown" || ext === "txt") {
    const text = await file.text();
    return { text: text.trim(), sourceType: ext === "txt" ? "txt" : "md", filename };
  }

  throw new Error(`Nieobsługiwany typ pliku: .${ext ?? "?"}. Akceptujemy DOCX, MD, TXT.`);
}

/**
 * Validate pasted text. No file involved.
 */
export function parsePastedText(text: string): ParseResult {
  const trimmed = text.trim();
  if (trimmed.length < 100) {
    throw new Error("Treść za krótka. Wklej co najmniej 100 znaków.");
  }
  if (trimmed.length > 200_000) {
    throw new Error(`Treść za długa (${trimmed.length} znaków). Maksimum 200 000.`);
  }
  return { text: trimmed, sourceType: "paste", filename: null };
}
