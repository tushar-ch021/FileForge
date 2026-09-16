/**
 * Tracks and revokes browser Blob/File object URLs to prevent client-side memory leaks.
 */
export class ObjectUrlManager {
  private urls: Set<string> = new Set();

  /**
   * Generates an object URL from a Blob or File and tracks it for future cleanup.
   */
  public create(source: Blob | File): string {
    if (typeof window === "undefined" || !window.URL) {
      return "";
    }
    const url = window.URL.createObjectURL(source);
    this.urls.add(url);
    return url;
  }

  /**
   * Revokes a specific tracked URL and frees its memory.
   */
  public revoke(url: string | undefined): void {
    if (!url || typeof window === "undefined" || !window.URL) return;
    if (this.urls.has(url)) {
      try {
        window.URL.revokeObjectURL(url);
      } catch (e) {
        console.warn("Failed to revoke object URL:", e);
      }
      this.urls.delete(url);
    }
  }

  /**
   * Revokes all currently tracked object URLs.
   */
  public revokeAll(): void {
    if (typeof window === "undefined" || !window.URL) return;
    for (const url of this.urls) {
      try {
        window.URL.revokeObjectURL(url);
      } catch (e) {
        console.warn("Failed to revoke object URL:", e);
      }
    }
    this.urls.clear();
  }
}

/**
 * Creates a one-off object URL and schedules its revocation.
 */
export function createTemporaryObjectUrl(source: Blob | File, delayMs = 60000): string {
  if (typeof window === "undefined" || !window.URL) return "";
  const url = window.URL.createObjectURL(source);

  setTimeout(() => {
    try {
      window.URL.revokeObjectURL(url);
    } catch {
      // Ignore if already revoked
    }
  }, delayMs);

  return url;
}
