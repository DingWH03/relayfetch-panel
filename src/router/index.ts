import { createRouter, createWebHistory } from 'vue-router'

import DashboardView from '@/views/DashboardView.vue'
import ConfigView from '@/views/ConfigView.vue'
import FilesView from '@/views/FilesView.vue'
import SyncView from '@/views/SyncView.vue'
import MaintenanceView from '@/views/MaintenanceView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: DashboardView },
    { path: '/config', component: ConfigView },
    { path: '/files', component: FilesView },
    { path: '/sync', component: SyncView },
    { path: '/maintenance', component: MaintenanceView },
  ],
})
