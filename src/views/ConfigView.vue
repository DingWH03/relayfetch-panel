<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
import {
  getConfig,
  updateConfig,
  reloadConfig,
  cleanUnusedFiles,
  triggerSync,
  updateFiles,
  listFiles
} from '@/api/relayfetch'
import type { GetConfigResponse, FileItem, UpdateFilesRequest, FileInfo } from '@/api/types'

// ------------------------
// State
// ------------------------
const config = ref<GetConfigResponse | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const saving = ref(false)
const lastSaved = ref<Date | null>(null)
const activeTab = ref<'basic' | 'files' | 'maintenance'>('basic')

// 基础配置表单数据
const formData = ref({
  url: '',
  storage_dir: '',
  interval_secs: 0,
  proxy: ''
})

// 文件管理表单数据
const fileData = reactive({
  add_files: [{ filename: '', path: '' }],
  remove_files: [] as string[],
  replace_all: false,
  replace_files: [] as FileItem[]
})

// 维护操作状态
const operationStates = reactive({
  reloading: false,
  cleaning: false,
  syncing: false,
  updatingFiles: false,
  loadingFiles: false
})

// 文件模式选择
const fileMode = ref<'add' | 'remove' | 'replace'>('add')

// 当前文件列表（从API获取）
const currentFiles = ref<FileInfo[]>([])
const fileSelection = ref<string[]>([])

// ------------------------
// Computed Properties
// ------------------------
const isValid = computed(() => {
  return formData.value.url.trim() !== '' &&
         formData.value.storage_dir.trim() !== '' &&
         formData.value.interval_secs > 0
})

const hasChanges = computed(() => {
  if (!config.value) return false

  return formData.value.url !== config.value.url ||
         formData.value.storage_dir !== config.value.storage_dir ||
         formData.value.interval_secs !== config.value.interval_secs ||
         formData.value.proxy !== (config.value.proxy || '')
})

const hasFileChanges = computed(() => {
  if (fileMode.value === 'add') {
    return fileData.add_files.some(f => f.filename.trim() && f.path.trim())
  } else if (fileMode.value === 'remove') {
    return fileData.remove_files.length > 0
  } else if (fileMode.value === 'replace') {
    if (fileData.replace_all) return true
    return fileData.replace_files.some(f => f.filename.trim() && f.path.trim())
  }
  return false
})

// ------------------------
// Methods - Configuration
// ------------------------
const loadConfig = async (): Promise<void> => {
  loading.value = true
  error.value = null

  try {
    const response = await getConfig()
    config.value = response.data

    formData.value = {
      url: response.data.url || '',
      storage_dir: response.data.storage_dir || '',
      interval_secs: response.data.interval_secs || 0,
      proxy: response.data.proxy || ''
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    console.error('Failed to load config:', e)
  } finally {
    loading.value = false
  }
}

const saveConfig = async (): Promise<void> => {
  if (!config.value) return

  saving.value = true

  try {
    await updateConfig({
      url: formData.value.url,
      storage_dir: formData.value.storage_dir,
      interval_secs: formData.value.interval_secs,
      proxy: formData.value.proxy === '' ? null : formData.value.proxy,
    })

    config.value = {
      ...config.value,
      ...formData.value
    }

    lastSaved.value = new Date()
    showSuccess('Configuration saved successfully!')

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e)
    showError(`Failed to save configuration: ${errorMessage}`)
  } finally {
    saving.value = false
  }
}

// ------------------------
// Methods - File Management
// ------------------------
const loadCurrentFiles = async (): Promise<void> => {
  operationStates.loadingFiles = true
  try {
    const response = await listFiles()
    currentFiles.value = response.data
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e)
    showError(`Failed to load files: ${errorMessage}`)
  } finally {
    operationStates.loadingFiles = false
  }
}

const addFileRow = () => {
  fileData.add_files.push({ filename: '', path: '' })
}

const removeFileRow = (index: number) => {
  fileData.add_files.splice(index, 1)
}

const toggleFileSelection = (filename: string) => {
  const index = fileData.remove_files.indexOf(filename)
  if (index === -1) {
    fileData.remove_files.push(filename)
  } else {
    fileData.remove_files.splice(index, 1)
  }
}

