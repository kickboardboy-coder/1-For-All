import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <section className="error-boundary" role="alert">
        <p className="error-boundary-code">오류</p>
        <h1>화면을 표시하지 못했습니다</h1>
        <p>예상하지 못한 문제가 났어요. 다시 시도하거나 여행 플랜으로 돌아가 주세요.</p>
        <div className="error-boundary-actions">
          <button type="button" onClick={() => window.location.reload()}>
            다시 시도
          </button>
          <a href="/plans">여행 플랜으로 돌아가기</a>
        </div>
      </section>
    );
  }
}

export default ErrorBoundary;
