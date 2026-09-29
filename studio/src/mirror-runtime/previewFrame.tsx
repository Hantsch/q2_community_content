import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { PreviewFrameApp } from './PreviewFrameApp'
// Side-effect only: the mirrored stylesheet graph and fonts, never the studio's own CSS.
import './mirrorStyles'

const container = document.getElementById('preview-frame-root')
if (!container) throw new Error('#preview-frame-root is missing from preview-frame.html')

createRoot(container).render(
  <StrictMode>
    <PreviewFrameApp />
  </StrictMode>,
)
