"use client";

import { Component, type ReactNode } from "react";

import { ErrorState } from "@/components/error-state";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = { hasError: boolean };

// Reusable React error boundary. Catches render errors in its subtree and shows a
// recoverable ErrorState (or a custom fallback) instead of a broken page.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <ErrorState onRetry={this.reset} />;
    }
    return this.props.children;
  }
}
