/**
 * Downloads a Blob directly from browser memory without any server upload.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);

  link.click();

  // Clean up the anchor element and revoke object URL
  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Downloads an ArrayBuffer or Uint8Array as a local file.
 */
export function downloadBuffer(
  buffer: ArrayBuffer | Uint8Array,
  filename: string,
  mimeType = "application/octet-stream"
): void {
  const blob = new Blob([buffer as BlobPart], { type: mimeType });
  downloadBlob(blob, filename);
}

/**
 * Downloads a plain text or JSON string as a file.
 */
export function downloadText(
  text: string,
  filename: string,
  mimeType = "text/plain;charset=utf-8"
): void {
  const blob = new Blob([text], { type: mimeType });
  downloadBlob(blob, filename);
}
