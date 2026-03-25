import React from 'react'
import ReactDOM from 'react-dom/client'
import DashboardApp from './DashboardApp'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <DashboardApp />
    </ErrorBoundary>
  </React.StrictMode>,
)