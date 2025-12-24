// ======================
// 通用响应
// ======================
export interface MessageResponse {
  message: string
}

// ======================
// Status
// ======================
export interface FileProgressResponse {
  file: string
  downloaded: number
  total: number
  done: boolean
  error: string | null
}

export type SyncResult =
  | 'Pending'
  | 'Success'
  | 'PartialSuccess'
  | 'Failed'

export interface StatusResponse {
  is_running: boolean
  total_files: number
  finished_files: number
  failed_files: number
  stored_files: number
  start_time: number | null
  last_sync: number | null
  last_ok_sync: number | null
  last_result: SyncResult
  error_message: string | null
  files: Record<string, FileProgressResponse>
  storage_dir: string
}

// ======================
// Config
// ======================
export interface GetConfigResponse {
  storage_dir: string
  bind: string
  grpc_admin: string
  http_admin: string
  proxy: string | null
  url: string
  interval_secs: number
  download_concurrency: number
  download_retry: number
  retry_base_delay_ms: number
}

// ======================
// Files
// ======================
export interface FileInfo {
  filename: string
  url: string
  last_modified: string
}

export interface FileItem {
  filename: string
  path: string
}

export interface UpdateFilesRequest {
  add_files: FileItem[]
  remove_files: string[]
  replace_all: boolean
  replace_files: FileItem[]
}

export interface UpdateFilesResponse {
  message: string
}
