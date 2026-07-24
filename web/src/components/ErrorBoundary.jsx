import { Component } from 'react'

// Catches unexpected render/runtime errors in a page (not fetch failures —
// those already surface through ErrorBanner) so a bug shows a styled
// fallback instead of a blank white screen. App.jsx keys this per-route so
// navigating away from a crashed page resets it.
export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-container_padding text-center">
          <span className="material-symbols-outlined text-[40px] text-secondary">error</span>
          <h2 className="font-headline-sm text-headline-sm font-bold text-primary">Something went wrong</h2>
          <p className="max-w-md font-body-md text-secondary">
            This page hit an unexpected error. Try reloading, or use the sidebar to go to a different page.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="bg-primary px-4 py-2 font-label-sm text-label-sm text-on-primary transition-opacity hover:bg-primary/90"
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
