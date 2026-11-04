<template>
  <div class="stock-desk">
    <iframe
      class="stock-desk__frame"
      src="/stockframe/index.html"
      title="个股研究复核台 · 个股分析"
    />
  </div>
</template>

<style scoped>
.stock-desk {
  position: relative;
  width: 100%;
  height: 100%;
  background: #f4f6f8;
}

.stock-desk__frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
