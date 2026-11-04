<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="not-found">
    <p class="not-found__code mono">404</p>
    <h1 class="not-found__title">该标的未上市</h1>
    <p class="not-found__body">这个代码不在当前盘面的样本里。</p>
    <RouterLink class="not-found__link" to="/">返回行情台</RouterLink>
  </main>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  padding: 24px;
  text-align: center;
}

.not-found__code {
  font-size: 11px;
  letter-spacing: 0.4em;
  color: var(--accent-gold);
}

.not-found__title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-strong);
}

.not-found__body {
  font-size: 13px;
  color: var(--text-muted);
}

.not-found__link {
  margin-top: 8px;
  padding: 9px 18px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-gold);
  background: rgba(232, 179, 57, 0.1);
  transition: background 0.18s ease;
}

.not-found__link:hover {
  background: rgba(232, 179, 57, 0.2);
}
</style>
