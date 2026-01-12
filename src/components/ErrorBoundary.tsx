// src/components/ErrorBoundary.tsx
import React, { ReactNode } from 'react';
import ErrorBanner from './ErrorBanner';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error capturat al component:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="py-4">
           <ErrorBanner message="Aquesta secció ha tingut un problema tècnic." />
           <button 
             onClick={() => this.setState({ hasError: false })}
             className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 underline"
           >
             Reintentar
           </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;