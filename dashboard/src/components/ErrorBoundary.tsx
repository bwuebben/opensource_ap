import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold text-[#ef4444] mb-2">Something went wrong</h2>
          <pre className="text-sm text-[#94a3b8] bg-[#1e293b] p-4 rounded-lg overflow-auto max-w-2xl mx-auto">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-4 px-4 py-2 bg-[#3b82f6] text-white rounded-md hover:bg-[#2563eb] text-sm"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
