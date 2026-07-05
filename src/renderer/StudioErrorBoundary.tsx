import { Component, type ErrorInfo, type ReactNode } from 'react'

type StudioErrorBoundaryProps = {
  children: ReactNode
  fallback: ReactNode
}

type StudioErrorBoundaryState = {
  hasError: boolean
}

export class StudioErrorBoundary extends Component<StudioErrorBoundaryProps, StudioErrorBoundaryState> {
  state: StudioErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): StudioErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('GCPShot Studio error:', error, info)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback
    }

    return this.props.children
  }
}
