<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <main class="app-main">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<style>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-main {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.page-enter-active,
.page-leave-active {
  transition:
    opacity 0.32s ease,
    transform 0.32s ease;
}

.page-enter-from {
  opacity: 0;
  transform: scale(0.994);
}

.page-leave-to {
  opacity: 0;
}
</style>
