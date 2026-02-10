"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: "400px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              backgroundColor: "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
              fontSize: "28px",
            }}
          >
            ⚠️
          </div>
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: 600,
              color: "#0f172a",
              marginBottom: "0.5rem",
            }}
          >
            Application Error
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#64748b",
              marginBottom: "1.5rem",
              lineHeight: 1.5,
            }}
          >
            A critical error occurred. Please try refreshing the page.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "#94a3b8",
                marginBottom: "1rem",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              backgroundColor: "#6366f1",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
