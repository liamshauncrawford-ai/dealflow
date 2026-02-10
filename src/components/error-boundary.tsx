"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive/60" />
          <p className="mt-2 text-sm font-medium text-destructive">Something went wrong</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
