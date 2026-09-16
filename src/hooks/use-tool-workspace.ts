"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ProcessingStatus,
  FileValidationOptions,
  ToolExecutionResult,
} from "@/types/workspace";
import { validateFiles } from "@/lib/workspace/file-validator";
import { ObjectUrlManager } from "@/lib/workspace/url";
import { downloadBlob, downloadBuffer, downloadText } from "@/lib/workspace/download";
import { getErrorMessage } from "@/lib/workspace/errors";

interface UseToolWorkspaceOptions {
  validationOptions?: FileValidationOptions;
  defaultOutputFilename?: string;
}

export function useToolWorkspace<T = unknown>(options: UseToolWorkspaceOptions = {}) {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ToolExecutionResult<T> | null>(null);

  const urlManagerRef = useRef<ObjectUrlManager | null>(null);

  // Lazy getter ensures ref is accessed only during effects or event handlers
  const getUrlManager = useCallback((): ObjectUrlManager => {
    if (!urlManagerRef.current) {
      urlManagerRef.current = new ObjectUrlManager();
    }
    return urlManagerRef.current;
  }, []);

  // Automated memory cleanup on unmount
  useEffect(() => {
    const manager = urlManagerRef.current;
    return () => {
      manager?.revokeAll();
    };
  }, []);

  const handleSelectFiles = useCallback(
    (selectedFiles: File[]) => {
      setError(null);
      setResult(null);
      setStatus("validating");

      const validation = validateFiles(selectedFiles, options.validationOptions);
      if (!validation.isValid) {
        setError(validation.error || "File validation failed.");
        setStatus("error");
        return;
      }

      setFiles(selectedFiles);
      setStatus("idle");
    },
    [options.validationOptions]
  );

  const execute = useCallback(
    async (
      processorFn: (
        inputFiles: File[],
        updateProgress: (percent: number) => void
      ) => Promise<ToolExecutionResult<T>>
    ) => {
      if (files.length === 0) {
        setError("Please select at least one file before processing.");
        setStatus("error");
        return;
      }

      setError(null);
      setStatus("processing");
      setProgress(0);
      const startTime = performance.now();

      try {
        const output = await processorFn(files, setProgress);
        const endTime = performance.now();

        const finalResult: ToolExecutionResult<T> = {
          ...output,
          executionTimeMs: endTime - startTime,
          filename: output.filename || options.defaultOutputFilename || "result",
        };

        setResult(finalResult);
        setStatus("success");
        setProgress(100);
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        setStatus("error");
      }
    },
    [files, options.defaultOutputFilename]
  );

  const reset = useCallback(() => {
    urlManagerRef.current?.revokeAll();
    setStatus("idle");
    setFiles([]);
    setProgress(0);
    setError(null);
    setResult(null);
  }, []);

  const downloadResult = useCallback(() => {
    if (!result) return;

    const filename = result.filename || options.defaultOutputFilename || "output";

    if (result.data instanceof Blob) {
      downloadBlob(result.data, filename);
    } else if (
      result.data instanceof Uint8Array ||
      result.data instanceof ArrayBuffer
    ) {
      downloadBuffer(result.data, filename, result.mimeType);
    } else if (typeof result.data === "string") {
      downloadText(result.data, filename, result.mimeType);
    }
  }, [result, options.defaultOutputFilename]);

  return {
    status,
    files,
    progress,
    error,
    result,
    isProcessing: status === "processing" || status === "reading",
    isSuccess: status === "success",
    isError: status === "error",
    setFiles: handleSelectFiles,
    setProgress,
    setError,
    execute,
    reset,
    downloadResult,
    createObjectUrl: (source: Blob | File) => getUrlManager().create(source),
  };
}
