<template>
  <div
    class="editor-page"
    :class="{
      'preview-only': editorMode === 'preview',
      'split-view': editorMode === 'split',
      'focus-mode': isFocusMode,
    }"
  >
    <div
      v-show="editorMode === 'preview'"
      class="reading-progress-bar"
      :style="{ width: readingProgress + '%' }"
    ></div>

    <!-- 抽离出的顶部工具栏 -->
    <EditorToolbar
      v-model:title="documentTitle"
      :saving="saving"
      :aiWritingLoading="aiWritingLoading"
      :editorMode="editorMode"
      :isFocusMode="isFocusMode"
      :canGoBack="canGoBack"
      @save="saveDocument"
      @aiWrite="handleAIWrite"
      @stopAIWrite="stopAIWrite"
      @goBack="goBack"
      @export="handleEditorExport"
      @cycleMode="cycleEditorMode"
      @toggleFocus="toggleFocusMode"
      @viewDocument="$router.push(`/view/${documentId}`)"
      @insertTable="insertTable"
    />

    <!-- 抽离出的标签管理 -->
    <EditorTags
      v-show="!isFocusMode"
      v-model:tags="documentTags"
      @change="saveDocument"
    />

    <div class="editor-container">
      <div
        v-show="editorMode !== 'preview'"
        class="editor-panel"
        :class="{ split: editorMode === 'split' }"
      >
        <editor-content v-if="editor" :editor="editor" class="tiptap-editor" />

        <floating-menu
          v-if="editor"
          :editor="editor"
          :tippy-options="{ duration: 100 }"
          class="floating-menu"
        >
          <el-button-group>
            <el-button
              size="small"
              @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
              :type="
                editor.isActive('heading', { level: 1 }) ? 'primary' : 'default'
              "
              >H1</el-button
            >
            <el-button
              size="small"
              @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
              :type="
                editor.isActive('heading', { level: 2 }) ? 'primary' : 'default'
              "
              >H2</el-button
            >
            <el-button
              size="small"
              @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
              :type="
                editor.isActive('heading', { level: 3 }) ? 'primary' : 'default'
              "
              >H3</el-button
            >
            <el-button
              size="small"
              @click="editor.chain().focus().toggleBulletList().run()"
              :type="editor.isActive('bulletList') ? 'primary' : 'default'"
              >列表</el-button
            >
            <el-button
              size="small"
              @click="editor.chain().focus().toggleTaskList().run()"
              :type="editor.isActive('taskList') ? 'primary' : 'default'"
              >待办</el-button
            >
            <el-button
              size="small"
              @click="editor.chain().focus().toggleCodeBlock().run()"
              :type="editor.isActive('codeBlock') ? 'primary' : 'default'"
              >代码</el-button
            >
          </el-button-group>
        </floating-menu>

        <bubble-menu
          v-if="editor"
          :editor="editor"
          :tippy-options="{ duration: 100 }"
          class="bubble-menu"
        >
          <el-button-group>
            <el-button
              size="small"
              @click="editor.chain().focus().toggleBold().run()"
              :type="editor.isActive('bold') ? 'primary' : 'default'"
              ><b>B</b></el-button
            >
            <el-button
              size="small"
              @click="editor.chain().focus().toggleItalic().run()"
              :type="editor.isActive('italic') ? 'primary' : 'default'"
              ><i>I</i></el-button
            >
            <el-button
              size="small"
              @click="editor.chain().focus().toggleStrike().run()"
              :type="editor.isActive('strike') ? 'primary' : 'default'"
              ><s>S</s></el-button
            >
            <el-button
              size="small"
              @click="editor.chain().focus().toggleCode().run()"
              :type="editor.isActive('code') ? 'primary' : 'default'"
              ><code>&lt;&gt;</code></el-button
            >
            <el-button
              size="small"
              @click="handleAIPolish"
              :loading="aiLoading"
              type="success"
              :icon="MagicStick"
              >润色</el-button
            >
          </el-button-group>
        </bubble-menu>
      </div>

      <div
        v-show="editorMode !== 'edit'"
        ref="previewRef"
        class="preview-panel"
        :class="{ split: editorMode === 'split' }"
        @scroll="handleTocScroll"
      >
        <el-scrollbar class="content-scrollbar" @scroll="handlePreviewScroll">
          <div
            class="markdown-preview markdown-body"
            v-html="renderedContent"
            @click="handlePreviewClick"
          ></div>
        </el-scrollbar>
      </div>

      <!-- 抽离出的大纲目录 -->
      <EditorToc
        v-show="!isFocusMode"
        :headings="tocHeadings"
        :activeIndex="tocActiveIndex"
        @scrollTo="scrollToHeading"
      />
    </div>

    <!-- 状态栏：已添加可选链防报错 -->
    <div class="status-bar" v-show="!isFocusMode">
      <span>字符数: {{ documentContent?.length || 0 }}</span>
      <span>行数: {{ lineCount || 0 }}</span>
      <span v-if="estimatedReadTime > 0"
        >预计阅读: {{ estimatedReadTime }}</span
      >
      <span v-if="lastSaved">最后保存: {{ formatTime(lastSaved) }}</span>
    </div>

    <div v-if="isFocusMode" class="focus-exit-bar" @click="toggleFocusMode">
      <el-icon><Close /></el-icon>
      <span>退出专注模式 (Esc)</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDocumentsStore } from "@/stores/documents.js";
