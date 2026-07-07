<template>
  <div class="search-page">
    <div class="search-header">
      <h1>搜索文档</h1>
      <el-input
        v-model="searchQuery"
        placeholder="输入关键词搜索..."
        size="large"
        class="search-input"
        @input="handleSearch"
        clearable
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <div class="search-filters" v-if="documentsStore.documents.length > 0">
      <el-select
        v-model="selectedTags"
        multiple
        placeholder="按标签过滤"
        class="tag-filter"
        @change="handleTagFilter"
      >
        <el-option
          v-for="tag in allTags"
          :key="tag"
          :label="tag"
          :value="tag"
        />
      </el-select>

      <el-select
        v-model="knowledgeTypeFilter"
        placeholder="知识类型"
        class="knowledge-filter"
        clearable
      >
        <el-option
          v-for="item in knowledgeTypeOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>

      <el-select
        v-model="knowledgeStatusFilter"
        placeholder="知识状态"
        class="knowledge-filter"
        clearable
      >
        <el-option
          v-for="item in knowledgeStatusOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>

      <el-select
        v-model="confidenceFilter"
        placeholder="可信度"
        class="knowledge-filter"
        clearable
      >
        <el-option label="高可信" value="high" />
        <el-option label="中可信" value="medium" />
        <el-option label="低可信" value="low" />
      </el-select>

      <el-select
        v-model="qualityFilter"
        placeholder="维护状态"
        class="knowledge-filter"
        clearable
      >
        <el-option label="待复核" value="needsReview" />
        <el-option label="无标签" value="missingTags" />
        <el-option label="缺摘要" value="missingSummary" />
        <el-option label="孤立知识" value="isolated" />
      </el-select>

      <el-select
        v-model="sortBy"
        placeholder="排序方式"
        class="sort-select"
        @change="handleSort"
      >
        <el-option label="相关性" value="relevance" />
        <el-option label="标题" value="title" />
        <el-option label="创建时间" value="created" />
        <el-option label="更新时间" value="updated" />
      </el-select>
    </div>

    <div class="search-results">
      <div class="results-info" v-if="searchQuery">
        找到 {{ displayDocuments.length }} 个结果
      </div>

      <div v-if="displayDocuments.length === 0 && searchQuery" class="no-results">
        <el-empty description="没有找到相关文档" />
      </div>

      <div
        v-if="!searchQuery && filteredDocuments.length > 0"
        class="all-documents"
      >
        <h2>所有文档</h2>
      </div>

      <div class="document-grid">
        <el-card
          v-for="doc in displayDocuments"
          :key="doc.id"
          class="document-card"
          @click="viewDocument(doc)"
        >
          <div class="doc-header">
            <h3 class="doc-title">{{ doc.title }}</h3>
            <div class="doc-actions">
              <el-button
                size="small"
                text
                @click.stop="editDocument(doc)"
                :icon="Edit"
              />
            </div>
          </div>

          <div
            class="doc-summary"
            v-html="
              doc.highlightedSummary || doc.summary || fallbackSummary(doc)
            "
          ></div>

          <div class="doc-meta">
            <span class="doc-date">{{ formatDate(doc.updatedAt) }}</span>
            <div class="doc-knowledge">
              <el-tag size="small" effect="plain">
                {{ getKnowledgeTypeLabel(doc.knowledgeType) }}
              </el-tag>
              <el-tag size="small" :type="getKnowledgeStatusTagType(doc.knowledgeStatus)" effect="plain">
                {{ getKnowledgeStatusLabel(doc.knowledgeStatus) }}
              </el-tag>
              <el-tag size="small" :type="getConfidenceTagType(doc.confidence)" effect="plain">
                {{ getConfidenceLabel(doc.confidence) }}
              </el-tag>
            </div>
            <div class="doc-tags" v-if="doc.tags && doc.tags.length > 0">
              <el-tag
                v-for="tag in doc.tags.slice(0, 3)"
                :key="tag"
                size="small"
                type="info"
              >
                {{ tag }}
              </el-tag>
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useDocumentsStore } from "@/stores/documents.js";
import { markdownService as markdownProcessor } from "@/services/markdownService";
import { Search, Edit } from "@element-plus/icons-vue";
import {
  KNOWLEDGE_STATUS_LABELS,
  KNOWLEDGE_TYPE_LABELS
} from "@/domain/knowledge/knowledgeAnalytics";

