import React from 'react'
import ReactDOM from 'react-dom/client'
import PipelineApp from './PipelineApp'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PipelineApp />
    </ErrorBoundary>
  </React.StrictMode>,
)