import { markdownService as markdownProcessor } from "@/services/markdownService";
import { ImageService } from "@/services/image.js";
import { Close, MagicStick } from "@element-plus/icons-vue";

// 引入子组件
import EditorToolbar from "@/components/Editor/EditorToolbar.vue";
import EditorTags from "@/components/Editor/EditorTags.vue";
import EditorToc from "@/components/Editor/EditorToc.vue";
import { useAutoSave } from "@/composables/editor/useAutoSave";
import { createEditorExtensions } from "@/composables/editor/editorExtensions";
import { useEditorActions } from "@/composables/editor/useEditorActions";
import { useEditorAi } from "@/composables/editor/useEditorAi";
import { useEditorDocument } from "@/composables/editor/useEditorDocument";
import { useEditorImages } from "@/composables/editor/useEditorImages";
import { useEditorPreview } from "@/composables/editor/useEditorPreview";
import { useEditorPreviewClick } from "@/composables/editor/useEditorPreviewClick";

// Tiptap imports
import { EditorContent, useEditor } from "@tiptap/vue-3";
import { FloatingMenu, BubbleMenu } from "@tiptap/vue-3/menus";
import "@excalidraw/excalidraw/index.css";

const route = useRoute();
const router = useRouter();
const documentsStore = useDocumentsStore();

const canGoBack = computed(() => window.history.length > 1);
const goBack = () => {
  router.back();
};

const documentId = ref(route.params.id);
const editorMode = ref("edit");
const previewRef = ref(null);

const editor = useEditor({
  content: "",
  extensions: createEditorExtensions(),
  editorProps: {
    handlePaste(view, event, slice) {
      const items = event.clipboardData?.items;
      if (!items) return false;
      let hasImage = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            hasImage = true;
            handleImageUpload(file);
          }
        }
      }
      return hasImage;
    },
  },
  onUpdate: ({ editor }) => {
    const markdown = editor.storage.markdown.getMarkdown();
    if (documentContent.value !== markdown) {
      documentContent.value = markdown;
      handleContentChange();
    }
    nextTick(() => {
      resolveEditorImages();
    });
  },
});

const {
  documentTitle,
  documentContent,
  documentTags,
  saving,
  lastSaved,
  loadDocument,
  saveDocument,
} = useEditorDocument({
  documentId,
  editor,
  documentsStore,
  router,
  getEditorMarkdown: () =>
    editor.value
      ? editor.value.storage.markdown.getMarkdown()
      : documentContent.value,
  afterEditorContentLoaded: () => {
    nextTick(() => {
      resolveEditorImages();
    });
  },
});

const {
  resolveEditorImages,
  resolvePreviewImages,
  handleImageUpload,
} = useEditorImages({
  documentId,
  documentTitle,
  editor,
  documentsStore,
  markdownProcessor,
  imageService: ImageService,
  saveDocument,
});

const {
  readingProgress,
  tocActiveIndex,
  tocHeadings,
  renderedContent,
  lineCount,
  estimatedReadTime,
  refreshPreviewAssets,
  cycleEditorMode,
  scrollToHeading,
  handleTocScroll,
  handlePreviewScroll,
} = useEditorPreview({
  documentContent,
  editorMode,
  editor,
  previewRef,
  markdownProcessor,
  resolvePreviewImages: () => resolvePreviewImages(previewRef.value),
});

const { handleContentChange, clearAutoSave } = useAutoSave({
  save: saveDocument,
  afterChange: () => refreshPreviewAssets(100),
});

const {
  aiLoading,
  aiWritingLoading,
  handleAIPolish,
  handleAIWrite,
  stopAIWrite,
  handleEditorAiAction,
} = useEditorAi({
  editor,
  documentTitle,
  documentContent,
  markdownProcessor,
  saveDocument,
});

const {
  isFocusMode,
  toggleFocusMode,
  handleEditorExport,
  insertTable,
  handleKeydown,
  formatTime,
} = useEditorActions({
  editor,
  documentTitle,
  documentContent,
  saveDocument,
});

const { handlePreviewClick } = useEditorPreviewClick({
  documentContent,
  documentsStore,
  router,
  markdownProcessor,
  handleContentChange,
});

