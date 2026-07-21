import pako from 'pako'

/**
 * Kroki expects the diagram source raw-deflated then base64url-encoded
 * (no padding). See https://docs.kroki.io/kroki/setup/encode-diagram/
 */
export function encodeKrokiDiagram(source: string): string {
  const bytes = new TextEncoder().encode(source)
  const compressed = pako.deflate(bytes, { level: 9 })
  let binary = ''
  for (let i = 0; i < compressed.length; i++) binary += String.fromCharCode(compressed[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function krokiUrl(diagramType: string, outputFormat: string, source: string): string {
  return `https://kroki.io/${diagramType}/${outputFormat}/${encodeKrokiDiagram(source)}`
}
