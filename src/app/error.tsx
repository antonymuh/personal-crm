"use client";

import { ErrorMessage } from "@/components/error-message";

export default function ErrorPage({
  retry,
}: {
  error: unknown;
  reset: () => void;
  retry: () => void;
}) {
  return <ErrorMessage retry={retry} />;
}