const selectAllFiles = () => {
  fileData.remove_files = currentFiles.value.map(f => f.filename)
}

const deselectAllFiles = () => {
  fileData.remove_files = []
}

const addReplaceFileRow = () => {
  fileData.replace_files.push({ filename: '', path: '' })
}

const removeReplaceFileRow = (index: number) => {
  fileData.replace_files.splice(index, 1)
}

const updateFileConfig = async (): Promise<void> => {
  operationStates.updatingFiles = true

  try {
    const requestData: UpdateFilesRequest = {
      add_files: [],
      remove_files: [],
      replace_all: false,
      replace_files: []
    }

    // 根据选择的模式构造请求数据
    if (fileMode.value === 'add') {
      requestData.add_files = fileData.add_files.filter(f => f.filename.trim() && f.path.trim())
    } else if (fileMode.value === 'remove') {
      requestData.remove_files = fileData.remove_files.filter(f => f.trim())
    } else if (fileMode.value === 'replace') {
      requestData.replace_all = fileData.replace_all
      requestData.replace_files = fileData.replace_files.filter(f => f.filename.trim() && f.path.trim())
    }

    const response = await updateFiles(requestData)
    showSuccess(response.data.message || 'File configuration updated successfully!')

    // 刷新文件列表
    await loadCurrentFiles()

    // 重置表单
    if (fileMode.value === 'add') {
      fileData.add_files = [{ filename: '', path: '' }]
    } else if (fileMode.value === 'remove') {
      fileData.remove_files = []
    } else if (fileMode.value === 'replace') {
      if (fileData.replace_all) {
        fileData.replace_files = []
      }
    }

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e)
    showError(`Failed to update file configuration: ${errorMessage}`)
  } finally {
    operationStates.updatingFiles = false
  }
}

// ------------------------
// Methods - Maintenance
// ------------------------
const handleReloadConfig = async (): Promise<void> => {
  operationStates.reloading = true
  try {
    await reloadConfig()
    showSuccess('Configuration reloaded successfully!')
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e)
    showError(`Failed to reload configuration: ${errorMessage}`)
  } finally {
    operationStates.reloading = false
  }
}

const handleCleanUnusedFiles = async (): Promise<void> => {
  if (!confirm('Are you sure you want to clean unused files? This action cannot be undone.')) {
    return
  }

  operationStates.cleaning = true
  try {
    const response = await cleanUnusedFiles()
    const removed = response.data.removed
    if (removed.length > 0) {
      showSuccess(`Removed ${removed.length} unused files: ${removed.join(', ')}`)
    } else {
      showSuccess('No unused files to clean.')
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e)
    showError(`Failed to clean unused files: ${errorMessage}`)
  } finally {
    operationStates.cleaning = false
  }
}

const handleTriggerSync = async (): Promise<void> => {
  operationStates.syncing = true
  try {
    await triggerSync()
    showSuccess('Manual sync triggered successfully!')
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e)
    showError(`Failed to trigger sync: ${errorMessage}`)
  } finally {
    operationStates.syncing = false
  }
}

// ------------------------
// Helper Methods
// ------------------------
const resetForm = (): void => {
  if (config.value) {
    formData.value = {
      url: config.value.url || '',
      storage_dir: config.value.storage_dir || '',
      interval_secs: config.value.interval_secs || 0,
      proxy: config.value.proxy || ''
    }
  }
}

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString

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

const showSuccess = (message: string): void => {
  const alert = document.createElement('div')
  alert.className = 'success-alert'
  alert.innerHTML = `
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
    </svg>
    <span>${message}</span>
  `
  document.body.appendChild(alert)

  setTimeout(() => {
    alert.remove()
  }, 3000)
}

const showError = (message: string): void => {
  const alert = document.createElement('div')
  alert.className = 'error-alert'
  alert.innerHTML = `
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
    </svg>
    <span>${message}</span>
  `
  document.body.appendChild(alert)

  setTimeout(() => {
    alert.remove()
  }, 5000)
}

// ------------------------
// Lifecycle
// ------------------------
onMounted(() => {
  loadConfig()
})

