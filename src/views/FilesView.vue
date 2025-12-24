<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { listFiles } from '@/api/relayfetch'
import type { FileInfo } from '@/api/types'

// ------------------------
// State
// ------------------------
const files = ref<FileInfo[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')
const sortBy = ref<'filename' | 'last_modified'>('filename')
const sortOrder = ref<'asc' | 'desc'>('asc')

// ------------------------
// Computed Properties
// ------------------------
const filteredFiles = computed(() => {
  let result = files.value

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(file =>
      file.filename.toLowerCase().includes(query) ||
      file.url.toLowerCase().includes(query)
    )
  }

  // 排序
  result = [...result].sort((a, b) => {
    let comparison = 0

    if (sortBy.value === 'filename') {
      comparison = a.filename.localeCompare(b.filename)
    } else if (sortBy.value === 'last_modified') {
      const dateA = new Date(a.last_modified).getTime()
      const dateB = new Date(b.last_modified).getTime()
      comparison = dateA - dateB
    }

    return sortOrder.value === 'asc' ? comparison : -comparison
  })

  return result
})

const fileStats = computed(() => {
  const total = files.value.length
  const filtered = filteredFiles.value.length
  return {
    total,
    filtered,
    showingAll: total === filtered
  }
})

// ------------------------
// Methods
// ------------------------
const loadFiles = async (): Promise<void> => {
  loading.value = true
  error.value = null

  try {
    const response = await listFiles()
    files.value = response.data
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    console.error('Failed to load files:', e)
  } finally {
    loading.value = false
  }
}

const refreshFiles = async (): Promise<void> => {
  await loadFiles()
}

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString

    // 如果是今天，只显示时间
    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      })
    }
  } catch {
    return dateString
  }
}

const formatTimeAgo = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ''

    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
    return formatDate(dateString)
  } catch {
    return ''
  }
}

const toggleSort = (column: 'filename' | 'last_modified'): void => {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = column
    sortOrder.value = 'asc'
  }
}

const getFileIcon = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  const iconMap: Record<string, string> = {
    // 图片文件
    'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'bmp': '🖼️', 'svg': '🖼️',
    'webp': '🖼️', 'ico': '🖼️',
    // 文档文件
    'pdf': '📄', 'doc': '📄', 'docx': '📄', 'txt': '📄', 'rtf': '📄',
    'odt': '📄', 'md': '📄',
    // 表格文件
    'xls': '📊', 'xlsx': '📊', 'csv': '📊', 'ods': '📊',
    // 演示文件
    'ppt': '📽️', 'pptx': '📽️', 'odp': '📽️',
    // 压缩文件
    'zip': '🗜️', 'rar': '🗜️', '7z': '🗜️', 'tar': '🗜️', 'gz': '🗜️',
    'bz2': '🗜️',
    // 代码文件
    'js': '📝', 'ts': '📝', 'py': '📝', 'java': '📝', 'cpp': '📝',
    'c': '📝', 'html': '📝', 'css': '📝', 'json': '📝', 'xml': '📝',
    // 视频文件
    'mp4': '🎬', 'avi': '🎬', 'mov': '🎬', 'mkv': '🎬', 'wmv': '🎬',
    'flv': '🎬',
    // 音频文件
    'mp3': '🎵', 'wav': '🎵', 'flac': '🎵', 'aac': '🎵', 'ogg': '🎵',
    // 其他
    'exe': '⚙️', 'msi': '⚙️', 'app': '⚙️', 'dmg': '⚙️'
  }

  return iconMap[ext] || '📄'
}

const copyToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text)

    // 显示成功提示
    const alert = document.createElement('div')
    alert.className = 'success-alert'
    alert.innerHTML = `
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
      <span>Copied to clipboard!</span>
    `
    document.body.appendChild(alert)

    setTimeout(() => {
      alert.remove()
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const downloadFile = async (url: string, filename: string): Promise<void> => {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  } catch (err) {
    console.error('Download failed:', err)
  }
}

// ------------------------
// Lifecycle
// ------------------------
onMounted(() => {
  loadFiles()
})
</script>

<template>
  <div class="files-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-content">
        <div class="header-title">
          <h1>Downloaded Files</h1>
          <p>View and manage all downloaded files</p>
        </div>

        <div class="header-controls">
          <button
            @click="refreshFiles"
            :disabled="loading"
            class="refresh-btn"
          >
            <span v-if="loading" class="spinner"></span>
            <svg v-else class="refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="error-alert">
      <div class="alert-content">
        <svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div>
          <h3>Error loading files</h3>
          <p>{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Stats and Search -->
    <div class="files-controls">
      <div class="stats-card">
        <div class="stat-item">
          <span class="stat-label">Total Files</span>
          <span class="stat-value">{{ fileStats.total }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Showing</span>
          <span class="stat-value">{{ fileStats.filtered }}</span>
        </div>
      </div>

      <div class="search-container">
        <div class="search-input-wrapper">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search files or URLs..."
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="clear-search"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading && files.length === 0" class="loading-state">
      <div class="spinner-large"></div>
      <p>Loading files...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="files.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3>No files found</h3>
      <p>No files have been downloaded yet. Check the status page for download progress.</p>
    </div>

    <!-- Files Table -->
    <div v-else class="files-section">
      <div class="section-header">
        <h2>Files List</h2>
        <div class="sort-controls">
          <button
            @click="toggleSort('filename')"
            class="sort-btn"
            :class="{ active: sortBy === 'filename' }"
          >
            Name
            <svg
              v-if="sortBy === 'filename'"
              class="sort-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                :d="sortOrder === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'"
              />
            </svg>
          </button>
          <button
            @click="toggleSort('last_modified')"
            class="sort-btn"
            :class="{ active: sortBy === 'last_modified' }"
          >
            Last Modified
            <svg
              v-if="sortBy === 'last_modified'"
              class="sort-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                :d="sortOrder === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'"
              />
            </svg>
          </button>
        </div>
      </div>

      <div class="files-table-container">
        <table class="files-table">
          <thead>
            <tr>
              <th class="file-header">File</th>
              <th class="url-header">URL</th>
              <th class="date-header">Last Modified</th>
              <th class="actions-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="file in filteredFiles"
              :key="file.filename"
              class="file-row"
            >
              <td class="file-cell">
                <div class="file-info">
                  <div class="file-icon">
                    {{ getFileIcon(file.filename) }}
                  </div>
                  <div class="file-details">
                    <div class="file-name">{{ file.filename }}</div>
                    <div class="file-time" :title="file.last_modified">
                      {{ formatTimeAgo(file.last_modified) }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="url-cell">
                <div class="url-content">
                  <div class="url-text">{{ file.url }}</div>
                  <button
                    @click="copyToClipboard(file.url)"
                    class="copy-btn"
                    title="Copy URL"
                  >
                    <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </td>
              <td class="date-cell">
                <div class="date-content">
                  <div class="date-text">{{ formatDate(file.last_modified) }}</div>
                  <div class="date-subtext">
                    {{ formatTimeAgo(file.last_modified) }}
                  </div>
                </div>
              </td>
              <td class="actions-cell">
                <div class="action-buttons">
                  <button
                    @click="downloadFile(file.url, file.filename)"
                    class="action-btn download-btn"
                    title="Download file"
                  >
                    <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  <button
                    @click="copyToClipboard(file.filename)"
                    class="action-btn copy-btn"
                    title="Copy filename"
                  >
                    <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- No Results State -->
        <div v-if="filteredFiles.length === 0 && files.length > 0" class="no-results">
          <div class="no-results-icon">🔍</div>
          <h3>No matching files found</h3>
          <p>Try adjusting your search criteria</p>
        </div>
      </div>

      <!-- File Count -->
      <div class="file-count">
        <span v-if="fileStats.showingAll">
          Showing all {{ fileStats.total }} files
        </span>
        <span v-else>
          Showing {{ fileStats.filtered }} of {{ fileStats.total }} files
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 基础布局 */
.files-dashboard {
  min-height: 100vh;
  background-color: #f8fafc;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  color: #334155;
}

/* Header */
.dashboard-header {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

@media (min-width: 768px) {
  .header-content {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

.header-title h1 {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 4px 0;
}

.header-title p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

/* Refresh Button */
.refresh-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid #e2e8f0;
  background: white;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: #f8fafc;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-icon {
  width: 16px;
  height: 16px;
}

/* Error Alert */
.error-alert {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.alert-content {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.alert-icon {
  width: 20px;
  height: 20px;
  color: #dc2626;
  flex-shrink: 0;
  margin-top: 2px;
}

.error-alert h3 {
  font-size: 14px;
  font-weight: 600;
  color: #991b1b;
  margin: 0 0 4px 0;
}

.error-alert p {
  font-size: 14px;
  color: #b91c1c;
  margin: 0;
}

/* Controls Section */
.files-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

@media (min-width: 768px) {
  .files-controls {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

/* Stats Card */
.stats-card {
  display: flex;
  gap: 24px;
  background: white;
  border-radius: 12px;
  padding: 16px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #3b82f6;
}

/* Search */
.search-container {
  flex: 1;
  max-width: 400px;
}

.search-input-wrapper {
  position: relative;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: #94a3b8;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 12px 12px 12px 40px;
  font-size: 14px;
  color: #1e293b;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-input::placeholder {
  color: #94a3b8;
}

.clear-search {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-search:hover {
  color: #64748b;
}

/* Loading State */
.loading-state {
  background: white;
  border-radius: 12px;
  padding: 60px 20px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.spinner-large {
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  margin: 0 auto 16px;
  animation: spin 1s linear infinite;
}

.loading-state p {
  color: #64748b;
  font-size: 14px;
  margin: 0;
}

/* Empty State */
.empty-state {
  background: white;
  border-radius: 12px;
  padding: 60px 20px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.empty-icon {
  width: 64px;
  height: 64px;
  color: #cbd5e1;
  margin: 0 auto 16px;
}

.empty-icon svg {
  width: 100%;
  height: 100%;
}

.empty-state h3 {
  font-size: 18px;
  font-weight: 600;
  color: #475569;
  margin: 0 0 8px 0;
}

.empty-state p {
  font-size: 14px;
  color: #64748b;
  max-width: 300px;
  margin: 0 auto;
  line-height: 1.5;
}

/* Files Section */
.files-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
}

@media (min-width: 768px) {
  .section-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

.section-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

/* Sort Controls */
.sort-controls {
  display: flex;
  gap: 8px;
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sort-btn:hover {
  background: #e2e8f0;
}

.sort-btn.active {
  background: #dbeafe;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.sort-icon {
  width: 14px;
  height: 14px;
}

/* Files Table */
.files-table-container {
  overflow-x: auto;
  min-height: 300px;
}

.files-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 800px;
}

.files-table th {
  text-align: left;
  padding: 16px 24px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}

.files-table td {
  padding: 16px 24px;
  border-bottom: 1px solid #f1f5f9;
}

.file-row:hover {
  background: #f8fafc;
}

/* File Cell */
.file-info {
  display: flex;
  gap: 12px;
  align-items: center;
}

.file-icon {
  width: 40px;
  height: 40px;
  background: #dbeafe;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.file-details {
  min-width: 0;
}

.file-name {
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 2px;
  word-break: break-word;
}

.file-time {
  font-size: 12px;
  color: #94a3b8;
}

/* URL Cell */
.url-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.url-text {
  flex: 1;
  font-size: 14px;
  color: #475569;
  word-break: break-all;
}

.copy-btn {
  flex-shrink: 0;
  padding: 6px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.copy-btn:hover {
  background: #e2e8f0;
}

.copy-icon {
  width: 14px;
  height: 14px;
  color: #64748b;
}

/* Date Cell */
.date-content {
  display: flex;
  flex-direction: column;
}

.date-text {
  font-size: 14px;
  color: #1e293b;
  margin-bottom: 2px;
}

.date-subtext {
  font-size: 12px;
  color: #94a3b8;
}

/* Actions Cell */
.action-buttons {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 8px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: #e2e8f0;
}

.download-btn:hover {
  background: #dbeafe;
  border-color: #bfdbfe;
}

.action-icon {
  width: 16px;
  height: 16px;
  color: #64748b;
}

/* No Results */
.no-results {
  padding: 60px 20px;
  text-align: center;
  border-top: 1px solid #e2e8f0;
}

.no-results-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-results h3 {
  font-size: 18px;
  font-weight: 600;
  color: #475569;
  margin: 0 0 8px 0;
}

.no-results p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

/* File Count */
.file-count {
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  font-size: 14px;
  color: #64748b;
  text-align: center;
}

/* Spinner */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Animations */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

<style>
/* 全局提示样式 */
.success-alert {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  animation: slideInRight 0.3s ease-out;
  max-width: 400px;
  background: #dcfce7;
  border: 1px solid #bbf7d0;
  color: #166534;
}

.success-alert svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>