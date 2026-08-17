import { useState, useCallback } from "react";

type SubmissionStatus = "idle" | "submitting" | "success" | "error";

/**
 * Wraps a submit function (e.g. submitImportRequest) with real status
 * tracking. Never reports "success" unless the underlying call resolved.
 */
export function useFormSubmission<T>(submitFn: (payload: T) => Promise<void>) {
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = useCallback(
    async (payload: T) => {
      setStatus("submitting");
      setErrorMessage(null);
      try {
        await submitFn(payload);
        setStatus("success");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Submission failed. Please try again.";
        setErrorMessage(message);
        setStatus("error");
      }
    },
    [submitFn]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  return { status, errorMessage, submit, reset };
}
