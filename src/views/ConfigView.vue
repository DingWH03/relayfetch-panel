<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getConfig, updateConfig } from '@/api/relayfetch'
import type { GetConfigResponse } from '@/api/types'

// ------------------------
// State
// ------------------------
const config = ref<GetConfigResponse | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const saving = ref(false)
const lastSaved = ref<Date | null>(null)

// 用于临时存储修改，避免直接修改原始数据
const formData = ref({
  url: '',
  storage_dir: '',
  interval_secs: 0,
  proxy: ''
})

// ------------------------
// Methods
// ------------------------
const loadConfig = async (): Promise<void> => {
  loading.value = true
  error.value = null

  try {
    const response = await getConfig()
    config.value = response.data

    // 初始化表单数据
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

    // 更新本地配置
    config.value = {
      ...config.value,
      ...formData.value
    }

    lastSaved.value = new Date()

    // 显示成功提示
    showSuccess('Configuration saved successfully!')

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e)
    showError(`Failed to save configuration: ${errorMessage}`)
  } finally {
    saving.value = false
  }
}

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

const showSuccess = (message: string): void => {
  // 创建并显示成功提示
  const alert = document.createElement('div')
  alert.className = 'success-alert'
  alert.innerHTML = `
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
    </svg>
    <span>${message}</span>
  `
  document.body.appendChild(alert)

  // 3秒后移除
  setTimeout(() => {
    alert.remove()
  }, 3000)
}

const showError = (message: string): void => {
  // 创建并显示错误提示
  const alert = document.createElement('div')
  alert.className = 'error-alert'
  alert.innerHTML = `
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
    </svg>
    <span>${message}</span>
  `
  document.body.appendChild(alert)

  // 5秒后移除
  setTimeout(() => {
    alert.remove()
  }, 5000)
}

// 验证表单
const isValid = (): boolean => {
  return formData.value.url.trim() !== '' &&
         formData.value.storage_dir.trim() !== '' &&
         formData.value.interval_secs > 0
}

// 检查是否有未保存的更改
const hasChanges = (): boolean => {
  if (!config.value) return false

  return formData.value.url !== config.value.url ||
         formData.value.storage_dir !== config.value.storage_dir ||
         formData.value.interval_secs !== config.value.interval_secs ||
         formData.value.proxy !== (config.value.proxy || '')
}

// ------------------------
// Lifecycle
// ------------------------
onMounted(() => {
  loadConfig()
})

// 监听页面离开提示
window.addEventListener('beforeunload', (e) => {
  if (hasChanges()) {
    e.preventDefault()
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
  }
})
</script>

<template>
  <div class="config-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-content">
        <div class="header-title">
          <h1>Configuration</h1>
          <p>Manage your download service settings</p>
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

    <!-- Configuration Form -->
    <div v-else-if="config" class="config-section">
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
          :disabled="!hasChanges() || saving"
          class="btn btn-secondary"
        >
          Reset Changes
        </button>

        <button
          @click="saveConfig"
          :disabled="!hasChanges() || !isValid() || saving"
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
  color: #b91c1c;
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

/* Configuration Section */
.config-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Configuration Cards */
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
  margin-top: 8px;
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

/* Spinner */
.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 8px;
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