import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, retryKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('CoinGram UI crashed:', error, info);
  }

  retry = () => {
    this.setState(state => ({ error: null, retryKey: state.retryKey + 1 }));
  };

  render() {
    if (!this.state.error) {
      return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
    }

    return (
      <main className="app-error-boundary" role="alert">
        <section className="app-error-card">
          <div className="app-error-icon" aria-hidden="true">!</div>
          <h1>Интерфейс временно недоступен</h1>
          <p>Произошла ошибка при открытии чата. Сообщения и файлы не удалены.</p>
          <div className="app-error-actions">
            <button type="button" onClick={this.retry}>Повторить</button>
            <button type="button" className="secondary" onClick={() => window.location.reload()}>
              Перезагрузить страницу
            </button>
          </div>
        </section>
      </main>
    );
  }
}