// 监听页面离开提示
window.addEventListener('beforeunload', (e) => {
  if (hasChanges.value) {
    e.preventDefault()
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
  }
})

// 切换到文件标签时加载文件列表
const switchToFilesTab = () => {
  activeTab.value = 'files'
  loadCurrentFiles()
}
</script>

<template>
  <div class="config-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-content">
        <div class="header-title">
          <h1>Configuration & Maintenance</h1>
          <p>Manage your download service settings and perform maintenance operations</p>
        </div>

        <div class="header-controls">
          <div class="last-saved" v-if="lastSaved">
            Last saved: {{ lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
          </div>
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
          <h3>Error loading configuration</h3>
          <p>{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading && !config" class="loading-state">
      <div class="spinner-large"></div>
      <p>Loading configuration...</p>
    </div>

    <!-- Main Content -->
    <div v-else-if="config" class="config-main">
      <!-- Tab Navigation -->
      <div class="tab-navigation">
        <button
          @click="activeTab = 'basic'"
          :class="['tab-btn', { active: activeTab === 'basic' }]"
        >
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Basic Configuration
        </button>
        <button
          @click="switchToFilesTab"
          :class="['tab-btn', { active: activeTab === 'files' }]"
        >
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          File Configuration
        </button>
        <button
          @click="activeTab = 'maintenance'"
          :class="['tab-btn', { active: activeTab === 'maintenance' }]"
        >
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Maintenance
        </button>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Basic Configuration Tab -->
        <div v-if="activeTab === 'basic'" class="config-section">
          <!-- URL Configuration -->
          <div class="config-card">
            <div class="config-card-header">
              <h2 class="config-card-title">
                <svg class="config-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Source URL
              </h2>
              <p class="config-card-description">
                The target URL where files will be downloaded from
              </p>
            </div>

            <div class="config-input-group">
              <label class="config-label">
                <span class="label-text">URL</span>
                <input
                  v-model="formData.url"
                  type="url"
                  class="config-input"
                  placeholder="https://example.com/files"
                  required
                />
                <div class="input-help">
                  Enter the complete URL of the source
                </div>
              </label>
            </div>
          </div>

          <!-- Storage Configuration -->
          <div class="config-card">
            <div class="config-card-header">
              <h2 class="config-card-title">
                <svg class="config-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
                Storage Settings
              </h2>
              <p class="config-card-description">
                Configure where and how downloaded files are stored
              </p>
            </div>

            <div class="config-input-group">
              <label class="config-label">
                <span class="label-text">Storage Directory</span>
                <input
                  v-model="formData.storage_dir"
                  class="config-input"
                  placeholder="/path/to/storage"
                  required
                />
                <div class="input-help">
                  Path on the server where files will be saved
                </div>
              </label>
            </div>
          </div>

          <!-- Performance Configuration -->
          <div class="config-card">
            <div class="config-card-header">
              <h2 class="config-card-title">
                <svg class="config-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Performance Settings
              </h2>
              <p class="config-card-description">
                Configure timing and intervals for the download service
              </p>
            </div>

            <div class="config-input-group">
              <label class="config-label">
                <span class="label-text">Check Interval (seconds)</span>
                <input
                  v-model.number="formData.interval_secs"
                  type="number"
                  min="1"
                  max="3600"
                  class="config-input"
                  placeholder="60"
                  required
                />
                <div class="input-help">
                  How often to check for new files (1-3600 seconds)
                </div>
              </label>
            </div>
          </div>

          <!-- Network Configuration -->
          <div class="config-card">
            <div class="config-card-header">
              <h2 class="config-card-title">
                <svg class="config-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Network Settings
              </h2>
              <p class="config-card-description">
                Configure network and proxy settings for downloads
              </p>
            </div>

            <div class="config-input-group">
              <label class="config-label">
                <span class="label-text">Proxy Server</span>
                <input
                  v-model="formData.proxy"
                  class="config-input"
                  placeholder="http://proxy.example.com:8080"
                />
                <div class="input-help">
                  Leave empty to disable proxy. Format: http://proxy:port
                </div>
              </label>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="action-buttons">
            <button
              @click="resetForm"
              :disabled="!hasChanges || saving"
              class="btn btn-secondary"
            >
              Reset Changes
            </button>

            <button
              @click="saveConfig"
              :disabled="!hasChanges || !isValid || saving"
              class="btn btn-primary"
            >
              <span v-if="saving" class="spinner-small"></span>
              <span v-else>Save Configuration</span>
            </button>
          </div>

          <!-- Current Configuration Summary -->
          <div class="config-summary">
            <h3 class="summary-title">Current Configuration</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <span class="summary-label">URL:</span>
                <span class="summary-value">{{ config.url }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Storage Directory:</span>
                <span class="summary-value">{{ config.storage_dir }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Check Interval:</span>
                <span class="summary-value">{{ config.interval_secs }} seconds</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Proxy:</span>
                <span class="summary-value">{{ config.proxy || 'Not configured' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- File Configuration Tab -->
        <div v-if="activeTab === 'files'" class="file-config-section">
          <!-- Current Files List -->
          <div class="current-files-section">
            <div class="section-header">
              <h2>Current Files</h2>
              <button
                @click="loadCurrentFiles"
                :disabled="operationStates.loadingFiles"
                class="refresh-files-btn"
              >
                <span v-if="operationStates.loadingFiles" class="spinner-tiny"></span>
                <svg v-else class="refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>

            <div v-if="operationStates.loadingFiles && currentFiles.length === 0" class="loading-files">
              <div class="spinner-small"></div>
              <p>Loading files...</p>
            </div>

            <div v-else-if="currentFiles.length === 0" class="no-files">
              <div class="no-files-icon">📁</div>
              <h3>No files configured</h3>
              <p>Add files using the form below to get started.</p>
            </div>

            <div v-else class="files-table-container">
              <table class="current-files-table">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>URL</th>
                    <th>Last Modified</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="file in currentFiles" :key="file.filename">
                    <td class="filename-cell">
                      <div class="filename-content">
                        <div class="file-icon">📄</div>
                        <span>{{ file.filename }}</span>
                      </div>
                    </td>
                    <td class="url-cell">
                      <div class="url-content">
                        <span class="url-text">{{ file.url }}</span>
                        <button
                          @click="navigator.clipboard.writeText(file.url).then(() => showSuccess('URL copied!'))"
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
                      {{ formatDate(file.last_modified) }}
                    </td>
                    <td class="actions-cell">
                      <button
                        @click="fileMode = 'remove'; toggleFileSelection(file.filename)"
                        class="remove-action-btn"
                        :class="{ 'selected': fileData.remove_files.includes(file.filename) }"
                        :title="fileData.remove_files.includes(file.filename) ? 'Deselect for removal' : 'Select for removal'"
                      >
                        <svg v-if="fileData.remove_files.includes(file.filename)" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        <svg v-else viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                        {{ fileData.remove_files.includes(file.filename) ? 'Selected' : 'Remove' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div class="files-count">
                Showing {{ currentFiles.length }} files
              </div>
            </div>
          </div>

          <!-- Mode Selection -->
          <div class="mode-selection">
            <div class="mode-options">
              <button
                @click="fileMode = 'add'"
                :class="['mode-btn', { active: fileMode === 'add' }]"
              >
                <svg class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Files
              </button>
              <button
                @click="fileMode = 'remove'"
                :class="['mode-btn', { active: fileMode === 'remove' }]"
              >
                <svg class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Remove Files ({{ fileData.remove_files.length }} selected)
              </button>
              <button
                @click="fileMode = 'replace'"
                :class="['mode-btn', { active: fileMode === 'replace' }]"
              >
                <svg class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Replace Files
              </button>
            </div>
          </div>

          <!-- Add Files Mode -->
          <div v-if="fileMode === 'add'" class="mode-content">
            <div class="config-card">
              <div class="config-card-header">
                <h2 class="config-card-title">
                  <svg class="config-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add New Files
                </h2>
                <p class="config-card-description">
                  Add new files to the download list. Files will be downloaded from the source URL.
                </p>
              </div>

              <div class="files-list">
                <div v-for="(file, index) in fileData.add_files" :key="index" class="file-row">
                  <div class="file-inputs">
                    <div class="input-group">
                      <label class="input-label">Filename</label>
                      <input
                        v-model="fileData.add_files[index].filename"
                        type="text"
                        class="file-input"
                        placeholder="example.txt"
                      />
                    </div>
                    <div class="input-group">
                      <label class="input-label">Path (relative to source URL)</label>
                      <input
                        v-model="fileData.add_files[index].path"
                        type="text"
                        class="file-input"
                        placeholder="/path/to/file"
                      />
                    </div>
                  </div>
                  <button
                    @click="removeFileRow(index)"
                    :disabled="fileData.add_files.length <= 1"
                    class="remove-file-btn"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>

                <button @click="addFileRow" class="add-row-btn">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 3a1 1 0 00-1 1v5H4a1 1 0 100 2h5v5a1 1 0 102 0v-5h5a1 1 0 100-2h-5V4a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  Add Another File
                </button>
              </div>
            </div>
          </div>

          <!-- Remove Files Mode -->
          <div v-if="fileMode === 'remove'" class="mode-content">
            <div class="config-card">
              <div class="config-card-header">
                <h2 class="config-card-title">
                  <svg class="config-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove Files
                </h2>
                <p class="config-card-description">
                  Select files to remove from the download list. This will stop downloading these files.
                </p>
              </div>

              <div class="selected-files-info" v-if="fileData.remove_files.length > 0">
                <div class="selection-header">
                  <h3>{{ fileData.remove_files.length }} files selected for removal</h3>
                  <button @click="deselectAllFiles" class="clear-selection-btn">
                    Clear Selection
                  </button>
                </div>

                <div class="selected-files-list">
                  <div v-for="filename in fileData.remove_files" :key="filename" class="selected-file">
                    <span>{{ filename }}</span>
                    <button
                      @click="toggleFileSelection(filename)"
                      class="remove-selected-btn"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="selection-actions">
                  <button
                    @click="selectAllFiles"
                    class="select-all-btn"
                    :disabled="fileData.remove_files.length === currentFiles.length"
                  >
                    Select All {{ currentFiles.length }} Files
                  </button>
                </div>
              </div>

              <div v-else class="no-selection">
                <div class="no-selection-icon">👆</div>
                <h3>No files selected</h3>
                <p>Click the "Remove" button next to files in the list above, or select "Select All" to remove all files.</p>
              </div>
            </div>
          </div>

          <!-- Replace Files Mode -->
          <div v-if="fileMode === 'replace'" class="mode-content">
            <div class="config-card">
              <div class="config-card-header">
                <h2 class="config-card-title">
                  <svg class="config-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Replace Files
                </h2>
                <p class="config-card-description">
                  Replace all or specific files in the download list
                </p>
              </div>

              <div class="replace-options">
                <label class="checkbox-label">
                  <input
                    v-model="fileData.replace_all"
                    type="checkbox"
                    class="checkbox"
                  />
                  <span>Replace all files (clear existing list and add new files)</span>
                </label>
              </div>

              <div v-if="!fileData.replace_all" class="files-list">
                <div v-for="(file, index) in fileData.replace_files" :key="index" class="file-row">
                  <div class="file-inputs">
                    <div class="input-group">
                      <label class="input-label">Filename</label>
                      <input
                        v-model="fileData.replace_files[index].filename"
                        type="text"
                        class="file-input"
                        placeholder="example.txt"
                      />
                    </div>
                    <div class="input-group">
                      <label class="input-label">Path (relative to source URL)</label>
                      <input
                        v-model="fileData.replace_files[index].path"
                        type="text"
                        class="file-input"
                        placeholder="/path/to/file"
                      />
                    </div>
                  </div>
                  <button
                    @click="removeReplaceFileRow(index)"
                    class="remove-file-btn"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>

                <button @click="addReplaceFileRow" class="add-row-btn">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 3a1 1 0 00-1 1v5H4a1 1 0 100 2h5v5a1 1 0 102 0v-5h5a1 1 0 100-2h-5V4a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  Add Replacement File
                </button>
              </div>

              <div v-else class="replace-all-notice">
                <div class="notice-content">
                  <svg class="notice-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                  <div>
                    <h3>Replace All Files</h3>
                    <p>When enabled, all existing files will be removed and replaced with the new files you specify below.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Update Button -->
          <div class="action-buttons">
            <button
              @click="updateFileConfig"
              :disabled="!hasFileChanges || operationStates.updatingFiles"
              class="btn btn-primary"
            >
              <span v-if="operationStates.updatingFiles" class="spinner-small"></span>
              <span v-else>
                {{ fileMode === 'add' ? 'Add Files' : fileMode === 'remove' ? 'Remove Selected Files' : 'Replace Files' }}
              </span>
            </button>
          </div>
        </div>

        <!-- Maintenance Tab -->
        <div v-if="activeTab === 'maintenance'" class="maintenance-section">
          <!-- Maintenance Cards -->
          <div class="maintenance-grid">
            <!-- Reload Config Card -->
            <div class="maintenance-card">
              <div class="card-icon reload-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 class="card-title">Reload Configuration</h3>
              <p class="card-description">
                Reload the configuration file without restarting the service. Useful when you've manually edited the config file.
              </p>
              <button
                @click="handleReloadConfig"
                :disabled="operationStates.reloading"
                class="maintenance-btn"
              >
                <span v-if="operationStates.reloading" class="spinner-small"></span>
                <span v-else>Reload Config</span>
              </button>
            </div>

            <!-- Clean Files Card -->
            <div class="maintenance-card">
              <div class="card-icon clean-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 class="card-title">Clean Unused Files</h3>
              <p class="card-description">
                Remove files from storage that are no longer referenced in the configuration. This action cannot be undone.
              </p>
              <button
                @click="handleCleanUnusedFiles"
                :disabled="operationStates.cleaning"
                class="maintenance-btn warning"
              >
                <span v-if="operationStates.cleaning" class="spinner-small"></span>
                <span v-else>Clean Unused Files</span>
              </button>
            </div>

            <!-- Trigger Sync Card -->
            <div class="maintenance-card">
              <div class="card-icon sync-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 class="card-title">Trigger Manual Sync</h3>
              <p class="card-description">
                Immediately trigger a synchronization with the source URL. This bypasses the normal interval.
              </p>
              <button
                @click="handleTriggerSync"
                :disabled="operationStates.syncing"
                class="maintenance-btn"
              >
                <span v-if="operationStates.syncing" class="spinner-small"></span>
                <span v-else>Trigger Sync</span>
              </button>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="quick-actions">
            <h3 class="quick-actions-title">Quick Actions</h3>
            <div class="action-buttons-row">
              <button
                @click="handleReloadConfig"
                :disabled="operationStates.reloading"
                class="quick-action-btn"
              >
                <span v-if="operationStates.reloading" class="spinner-tiny"></span>
                <span v-else>Reload</span>
              </button>
              <button
                @click="handleCleanUnusedFiles"
                :disabled="operationStates.cleaning"
                class="quick-action-btn warning"
              >
                <span v-if="operationStates.cleaning" class="spinner-tiny"></span>
                <span v-else>Clean Files</span>
              </button>
              <button
                @click="handleTriggerSync"
                :disabled="operationStates.syncing"
                class="quick-action-btn"
              >
                <span v-if="operationStates.syncing" class="spinner-tiny"></span>
                <span v-else>Sync Now</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 基础布局 */
.config-dashboard {
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

.last-saved {
  font-size: 14px;
  color: #64748b;
  padding: 8px 16px;
  background: #f1f5f9;
  border-radius: 8px;
}

/* Error Alert */
.error-alert {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
  animation: slideIn 0.3s ease-out;
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
  color: #b91c1b;
  margin: 0;
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

/* Main Content */
.config-main {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

/* Tab Navigation */
.tab-navigation {
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 0 24px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: #475569;
  background: #f1f5f9;
}

.tab-btn.active {
  color: #3b82f6;
  font-weight: 600;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: #3b82f6;
}

.tab-icon {
  width: 18px;
  height: 18px;
}

/* Tab Content */
.tab-content {
  padding: 24px;
}

/* Configuration Section (existing styles kept) */
.config-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.config-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.config-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.config-card-header {
  margin-bottom: 24px;
}

.config-card-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 8px 0;
}

.config-card-icon {
  width: 24px;
  height: 24px;
  color: #3b82f6;
}

.config-card-description {
  font-size: 14px;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

/* Configuration Inputs */
.config-input-group {
  margin-bottom: 16px;
}

.config-label {
  display: block;
}

.label-text {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #475569;
  margin-bottom: 8px;
}

.config-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
  color: #1e293b;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.config-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.config-input::placeholder {
  color: #94a3b8;
}

.config-input:disabled {
  background: #f8fafc;
  border-color: #e2e8f0;
  cursor: not-allowed;
}

.input-help {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 24px;
}

.btn {
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
}

.btn-secondary:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(226, 232, 240, 0.5);
}

/* Configuration Summary */
.config-summary {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  margin-top: 20px;
}

.summary-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 16px 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 12px;
}

@media (min-width: 768px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.summary-item {
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.summary-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  margin-bottom: 4px;
}

.summary-value {
  display: block;
  font-size: 14px;
  color: #1e293b;
  font-family: 'SF Mono', Monaco, 'Cascadia Mono', monospace;
  word-break: break-all;
}

/* File Configuration */
.file-config-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Current Files Section */
.current-files-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
}

.current-files-section .section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.current-files-section h2 {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.refresh-files-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-files-btn:hover:not(:disabled) {
  background: #e2e8f0;
}

.refresh-files-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-icon {
  width: 16px;
  height: 16px;
}

.loading-files {
  padding: 40px;
  text-align: center;
}

.loading-files .spinner-small {
  width: 24px;
  height: 24px;
  border: 3px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  margin: 0 auto 16px;
  animation: spin 1s linear infinite;
}

.loading-files p {
  color: #64748b;
  font-size: 14px;
  margin: 0;
}

.no-files {
  padding: 40px;
  text-align: center;
}

.no-files-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-files h3 {
  font-size: 18px;
  font-weight: 600;
  color: #475569;
  margin: 0 0 8px 0;
}

.no-files p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
  max-width: 300px;
  margin: 0 auto;
}

.files-table-container {
  overflow-x: auto;
}

.current-files-table {
  width: 100%;
  border-collapse: collapse;
}

.current-files-table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}

.current-files-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
}

.current-files-table tr:hover {
  background: #f8fafc;
}

.filename-cell .filename-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-icon {
  font-size: 16px;
  opacity: 0.7;
}

.url-cell .url-content {
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
  padding: 4px 8px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.copy-btn:hover {
  background: #e2e8f0;
}

.copy-icon {
  width: 14px;
  height: 14px;
  color: #64748b;
}

.date-cell {
  font-size: 14px;
  color: #64748b;
  white-space: nowrap;
}

.actions-cell {
  text-align: right;
}

.remove-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #dc2626;
  cursor: pointer;
  transition: all 0.2s ease;
}

.remove-action-btn:hover {
  background: #fecaca;
}

.remove-action-btn.selected {
  background: #dcfce7;
  border-color: #bbf7d0;
  color: #166534;
}

.remove-action-btn svg {
  width: 14px;
  height: 14px;
}

.files-count {
  padding: 12px 16px;
  font-size: 14px;
  color: #64748b;
  text-align: center;
  border-top: 1px solid #f1f5f9;
}

/* Mode Selection */
.mode-selection {
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #e2e8f0;
}

.mode-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-btn:hover {
  background: #f1f5f9;
}

.mode-btn.active {
  background: #dbeafe;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.mode-icon {
  width: 18px;
  height: 18px;
}

.mode-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Selected Files Info */
.selected-files-info {
  background: #f8fafc;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e2e8f0;
}

.selection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.selection-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.clear-selection-btn {
  padding: 6px 12px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-selection-btn:hover {
  background: #e2e8f0;
}

.selected-files-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.selected-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  color: #475569;
}

.remove-selected-btn {
  padding: 2px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 4px;
  color: #dc2626;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-selected-btn:hover {
  background: #fecaca;
}

.remove-selected-btn svg {
  width: 12px;
  height: 12px;
}

.selection-actions {
  display: flex;
  justify-content: flex-end;
}

.select-all-btn {
  padding: 8px 16px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;
}

.select-all-btn:hover:not(:disabled) {
  background: #e2e8f0;
}

.select-all-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.no-selection {
  padding: 40px;
  text-align: center;
  background: #f8fafc;
  border-radius: 8px;
  border: 2px dashed #e2e8f0;
}

.no-selection-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-selection h3 {
  font-size: 18px;
  font-weight: 600;
  color: #475569;
  margin: 0 0 8px 0;
}

.no-selection p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
  max-width: 300px;
  margin: 0 auto;
  line-height: 1.5;
}

/* Files List */
.files-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.file-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.file-inputs {
  flex: 1;
  display: flex;
  gap: 16px;
}

.input-group {
  flex: 1;
}

.full-width {
  flex: 1 0 100%;
}

.input-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  margin-bottom: 4px;
}

.file-input {
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  color: #1e293b;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  transition: border-color 0.2s ease;
}

.file-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.remove-file-btn {
  padding: 10px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-file-btn:hover:not(:disabled) {
  background: #fecaca;
}

.remove-file-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.remove-file-btn svg {
  width: 16px;
  height: 16px;
}

.add-row-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: #f1f5f9;
  border: 2px dashed #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-row-btn:hover {
  background: #e2e8f0;
  border-color: #cbd5e1;
}

.add-row-btn svg {
  width: 16px;
  height: 16px;
}

.replace-options {
  margin-bottom: 20px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox {
  width: 16px;
  height: 16px;
  border: 2px solid #cbd5e1;
  border-radius: 4px;
  cursor: pointer;
}

.checkbox:checked {
  background-color: #3b82f6;
  border-color: #3b82f6;
}

.replace-all-notice {
  padding: 16px;
  background: #f0f9ff;
  border-radius: 8px;
  border: 1px solid #bae6fd;
}

.notice-content {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.notice-icon {
  width: 20px;
  height: 20px;
  color: #0ea5e9;
  flex-shrink: 0;
  margin-top: 2px;
}

.replace-all-notice h3 {
  font-size: 14px;
  font-weight: 600;
  color: #0369a1;
  margin: 0 0 4px 0;
}

.replace-all-notice p {
  font-size: 14px;
  color: #0ea5e9;
  margin: 0;
  line-height: 1.5;
}

/* Maintenance Section */
.maintenance-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.maintenance-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 20px;
}

@media (min-width: 768px) {
  .maintenance-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.maintenance-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.maintenance-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.reload-icon {
  background: #dbeafe;
  color: #1d4ed8;
}

.clean-icon {
  background: #fee2e2;
  color: #dc2626;
}

.sync-icon {
  background: #dcfce7;
  color: #16a34a;
}

.card-icon svg {
  width: 24px;
  height: 24px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 8px 0;
}

.card-description {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 20px 0;
  line-height: 1.5;
}

.maintenance-btn {
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
}

.maintenance-btn:hover:not(:disabled) {
  background: #2563eb;
}

.maintenance-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.maintenance-btn.warning {
  background: #ef4444;
}

.maintenance-btn.warning:hover:not(:disabled) {
  background: #dc2626;
}

.quick-actions {
  background: #f8fafc;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #e2e8f0;
}

.quick-actions-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 16px 0;
  text-align: center;
}

.action-buttons-row {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.quick-action-btn {
  padding: 8px 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 100px;
}

.quick-action-btn:hover:not(:disabled) {
  background: #f1f5f9;
}

.quick-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.quick-action-btn.warning {
  background: #fee2e2;
  border-color: #fecaca;
  color: #dc2626;
}

.quick-action-btn.warning:hover:not(:disabled) {
  background: #fecaca;
}

/* Spinners */
.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 8px;
}

.spinner-tiny {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 6px;
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

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

<style>
/* 全局提示样式 */
.success-alert,
.error-alert {
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
}

.success-alert {
  background: #dcfce7;
  border: 1px solid #bbf7d0;
  color: #166534;
}

.error-alert {
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.success-alert svg,
.error-alert svg {
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