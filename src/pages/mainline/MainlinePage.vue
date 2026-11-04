<template>
  <div class="mainline-radar">
    <iframe
      class="mainline-radar__frame"
      src="/radar/index.html"
      title="主线雷达 · A股市场主线分析"
    />
  </div>
</template>

<style scoped>
.mainline-radar {
  position: relative;
  width: 100%;
  height: 100%;
  background: #080907;
}

.mainline-radar__frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