onMounted(async () => {
  await loadDocument();
  document.addEventListener("keydown", handleKeydown);
  window.addEventListener("editor-ai-action", handleEditorAiAction);
  documentsStore.setEditMode(true);
  refreshPreviewAssets(300);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("editor-ai-action", handleEditorAiAction);
  clearAutoSave();
  documentsStore.setEditMode(false);
});

watch(
  () => route.params.id,
  async (newId) => {
    documentId.value = newId;
    await loadDocument();
  },
);
</script>

<style scoped>
.editor-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  transition: background 0.3s;
}
.reading-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background-color: var(--el-color-primary);
  z-index: 9999;
  transition: width 0.1s ease-out;
}
.editor-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}
.editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.editor-panel.split {
  flex: 0 0 50%;
  border-right: 1px solid var(--el-border-color-lighter);
}
.tiptap-editor {
  flex: 1;
  padding: 40px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  overflow-y: auto;
  font-size: var(--md-font-size, 16px);
  line-height: var(--md-line-height, 1.6);
}
.tiptap-editor :deep(.ProseMirror) {
  outline: none;
  min-height: 100%;
}
.tiptap-editor :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  color: #adb5bd;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
.tiptap-editor :deep(table) {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  margin: 16px 0;
  overflow: hidden;
}
.tiptap-editor :deep(table td),
.tiptap-editor :deep(table th) {
  min-width: 1em;
  border: 1px solid var(--el-border-color);
  padding: 8px 12px;
  vertical-align: top;
  box-sizing: border-box;
  position: relative;
}
.tiptap-editor :deep(table th) {
  font-weight: 600;
  text-align: left;
  background-color: var(--el-fill-color-light);
}
.tiptap-editor :deep(.column-resize-handle) {
  background-color: var(--el-color-primary);
  bottom: -2px;
  position: absolute;
  right: -2px;
  pointer-events: none;
  top: 0;
  width: 4px;
}
.tiptap-editor :deep(ul.tight) {
  padding-left: 20px;
}
.tiptap-editor :deep(ul[data-type="taskList"]) {
  list-style: none;
  padding: 0;
}
.tiptap-editor :deep(ul[data-type="taskList"] li) {
  display: flex;
  margin-bottom: 0.5rem;
}
.tiptap-editor :deep(ul[data-type="taskList"] li > label) {
  margin-right: 0.5rem;
  user-select: none;
}
.tiptap-editor :deep(ul[data-type="taskList"] li > div) {
  flex: 1;
}
.floating-menu,
.bubble-menu {
  background: var(--el-bg-color);
  padding: 4px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--el-border-color-light);
}
.preview-panel {
  flex: 1;
  background: var(--el-bg-color);
  overflow: hidden;
}
.preview-panel.split {
  flex: 0 0 50%;
}
.markdown-preview {
  padding: 40px;
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.6;
}
.status-bar {
  padding: 8px 20px;
  background: #f0f0f0;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #666;
  flex-shrink: 0;
}
.editor-page.focus-mode {
  background: var(--el-bg-color);
}
.focus-mode .editor-container {
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}
.focus-mode .tiptap-editor {
  padding: 60px 40px;
}
.focus-exit-bar {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 20px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-top: none;
  border-radius: 0 0 8px 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.3s;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.focus-exit-bar:hover {
  opacity: 1;
}
.markdown-preview :deep(h1),
.markdown-preview :deep(h2),
.markdown-preview :deep(h3),
.markdown-preview :deep(h4),
.markdown-preview :deep(h5),
.markdown-preview :deep(h6) {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}
.markdown-preview :deep(h1) {
  font-size: 2em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 10px;
}
.markdown-preview :deep(h2) {
  font-size: 1.5em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 8px;
}
.markdown-preview :deep(code) {
  background: #f6f8fa;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 85%;
}
.markdown-preview :deep(pre) {
  background: #f6f8fa;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
}
.markdown-preview :deep(blockquote) {
  border-left: 4px solid #dfe2e5;
  padding-left: 16px;
  color: #6a737d;
  margin: 16px 0;
}
.markdown-preview :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
}
.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  border: 1px solid #dfe2e5;
  padding: 8px 12px;
  text-align: left;
}
.markdown-preview :deep(th) {
  background: #f6f8fa;
  font-weight: 600;
}
:deep(.excalidraw-render-container) {
  margin: 1.5rem 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}
:deep(.excalidraw-loading-placeholder) {
  padding: 40px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
:deep(.render-error) {
  color: var(--el-color-danger);
  padding: 20px;
}
@media (max-width: 768px) {
  .editor-panel.split {
    flex: 0 0 100%;
    height: 50%;
    border-right: none;
    border-bottom: 1px solid #e0e0e0;
  }
  .preview-panel.split {
    flex: 0 0 100%;
    height: 50%;
  }
  .editor-page.focus-mode .editor-container {
    max-width: 100%;
  }
}
</style>
