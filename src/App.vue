<template>
  <div class="layout">
    <aside class="sidebar">
      <h2>relayfetch</h2>
      <RouterLink to="/">Dashboard</RouterLink>
      <RouterLink to="/config">Config</RouterLink>
      <RouterLink to="/files">Files</RouterLink>
    </aside>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 200px;
  padding: 1rem;
  background: #1e1e1e;
  color: white;
}

.sidebar a {
  display: block;
  color: #ccc;
  margin: 0.5rem 0;
}

.sidebar a.router-link-active {
  color: white;
  font-weight: bold;
}

.content {
  flex: 1;
  padding: 1.5rem;
  overflow: auto;
}
</style>
