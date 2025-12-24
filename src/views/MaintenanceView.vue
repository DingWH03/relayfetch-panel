<script setup lang="ts">
import { reloadConfig, cleanUnusedFiles } from '@/api/relayfetch'

const reload = async () => {
  await reloadConfig()
  alert('Config reloaded')
}

const clean = async () => {
  const res = await cleanUnusedFiles()
  alert(`Removed: ${res.data.removed.join(', ')}`)
}
</script>

<template>
  <div>
    <h1>Maintenance</h1>
    <button @click="reload">Reload Config</button>
    <button @click="clean">Clean Unused Files</button>
  </div>
</template>
