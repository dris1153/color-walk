import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { fallback: ReactNode; children: ReactNode };
type State = { failed: boolean };

/**
 * The deep-zoom viewer is a lazy chunk, and a chunk can fail: a deploy mid
 * session, a flaky network. Without this the whole app unmounts to a blank
 * screen, so the overlay falls back to poster plus metadata instead.
 */
export class DeepZoomErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('deep zoom viewer failed', error, info.componentStack);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