const router = useRouter();
const route = useRoute();
const documentsStore = useDocumentsStore();

// 响应式数据
const searchQuery = ref("");
const selectedTags = ref([]);
const knowledgeTypeFilter = ref("");
const knowledgeStatusFilter = ref("");
const confidenceFilter = ref("");
const qualityFilter = ref("");
const sortBy = ref("relevance");

// 计算属性
const allTags = computed(() => documentsStore.allTags);
const searchResults = computed(() => documentsStore.searchResults);
const filteredDocuments = computed(() => documentsStore.filteredDocuments);
const knowledgeAnalysis = computed(() => documentsStore.knowledgeAnalysis);
const isolatedIds = computed(() => new Set(knowledgeAnalysis.value.maintenance.isolated.map(doc => String(doc.id))));
const reviewIds = computed(() => new Set(knowledgeAnalysis.value.maintenance.needsReview.map(doc => String(doc.id))));
const knowledgeTypeOptions = computed(() => Object.entries(KNOWLEDGE_TYPE_LABELS).map(([value, label]) => ({ value, label })));
const knowledgeStatusOptions = computed(() => Object.entries(KNOWLEDGE_STATUS_LABELS).map(([value, label]) => ({ value, label })));

const displayDocuments = computed(() => {
  let docs = searchQuery.value ? searchResults.value : filteredDocuments.value;

  docs = docs.filter(doc => {
    if (doc.isFolder) return false;

    if (selectedTags.value.length > 0) {
      const tags = Array.isArray(doc.tags) ? doc.tags : [];
      if (!selectedTags.value.some(tag => tags.includes(tag))) return false;
    }

    if (knowledgeTypeFilter.value && (doc.knowledgeType || "note") !== knowledgeTypeFilter.value) {
      return false;
    }

    if (knowledgeStatusFilter.value && (doc.knowledgeStatus || "draft") !== knowledgeStatusFilter.value) {
      return false;
    }

    if (confidenceFilter.value && (doc.confidence || "medium") !== confidenceFilter.value) {
      return false;
    }

    if (qualityFilter.value === "needsReview" && !reviewIds.value.has(String(doc.id))) return false;
    if (qualityFilter.value === "missingTags" && Array.isArray(doc.tags) && doc.tags.length > 0) return false;
    if (qualityFilter.value === "missingSummary" && doc.summary && doc.summary.trim()) return false;
    if (qualityFilter.value === "isolated" && !isolatedIds.value.has(String(doc.id))) return false;

    return true;
  });

  // 排序
  if (sortBy.value !== "relevance") {
    docs = [...docs].sort((a, b) => {
      switch (sortBy.value) {
        case "title":
          return a.title.localeCompare(b.title);
        case "created":
          return new Date(b.createdAt) - new Date(a.createdAt);
        case "updated":
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        default:
          return 0;
      }
    });
  }

  return docs;
});

// 辅助方法
const fallbackSummary = (doc) => markdownProcessor.generateSummary(doc.content);

// 方法
const handleSearch = (query) => {
  console.log("🔍 Search页面: 处理搜索输入:", query);
  documentsStore.searchDocuments(query);
};

// 调试输出
watch([searchQuery, searchResults], () => {
  console.log(
    "🔍 Search页面状态更新: Query:",
    searchQuery.value,
    "Results Count:",
    searchResults.value.length,
  );
});

const syncRouteParams = () => {
  const queryTags = route.query.tags;
  if (queryTags) {
    const tagsArray = Array.isArray(queryTags) ? queryTags : [queryTags];
    selectedTags.value = tagsArray;
    documentsStore.setTagFilter(tagsArray);
    console.log("🏷️ Search页面: 从路由同步标签过滤:", tagsArray);
  }

  knowledgeTypeFilter.value = typeof route.query.knowledgeType === "string" ? route.query.knowledgeType : "";
  knowledgeStatusFilter.value = typeof route.query.knowledgeStatus === "string" ? route.query.knowledgeStatus : "";
  confidenceFilter.value = typeof route.query.confidence === "string" ? route.query.confidence : "";
  qualityFilter.value = typeof route.query.quality === "string" ? route.query.quality : "";
};

