import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";
import { Card } from "./Card";

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route render failed", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Card className="ui-error-card">
        <h1>Something went sideways</h1>
        <p className="subtitle">{this.state.error.message || "This screen failed to render."}</p>
        <Button type="button" variant="primary" onClick={() => this.setState({ error: null })}>
          Try again
        </Button>
      </Card>
    );
  }
}
