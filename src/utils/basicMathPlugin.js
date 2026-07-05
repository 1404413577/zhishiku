const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const replacements = [
  [/\\times/g, '×'],
  [/\\cdot/g, '·'],
  [/\\div/g, '÷'],
  [/\\pm/g, '±'],
  [/\\leq/g, '≤'],
  [/\\geq/g, '≥'],
  [/\\neq/g, '≠'],
  [/\\approx/g, '≈'],
  [/\\infty/g, '∞'],
  [/\\sum/g, 'Σ'],
  [/\\prod/g, 'Π'],
  [/\\sqrt\{([^{}]+)\}/g, '√($1)'],
  [/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)'],
  [/\\alpha/g, 'α'],
  [/\\beta/g, 'β'],
  [/\\gamma/g, 'γ'],
  [/\\delta/g, 'δ'],
  [/\\theta/g, 'θ'],
  [/\\lambda/g, 'λ'],
  [/\\mu/g, 'μ'],
  [/\\pi/g, 'π'],
  [/\\sigma/g, 'σ'],
  [/\\phi/g, 'φ'],
  [/\\omega/g, 'ω'],
]

const formatMathText = (source) => {
  let text = String(source || '').trim()
  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement)
  })
  return escapeHtml(text)
}

const renderInlineMath = (source) =>
  `<span class="math-inline" aria-label="math">${formatMathText(source)}</span>`

const renderBlockMath = (source) =>
  `<div class="math-block" aria-label="math">${formatMathText(source)}</div>`

export function basicMathPlugin(md) {
  md.inline.ruler.before('escape', 'basic_inline_math', (state, silent) => {
    const start = state.pos
    if (state.src.charCodeAt(start) !== 0x24) return false
    if (state.src.charCodeAt(start + 1) === 0x24) return false

    const end = state.src.indexOf('$', start + 1)
    if (end === -1) return false

    const content = state.src.slice(start + 1, end)
    if (!content.trim()) return false

    if (!silent) {
      const token = state.push('html_inline', '', 0)
      token.content = renderInlineMath(content)
    }
    state.pos = end + 1
    return true
  })

  md.block.ruler.before('fence', 'basic_block_math', (state, startLine, endLine, silent) => {
    const startPos = state.bMarks[startLine] + state.tShift[startLine]
    const maxPos = state.eMarks[startLine]
    const marker = state.src.slice(startPos, maxPos).trim()
    if (marker !== '$$') return false

    let nextLine = startLine + 1
    const content = []
    while (nextLine < endLine) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine]
      const lineEnd = state.eMarks[nextLine]
      const line = state.src.slice(lineStart, lineEnd)
      if (line.trim() === '$$') break
      content.push(line)
      nextLine++
    }

    if (nextLine >= endLine) return false
    if (silent) return true

    const token = state.push('html_block', '', 0)
    token.content = renderBlockMath(content.join('\n'))
    state.line = nextLine + 1
    return true
  })
}