const handleTagFilter = (tags) => {
  documentsStore.setTagFilter(tags);
};

const handleSort = () => {
  // 排序逻辑在计算属性中处理
};

const viewDocument = (doc) => {
  router.push(`/view/${doc.id}`);
};

const editDocument = (doc) => {
  router.push(`/editor/${doc.id}`);
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("zh-CN");
};

const getKnowledgeTypeLabel = (type) => {
  return KNOWLEDGE_TYPE_LABELS[type] || KNOWLEDGE_TYPE_LABELS.note;
};

const getKnowledgeStatusLabel = (status) => {
  return KNOWLEDGE_STATUS_LABELS[status] || KNOWLEDGE_STATUS_LABELS.draft;
};

const getKnowledgeStatusTagType = (status) => {
  if (status === "verified") return "success";
  if (status === "outdated") return "warning";
  if (status === "archived") return "info";
  return "";
};

const getConfidenceLabel = (confidence) => {
  if (confidence === "high") return "高可信";
  if (confidence === "low") return "低可信";
  return "中可信";
};

const getConfidenceTagType = (confidence) => {
  if (confidence === "high") return "success";
  if (confidence === "low") return "warning";
  return "info";
};

// 生命周期
onMounted(async () => {
  if (documentsStore.documents.length === 0) {
    await documentsStore.loadDocuments();
  }
  syncRouteParams();
});

watch(
  () => route.query.tags,
  () => {
    syncRouteParams();
  },
);

watch(
  () => [route.query.knowledgeType, route.query.knowledgeStatus, route.query.confidence, route.query.quality],
  () => {
    syncRouteParams();
  },
);
</script>

<style scoped>
.search-page {
  padding: 40px;
  max-width: 1200px;
  margin: 0 auto;
}

.search-header {
  text-align: center;
  margin-bottom: 30px;
}

.search-header h1 {
  margin-bottom: 20px;
  color: #333;
}

.search-input {
  max-width: 600px;
}

.search-filters {
  display: flex;
  gap: 15px;
  margin-bottom: 30px;
  justify-content: center;
  flex-wrap: wrap;
}

.tag-filter,
.knowledge-filter,
.sort-select {
  min-width: 200px;
}

.search-results {
  margin-top: 20px;
}

.results-info {
  margin-bottom: 20px;
  color: #666;
  font-size: 0.9em;
}

.all-documents h2 {
  margin-bottom: 20px;
  color: #333;
}

.no-results {
  text-align: center;
  padding: 60px 20px;
}

.document-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.document-card {
  cursor: pointer;
  transition: all 0.2s;
  height: fit-content;
}

.document-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.doc-title {
  margin: 0;
  color: #333;
  font-size: 1.1em;
  line-height: 1.3;
  flex: 1;
}

.doc-actions {
  opacity: 0;
  transition: opacity 0.2s;
  margin-left: 10px;
}

.document-card:hover .doc-actions {
  opacity: 1;
}

.doc-summary {
  color: #666;
  font-size: 0.9em;
  line-height: 1.5;
  margin-bottom: 15px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.doc-meta {
  display: grid;
  gap: 10px;
  margin-top: auto;
}

.doc-date {
  color: #999;
  font-size: 0.8em;
}

.doc-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.doc-knowledge {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

@media (max-width: 768px) {
  .search-page {
    padding: 20px;
  }

  .search-filters {
    flex-direction: column;
    align-items: center;
  }

  .tag-filter,
  .knowledge-filter,
  .sort-select {
    width: 100%;
    max-width: 300px;
  }

  .document-grid {
    grid-template-columns: 1fr;
  }
}

/* --- 搜索关键词高亮样式 --- */
:deep(.search-highlight) {
  background-color: rgba(255, 213, 0, 0.3); /* 柔和的黄色背景 */
  color: #b06a00; /* 突出的文字颜色 */
  font-weight: 600;
  padding: 0 2px;
  border-radius: 3px;
  box-shadow: 0 1px 2px rgba(255, 213, 0, 0.2);
}

.doc-summary {
  color: #666;
  font-size: 0.9em;
  line-height: 1.6;
  margin-bottom: 15px;
  /* 确保超长文字省略号显示 */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}
</style>
