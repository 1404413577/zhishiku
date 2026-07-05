import { AIService } from './ai'
import {
  AI_WRITE_SYSTEM_PROMPT,
  EDITOR_POLISH_INSTRUCTION,
  SUMMARY_SYSTEM_PROMPT,
  TEXT_EDIT_SYSTEM_PROMPT,
} from './ai/prompts'

export const aiUseCases = {
  async generateSummary(content, onChunk = null, options = {}) {
    return AIService.chatCompletion(
      [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: String(content || '').substring(0, 10000) },
      ],
      onChunk,
      null,
      options,
    )
  },

  async polishText(text, instruction = EDITOR_POLISH_INSTRUCTION, onChunk = null, options = {}) {
    return AIService.chatCompletion(
      [
        { role: 'system', content: TEXT_EDIT_SYSTEM_PROMPT(instruction) },
        { role: 'user', content: text },
      ],
      onChunk,
      null,
      options,
    )
  },

  async polishEditorSelection(text, onChunk = null, options = {}) {
    return this.polishText(text, EDITOR_POLISH_INSTRUCTION, onChunk, options)
  },

  async writeDocumentFromTitle(title, onChunk = null, options = {}) {
    return AIService.chatCompletion(
      [
        { role: 'system', content: AI_WRITE_SYSTEM_PROMPT },
        { role: 'user', content: `标题：${title}` },
      ],
      onChunk,
      null,
      options,
    )
  },
}
