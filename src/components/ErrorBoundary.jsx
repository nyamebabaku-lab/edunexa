// Keeps one broken page from taking down the whole app: shows a friendly message, and the menu keeps working.
import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default class PageBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('Page error:', error, info?.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <p className="mt-3 text-lg font-bold text-slate-900 dark:text-white">This page could not open</p>
        <p className="mt-1 text-sm text-slate-500">Something on it is missing or incomplete. Your data is safe — pick another page from the menu, or try again.</p>
        <p className="mt-3 break-words rounded-xl bg-slate-50 p-2 font-mono text-[11px] text-slate-400 dark:bg-white/5">{String(this.state.error?.message || this.state.error).slice(0, 200)}</p>
        <button onClick={() => this.setState({ error: null })} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }
}
