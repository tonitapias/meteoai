import React from 'react';
import ErrorBanner from './ErrorBanner';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
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