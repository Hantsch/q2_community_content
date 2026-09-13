import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles/index.css'
import { App } from './App'

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
