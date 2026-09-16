"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Download,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Unlock,
  Lock,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FileDropzone,
  ProcessingIndicator,
  ErrorAlert,
} from "@/components/tools/workspace";
import {
  inspectPdfProtection,
  unlockPdf,
  PdfUnlockInspection,
  PdfUnlockResult,
} from "@/lib/pdf/pdf-unlock";
import { formatBytes } from "@/lib/workspace/file-validator";
import { downloadBlob } from "@/lib/workspace/download";
import { getErrorMessage } from "@/lib/workspace/errors";
import { ObjectUrlManager } from "@/lib/workspace/url";
import { FileValidationOptions, ProcessingStatus } from "@/types/workspace";

const DROPZONE_VALIDATION: FileValidationOptions = {
  maxSizeBytes: 50 * 1024 * 1024,
  minSizeBytes: 1,
  acceptedExtensions: [".pdf"],
  acceptedMimeTypes: ["application/pdf"],
  maxFiles: 1,
};

export function PdfUnlockTool() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<PdfUnlockInspection | null>(null);
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>("Reading PDF...");

  // Results State
  const [result, setResult] = useState<PdfUnlockResult | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Clean memory management
  const [urlManager] = useState(() => new ObjectUrlManager());

  useEffect(() => {
    return () => {
      urlManager.revokeAll();
      // Security: purge password from memory on unmount
      setPassword("");
    };
  }, [urlManager]);

  const handleFilesSelected = async (files: File[]) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    setGeneralError(null);
    setResult(null);
    setPassword("");
    setStatus("validating");

    try {
      const inspectRes = await inspectPdfProtection(file);
      setSelectedFile(file);
      setInspection(inspectRes);
      setStatus("idle");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setSelectedFile(null);
      setInspection(null);
      setStatus("error");
    }
  };

  const handleUnlock = async () => {
    if (!selectedFile) return;

    if (inspection?.isEncrypted && !password.trim()) {
      setGeneralError("Please enter the document password to unlock this PDF.");
      return;
    }

    setStatus("processing");
    setGeneralError(null);
    setProcessingStage("Checking protection...");

    try {
      setProcessingStage("Opening PDF...");
      // Micro-task yield for truthful UI feedback
      await new Promise((r) => setTimeout(r, 60));

      setProcessingStage("Creating unlocked copy...");
      const res = await unlockPdf(selectedFile, password);

      setProcessingStage("Validating PDF...");
      await new Promise((r) => setTimeout(r, 60));

      setResult(res);
      setStatus("success");
      // Purge password string from state immediately upon successful unlock
      setPassword("");
    } catch (err) {
      setGeneralError(getErrorMessage(err));
      setStatus("error");
    }
  };

  const handleDownload = () => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
  };

  const handleReset = () => {
    urlManager.revokeAll();
    setSelectedFile(null);
    setInspection(null);
    setPassword("");
    setShowPassword(false);
    setResult(null);
    setGeneralError(null);
    setStatus("idle");
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* 1. Initial Upload Dropzone */}
      {!selectedFile && status !== "processing" && (
        <div className="space-y-4">
          <FileDropzone
            onFilesSelected={handleFilesSelected}
            validationOptions={DROPZONE_VALIDATION}
            title="Drag and drop your PDF to remove password"
            subtitle="Secure, 100% in-browser PDF unlocking — your document never leaves your device."
          />

          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground space-y-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Zero-Knowledge Decryption & Privacy</span>
            </div>
            <p>
              Your password and document are decrypted locally using your browser&apos;s Web Crypto engine.
              Passwords are never transmitted across the network, stored, or logged.
            </p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {generalError && (
        <ErrorAlert
          message={generalError}
          onDismiss={() => setGeneralError(null)}
        />
      )}

      {/* 2. File Selected & Password Configuration */}
      {selectedFile && status !== "success" && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
          {/* File Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate max-w-sm sm:max-w-md">
                  {selectedFile.name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{formatBytes(selectedFile.size)}</span>
                  <span>•</span>
                  <span>{inspection?.pdfVersion || "PDF"}</span>
                  {inspection?.pageCount ? (
                    <>
                      <span>•</span>
                      <span>{inspection.pageCount} pages</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Choose Different File
            </Button>
          </div>

          {/* Encryption Status Banner */}
          {inspection?.isEncrypted ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-amber-500">
                    Password-Protected PDF Detected
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    This document is encrypted
                    {inspection.algorithm ? ` using ${inspection.algorithm}` : ""}.
                    Please enter the authorized document password to decrypt and save an unrestricted copy.
                  </p>
                </div>
              </div>

              {/* Password Input */}
              <div className="pt-2 space-y-2">
                <label
                  htmlFor="pdf-password-input"
                  className="block text-xs font-medium text-foreground"
                >
                  Document Password
                </label>
                <div className="relative">
                  <input
                    id="pdf-password-input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && password.trim()) {
                        handleUnlock();
                      }
                    }}
                    placeholder="Enter PDF password..."
                    className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    autoComplete="off"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  Unrestricted Document
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This PDF does not require an opening password. You can export a clean, normalized copy with any restrictions cleared.
                </p>
              </div>
            </div>
          )}

          {/* Digital Signature Notice */}
          <div className="rounded-lg border border-border/40 bg-muted/30 p-3 flex items-start gap-2.5 text-xs text-muted-foreground">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p>
              <strong>Important Notice:</strong> Unlocking creates a fresh unencrypted PDF copy.
              If the original PDF contains cryptographic digital signatures, modifying or re-saving the file may invalidate them.
            </p>
          </div>

          {/* Processing Indicator */}
          {status === "processing" && (
            <div className="py-4">
              <ProcessingIndicator statusText={processingStage} />
            </div>
          )}

          {/* Action Button */}
          {status !== "processing" && (
            <Button
              onClick={handleUnlock}
              className="w-full sm:w-auto h-11 px-8 font-medium gap-2"
            >
              <Unlock className="w-4 h-4" />
              {inspection?.isEncrypted ? "Unlock & Save PDF" : "Save Unrestricted PDF"}
            </Button>
          )}
        </div>
      )}

      {/* 3. Success Result View */}
      {status === "success" && result && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border/60">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-foreground">
                PDF Successfully Unlocked!
              </h3>
              <p className="text-xs text-muted-foreground">
                Encryption has been completely removed. The document opens without requiring a password.
              </p>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                Unprotected
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
              <div className="text-xs text-muted-foreground">Total Pages</div>
              <div className="text-sm font-semibold text-foreground mt-0.5">
                {result.pageCount}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
              <div className="text-xs text-muted-foreground">File Size</div>
              <div className="text-sm font-semibold text-foreground mt-0.5">
                {formatBytes(result.outputSizeBytes)}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
              <div className="text-xs text-muted-foreground">Time</div>
              <div className="text-sm font-semibold text-foreground mt-0.5">
                {result.executionTimeMs} ms
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Button
              onClick={handleDownload}
              className="w-full sm:w-auto h-11 px-8 font-medium gap-2"
            >
              <Download className="w-4 h-4" />
              Download Unlocked PDF
            </Button>

            <Button
              variant="outline"
              onClick={handleReset}
              className="w-full sm:w-auto h-11 px-6 font-medium gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Unlock Another PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
