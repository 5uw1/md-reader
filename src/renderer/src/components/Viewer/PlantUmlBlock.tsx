import React, { useMemo, useState } from 'react'
import { krokiUrl } from '../../lib/krokiEncode'

export default function PlantUmlBlock({ source }: { source: string }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const url = useMemo(() => krokiUrl('plantuml', 'svg', source), [source])

  if (failed) {
    return (
      <div className="diagram-block diagram-block--error">
        <p>Could not render PlantUML diagram (check your internet connection to kroki.io).</p>
        <pre>{source}</pre>
      </div>
    )
  }

  return (
    <div className="diagram-block diagram-block--plantuml">
      <img src={url} alt="PlantUML diagram" onError={() => setFailed(true)} />
    </div>
  )
}
