<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { status } from '@/api/relayfetch'
import type { StatusResponse, FileProgressResponse } from '@/api/types'

// ------------------------
// State
// ------------------------
const data = ref<StatusResponse | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const autoRefresh = ref(true)
const lastUpdateTime = ref<Date | null>(null)

// 存储文件的顺序，确保刷新时顺序不变
const fileOrder = ref<string[]>([])

// ------------------------
// Computed Properties
// ------------------------
const files = computed<FileProgressResponse[]>(() => {
  if (!data.value || !data.value.files) return []

  const filesArray = Object.values(data.value.files)

  // 维持文件顺序：先按fileOrder排序，新文件追加到最后
  filesArray.sort((a, b) => {
    const indexA = fileOrder.value.indexOf(a.file)
    const indexB = fileOrder.value.indexOf(b.file)

    if (indexA === -1 && indexB === -1) {
      // 两个都是新文件，按字母排序
      return a.file.localeCompare(b.file)
    }
    if (indexA === -1) return 1 // a是新文件，放后面
    if (indexB === -1) return -1 // b是新文件，放后面

    return indexA - indexB // 都存在的文件，按原来的顺序
  })

  return filesArray
})

const progressPercentage = computed(() => {
  if (!data.value || data.value.total_files === 0) return 0
  return Math.round((data.value.finished_files / data.value.total_files) * 100)
})

const isRunning = computed(() => {
  return data.value?.is_running ?? false
})

// ------------------------
// Methods
// ------------------------
const load = async () => {
  loading.value = true
  error.value = null

  try {
    const res = await status()
    data.value = res.data
    lastUpdateTime.value = new Date()

    // 更新文件顺序，保持原有顺序不变
    if (res.data.files) {
      const newFiles = Object.keys(res.data.files)
      // 添加新文件到顺序列表的末尾
      newFiles.forEach(file => {
        if (!fileOrder.value.includes(file)) {
          fileOrder.value.push(file)
        }
      })
      // 移除已经不存在的文件
      fileOrder.value = fileOrder.value.filter(file => newFiles.includes(file))
    }

  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    console.error('Failed to load status:', e)
  } finally {
    loading.value = false
  }
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
}

const refreshNow = () => {
  load()
}

