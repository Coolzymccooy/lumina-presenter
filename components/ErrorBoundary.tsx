
import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary class component to catch rendering errors in its child tree.
 */
// Fix: Extend from React.Component directly to ensure proper property inheritance of props, state, and setState in TypeScript
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    // Initialize state in constructor to ensure proper type resolution
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  private isFirestoreInternalError(error: Error): boolean {
    return error.message.includes('FIRESTORE') && error.message.includes('INTERNAL ASSERTION FAILED');
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // Firestore internal assertion errors leave the SDK in an unrecoverable state.
    // Auto-reload is the only clean recovery path.
    if (this.isFirestoreInternalError(error)) {
      setTimeout(() => window.location.reload(), 2000);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isFirestoreError = this.state.error ? this.isFirestoreInternalError(this.state.error) : false;

      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center border-2 border-red-900/50 m-2 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {isFirestoreError ? (
            <>
              <h2 className="text-xl font-bold mb-2">Connection lost — restarting…</h2>
              <p className="text-gray-400 text-sm mb-4 max-w-md">
                The sync connection dropped unexpectedly. The app will reload automatically.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
              <p className="text-gray-400 text-sm mb-4 max-w-md break-words">
                {this.state.error?.message || "An unexpected error occurred while rendering this component."}
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors border border-gray-700"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      );
    }

    // Access children property from inherited React.Component class
    return this.props.children;
  }
}
