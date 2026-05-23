'use client';

import { Component } from 'react';

export default class GameErrorBoundary extends Component<{ children: React.ReactNode }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('🔥 GameErrorBoundary caught:', error.message.slice(0, 120));
  }

  render() {
    if (this.state.hasError) {
      this.state = { hasError: false };
      return <div suppressHydrationWarning>{this.props.children}</div>;
    }
    return <div suppressHydrationWarning>{this.props.children}</div>;
  }
}
