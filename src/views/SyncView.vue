<script setup lang="ts">
import { triggerSync } from '@/api/relayfetch'

const run = async () => {
  await triggerSync()
  alert('Sync triggered')
}
</script>

<template>
  <div>
    <h1>Sync</h1>
    <button @click="run">Trigger Sync</button>
  </div>
</template>
