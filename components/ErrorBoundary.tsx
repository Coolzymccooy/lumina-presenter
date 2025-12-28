
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    // Access state property from inherited React.Component class
    if (this.state.hasError) {
      // Access props correctly from inherited React.Component class
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center border-2 border-red-900/50 m-2 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-gray-400 text-sm mb-4 max-w-md break-words">
            {/* Access state property correctly from inherited React.Component class */}
            {this.state.error?.message || "An unexpected error occurred while rendering this component."}
          </p>
          <button 
            // Access setState method inherited from React.Component class
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors border border-gray-700"
          >
            Try Again
          </button>
        </div>
      );
    }

    // Access children property from inherited React.Component class
    return this.props.children;
  }
}
