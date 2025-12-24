import axios from 'axios'
import type {
  MessageResponse,
  StatusResponse,
  GetConfigResponse,
  FileInfo,
  UpdateFilesRequest,
  UpdateFilesResponse,
} from './types'
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

export const ping = () =>
  api.get<MessageResponse>('/ping')

export const status = () =>
  api.get<StatusResponse>('/status')

export const triggerSync = () =>
  api.post<MessageResponse>('/trigger_sync')

export const reloadConfig = () =>
  api.post<MessageResponse>('/reload_config')

export const cleanUnusedFiles = () =>
  api.post<{ removed: string[] }>('/clean_unused_files')

export const getConfig = () =>
  api.get<GetConfigResponse>('/get_config')

export const updateConfig = (data: Partial<GetConfigResponse>) =>
  api.post<MessageResponse>('/update_config', data)

export const listFiles = () =>
  api.get<FileInfo[]>('/list_files')

export const updateFiles = (data: UpdateFilesRequest) =>
  api.post<UpdateFilesResponse>('/update_files', data)