const formatTime = (date: Date | null) => {
  if (!date) return 'Never'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// ------------------------
// Auto refresh
// ------------------------
let timer: number | undefined

watch(autoRefresh, (shouldRefresh) => {
  if (timer) {
    clearInterval(timer)
    timer = undefined
  }

  if (shouldRefresh) {
    timer = window.setInterval(load, 2000)
  }
})

onMounted(() => {
  load()
  if (autoRefresh.value) {
    timer = window.setInterval(load, 2000)
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="status-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-content">
        <div class="header-title">
          <h1>Download Status</h1>
          <p>Real-time monitoring of download progress</p>
        </div>

        <div class="header-controls">
          <div class="status-indicator">
            <div class="status-dot" :class="{ running: isRunning, stopped: !isRunning }"></div>
            <span :class="{ 'running-text': isRunning, 'stopped-text': !isRunning }">
              {{ isRunning ? 'Running' : 'Stopped' }}
            </span>
          </div>

          <button
            @click="refreshNow"
            :disabled="loading"
            class="refresh-btn"
          >
            <span v-if="loading" class="spinner"></span>
            <svg v-else class="refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>

          <button
            @click="toggleAutoRefresh"
            class="auto-refresh-btn"
            :class="{ active: autoRefresh }"
          >
            <svg class="auto-refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ autoRefresh ? 'Auto Refresh On' : 'Auto Refresh Off' }}
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
          <h3>Error loading status</h3>
          <p>{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card total-files">
        <div class="stat-content">
          <div>
            <p class="stat-label">Total Files</p>
            <p class="stat-value">{{ data?.total_files || 0 }}</p>
          </div>
          <div class="stat-icon">
            📄
          </div>
        </div>
      </div>

      <div class="stat-card finished">
        <div class="stat-content">
          <div>
            <p class="stat-label">Finished</p>
            <p class="stat-value">{{ data?.finished_files || 0 }}</p>
          </div>
          <div class="stat-icon">
            ✅
          </div>
        </div>
      </div>

      <div class="stat-card failed">
        <div class="stat-content">
          <div>
            <p class="stat-label">Failed</p>
            <p class="stat-value">{{ data?.failed_files || 0 }}</p>
          </div>
          <div class="stat-icon">
            ❌
          </div>
        </div>
      </div>

      <div class="stat-card stored">
        <div class="stat-content">
          <div>
            <p class="stat-label">Stored</p>
            <p class="stat-value">{{ data?.stored_files || 0 }}</p>
          </div>
          <div class="stat-icon">
            💾
          </div>
        </div>
      </div>
    </div>

    <!-- Progress Section -->
    <div class="progress-section">
      <div class="progress-header">
        <div>
          <h2>Overall Progress</h2>
          <p class="last-updated">
            Last updated: {{ formatTime(lastUpdateTime) }}
          </p>
        </div>
        <div class="progress-percentage">
          <div class="percentage-value">{{ progressPercentage }}%</div>
          <div class="percentage-label">
            {{ data?.finished_files || 0 }} of {{ data?.total_files || 0 }} files
          </div>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="progress-bar-container">
        <div class="progress-bar-labels">
          <span class="progress-label">In Progress</span>
          <span class="progress-percent">{{ progressPercentage }}%</span>
        </div>
        <div class="progress-bar-background">
          <div
            class="progress-bar-fill"
            :style="{ width: `${progressPercentage}%` }"
          ></div>
        </div>
      </div>

      <!-- Last Result -->
      <div v-if="data?.last_result" class="last-result">
        <div class="result-content">
          <svg class="result-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p class="result-title">Last Result</p>
            <p class="result-text">{{ data.last_result }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Files Table -->
    <div class="files-section">
      <div class="section-header">
        <h2>Files</h2>
        <span class="file-count">
          {{ files.length }} {{ files.length === 1 ? 'file' : 'files' }}
        </span>
      </div>

      <!-- Loading State -->
      <div v-if="loading && !data" class="loading-state">
        <div class="spinner-large"></div>
        <p>Loading files...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="files.length === 0 && data" class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3>No active files</h3>
        <p>All downloads have been completed or no files are currently being processed.</p>
      </div>

      <!-- Files Table -->
      <div v-else class="files-table-container">
        <table class="files-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Progress</th>
              <th>Size</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="file in files"
              :key="file.file"
              class="file-row"
            >
              <td class="file-cell">
                <div class="file-info">
                  <div class="file-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div class="file-details">
                    <div class="file-name">{{ file.file }}</div>
                    <div v-if="file.error" class="file-error">{{ file.error }}</div>
                  </div>
                </div>
              </td>
              <td class="progress-cell">
                <div class="file-progress">
                  <div class="progress-labels">
                    <span>{{ Math.round((file.downloaded / file.total) * 100) }}%</span>
                    <span>{{ formatBytes(file.downloaded) }} / {{ formatBytes(file.total) }}</span>
                  </div>
                  <div class="file-progress-bar">
                    <div
                      class="file-progress-fill"
                      :class="{
                        done: file.done,
                        error: file.error,
                        downloading: !file.done && !file.error
                      }"
                      :style="{ width: `${Math.min(100, (file.downloaded / file.total) * 100)}%` }"
                    ></div>
                  </div>
                </div>
              </td>
              <td class="size-cell">
                {{ formatBytes(file.total) }}
              </td>
              <td class="status-cell">
                <span
                  class="status-badge"
                  :class="{
                    'status-done': file.done,
                    'status-error': file.error,
                    'status-downloading': !file.done && !file.error
                  }"
                >
                  <span class="status-icon">
                    {{ file.done ? '✅' : file.error ? '❌' : '⏳' }}
                  </span>
                  {{ file.done ? 'Completed' : file.error ? 'Failed' : 'Downloading' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>Auto-refresh is {{ autoRefresh ? 'enabled' : 'disabled' }} • Last updated: {{ formatTime(lastUpdateTime) }}</p>
    </div>
  </div>
</template>

<style scoped>
/* 基础布局 */
.status-dashboard {
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

.header-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (min-width: 768px) {
  .header-controls {
    flex-direction: row;
    align-items: center;
  }
}

/* Status Indicator */
.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f1f5f9;
  border-radius: 8px;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  position: relative;
}

.status-dot.running {
  background-color: #22c55e;
}

.status-dot.running::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #22c55e;
  border-radius: 50%;
  animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.status-dot.stopped {
  background-color: #94a3b8;
}

.running-text {
  color: #16a34a;
  font-weight: 500;
  font-size: 14px;
}

.stopped-text {
  color: #64748b;
  font-weight: 500;
  font-size: 14px;
}

/* Buttons */
.refresh-btn,
.auto-refresh-btn {
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

.refresh-btn:hover:not(:disabled),
.auto-refresh-btn:hover {
  background: #f8fafc;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auto-refresh-btn.active {
  background: #dbeafe;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.refresh-icon,
.auto-refresh-icon {
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

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

@media (min-width: 640px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 4px 0;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
}

.stat-icon {
  font-size: 32px;
  opacity: 0.8;
}

/* Card Colors */
.total-files {
  border-top: 4px solid #3b82f6;
}

.total-files .stat-value {
  color: #3b82f6;
}

.finished {
  border-top: 4px solid #22c55e;
}

.finished .stat-value {
  color: #22c55e;
}

.failed {
  border-top: 4px solid #ef4444;
}

.failed .stat-value {
  color: #ef4444;
}

.stored {
  border-top: 4px solid #8b5cf6;
}

.stored .stat-value {
  color: #8b5cf6;
}

/* Progress Section */
.progress-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
}

.progress-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

@media (min-width: 768px) {
  .progress-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

.progress-section h2 {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 4px 0;
}

.last-updated {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.progress-percentage {
  text-align: right;
}

.percentage-value {
  font-size: 32px;
  font-weight: 700;
  color: #3b82f6;
  line-height: 1;
}

.percentage-label {
  font-size: 14px;
  color: #64748b;
  margin-top: 4px;
}

/* Progress Bar */
.progress-bar-container {
  margin-bottom: 24px;
}

.progress-bar-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 14px;
  font-weight: 600;
  color: #3b82f6;
  padding: 4px 12px;
  background: #dbeafe;
  border-radius: 16px;
}

.progress-percent {
  font-size: 14px;
  font-weight: 600;
  color: #3b82f6;
}

.progress-bar-background {
  height: 12px;
  background: #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(to right, #3b82f6, #60a5fa);
  border-radius: 6px;
  transition: width 0.5s ease-out;
}

/* Last Result */
.last-result {
  background: #f8fafc;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e2e8f0;
}

.result-content {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.result-icon {
  width: 20px;
  height: 20px;
  color: #64748b;
  flex-shrink: 0;
  margin-top: 2px;
}

.result-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 4px 0;
}

.result-text {
  font-size: 14px;
  color: #475569;
  margin: 0;
}

/* Files Section */
.files-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  margin-bottom: 20px;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
}

.section-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.file-count {
  font-size: 14px;
  color: #64748b;
  background: #f1f5f9;
  padding: 4px 12px;
  border-radius: 16px;
}

/* Loading State */
.loading-state {
  padding: 60px 20px;
  text-align: center;
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
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  color: #cbd5e1;
  margin: 0 auto 16px;
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

/* Files Table */
.files-table-container {
  overflow-x: auto;
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
  align-items: flex-start;
}

.file-icon {
  width: 36px;
  height: 36px;
  background: #dbeafe;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.file-icon svg {
  width: 18px;
  height: 18px;
  color: #3b82f6;
}

.file-details {
  min-width: 0;
}

.file-name {
  font-weight: 500;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.file-error {
  font-size: 12px;
  color: #ef4444;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

/* Progress Cell */
.file-progress {
  min-width: 200px;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 12px;
}

.progress-labels span:first-child {
  font-weight: 600;
  color: #475569;
}

.progress-labels span:last-child {
  color: #94a3b8;
}

.file-progress-bar {
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.file-progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease-out;
}

.file-progress-fill.downloading {
  background: #3b82f6;
}

.file-progress-fill.done {
  background: #22c55e;
}

.file-progress-fill.error {
  background: #ef4444;
}

/* Size Cell */
.size-cell {
  font-family: 'SF Mono', Monaco, 'Cascadia Mono', monospace;
  font-size: 14px;
  color: #475569;
}

/* Status Cell */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.status-downloading {
  background: #dbeafe;
  color: #1d4ed8;
}

.status-done {
  background: #dcfce7;
  color: #166534;
}

.status-error {
  background: #fee2e2;
  color: #991b1b;
}

.status-icon {
  font-size: 14px;
}

/* Footer */
.footer {
  text-align: center;
  padding: 20px;
  font-size: 14px;
  color: #94a3b8;
}

/* Animations */
@keyframes ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
</style>