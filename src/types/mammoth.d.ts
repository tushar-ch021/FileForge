declare module "mammoth" {
  export interface ConversionResult {
    value: string; // The HTML or raw text
    messages: Array<{
      type: "warning" | "error";
      message: string;
    }>;
  }

  export interface ImageOptions {
    contentType: string;
    read: (encoding?: string) => Promise<Buffer | ArrayBuffer | string>;
  }

  export interface ConvertOptions {
    arrayBuffer?: ArrayBuffer;
    buffer?: Buffer;
    path?: string;
    styleMap?: string | string[];
    includeDefaultStyleMap?: boolean;
    convertImage?: (image: ImageOptions) => Promise<{ src: string }>;
  }

  export function convertToHtml(input: { arrayBuffer: ArrayBuffer } | { buffer: Buffer } | { path: string }, options?: ConvertOptions): Promise<ConversionResult>;
  export function extractRawText(input: { arrayBuffer: ArrayBuffer } | { buffer: Buffer } | { path: string }, options?: ConvertOptions): Promise<ConversionResult>;
}
