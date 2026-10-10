import { Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { STORAGE_KEY, StoreProvider } from './store'
import './index.css'

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="mx-auto max-w-lg p-8">
          <h1 className="font-display text-4xl">The preview hit a problem.</h1>
          <button
            className="mt-4 rounded-full bg-teal-800 px-4 py-2 text-white"
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY)
              location.href = '/'
            }}
          >
            Reset preview data
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <Boundary>
    <BrowserRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </Boundary>,
)
