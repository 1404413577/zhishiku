import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { VueRenderer } from '@tiptap/vue-3'
import tippy from 'tippy.js'
import CommandsList from '@/components/Editor/CommandsList.vue'
import {
  EditPen,
  List,
  CircleCheck,
  Memo,
  ChatDotRound,
  Picture,
  More,
  Postcard,
  MagicStick,
  Brush
} from '@element-plus/icons-vue'

export const Commands = Extension.create({
  name: 'slash-commands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          props.command({ editor, range })
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})

export const suggestionConfig = {
  items: ({ query }) => {
    return [
      {
        title: '一级标题',
        description: '大号标题',
        icon: EditPen,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode('heading', { level: 1 })
            .run()
        },
      },
      {
        title: '二级标题',
        description: '中号标题',
        icon: EditPen,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode('heading', { level: 2 })
            .run()
        },
      },
      {
        title: '三级标题',
        description: '小号标题',
        icon: EditPen,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode('heading', { level: 3 })
            .run()
        },
      },
      {
        title: '无序列表',
        description: '简单列表',
        icon: List,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run()
        },
      },
      {
        title: '有序列表',
        description: '编号列表',
        icon: List,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run()
        },
      },
      {
        title: '待办事项',
        description: '任务复选框',
        icon: CircleCheck,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleTaskList().run()
        },
      },
      {
        title: '代码块',
        description: '语法高亮',
        icon: Memo,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
        },
      },
      {
        title: 'AI 总结',
        description: '根据内容生成摘要',
        icon: ChatDotRound,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run()
          window.dispatchEvent(new CustomEvent('editor-ai-action', { detail: { type: 'summary' } }))
        },
      },
      {
        title: 'AI 润色',
        description: '自动优化选中文本',
        icon: MagicStick || ChatDotRound,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run()
          window.dispatchEvent(new CustomEvent('editor-ai-action', { detail: { type: 'polish' } }))
        },
      },
      {
        title: 'Mermaid 图表',
        description: '流程图、甘特图等',
        icon: Postcard,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent('```mermaid\ngraph TD\nA[Start] --> B(Process)\nB --> C{Decision}\nC -->|Yes| D[End]\nC -->|No| E[Back]\n```')
            .run()
        },
      },
      {
        title: '数学公式',
        description: '轻量公式块',
        icon: More,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent('$$\nx = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n$$')
            .run()
        },
      },
      {
        title: '绘图 (Excalidraw)',
        description: '嵌入手绘白板',
        icon: Brush,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).insertExcalidraw().run()
        },
      }
    ].filter(item => item.title.toLowerCase().startsWith(query.toLowerCase()))
  },

  render: () => {
    let component
    let popup

    return {
      onStart: props => {
        component = new VueRenderer(CommandsList, {
          props,
          editor: props.editor,
        })

        if (!props.clientRect) {
          return
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })
      },

      onUpdate(props) {
        component.updateProps(props)

        if (!props.clientRect) {
          return
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        })
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup[0].hide()
          return true
        }

        return component.ref?.onKeyDown(props)
      },

      onExit() {
        popup[0].destroy()
        component.destroy()
      },
    }
  },
}
export default {
  Commands,
  suggestionConfig,
}
