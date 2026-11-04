<script setup lang="ts">
import type { MarketBoard, MarketExchange } from '@platform/contracts'
import { storeToRefs } from 'pinia'
import { computed, reactive, ref } from 'vue'

import { BOARD_LABEL, useMarketStore } from '@/entities/market-node'
import { formatPct } from '@/shared/lib/format'
import { AppButton } from '@/shared/ui'

const store = useMarketStore()
const { isCreating, error } = storeToRefs(store)

const localError = ref<string | null>(null)

const form = reactive({
  symbol: '',
  name: '',
  price: '',
  changePct: '0',
})

/**
 * 按 A 股代码段推断交易所与板块：
 * 600/601/603/605 沪主板，688 科创板，000/001/002/003 深主板，300/301 创业板，8xx/4xx 北交所。
 */
function inferMarket(symbol: string): { exchange: MarketExchange; board: MarketBoard } | null {
  if (!/^\d{6}$/.test(symbol)) return null
  if (/^(600|601|603|605)/.test(symbol)) return { exchange: 'SH', board: 'main' }
  if (/^68[89]/.test(symbol)) return { exchange: 'SH', board: 'star' }
  if (/^(300|301)/.test(symbol)) return { exchange: 'SZ', board: 'gem' }
  if (/^(000|001|002|003)/.test(symbol)) return { exchange: 'SZ', board: 'main' }
  if (/^(4|8|92)/.test(symbol)) return { exchange: 'BJ', board: 'bse' }
  return null
}

const inferred = computed(() => inferMarket(form.symbol.trim()))
const boardLabel = computed(() => (inferred.value ? BOARD_LABEL[inferred.value.board] : '待识别'))
const canSubmit = computed(() => {
  const price = Number(form.price)
  return (
    inferred.value !== null &&
    form.name.trim().length > 0 &&
    Number.isFinite(price) &&
    price > 0 &&
    !isCreating.value
  )
})

async function submit(): Promise<void> {
  const market = inferred.value
  const price = Number(form.price)
  const changePct = Number(form.changePct)

  if (!market) {
    localError.value = '无法识别的证券代码，请输入 6 位 A 股代码'
    return
  }
  if (form.name.trim().length === 0) {
    localError.value = '请填写证券简称'
    return
  }
  if (!Number.isFinite(price) || price <= 0) {
    localError.value = '现价必须是正数'
    return
  }
  if (!Number.isFinite(changePct) || changePct < -30 || changePct > 30) {
    localError.value = '涨跌幅需在 -30% ~ 30% 之间'
    return
  }

  localError.value = null
  const created = await store.create({
    symbol: form.symbol.trim(),
    name: form.name.trim(),
    exchange: market.exchange,
    board: market.board,
    price,
    changePct,
    heat: 0.5,
  })

  if (created) {
    form.symbol = ''
    form.name = ''
    form.price = ''
    form.changePct = '0'
  }
}

function onSymbolInput(event: Event): void {
  const target = event.target as HTMLInputElement
  form.symbol = target.value.replace(/\D/g, '').slice(0, 6)
}
</script>

<template>
  <form class="watch-form" @submit.prevent="submit">
    <div class="watch-form__row">
      <div class="field">
        <label class="field__label" for="watch-symbol">证券代码</label>
        <input
          id="watch-symbol"
          class="text-input mono"
          type="text"
          inputmode="numeric"
          maxlength="6"
          placeholder="600519"
          autocomplete="off"
          :value="form.symbol"
          @input="onSymbolInput"
        />
      </div>

      <div class="field">
        <label class="field__label" for="watch-name">简称</label>
        <input
          id="watch-name"
          v-model="form.name"
          class="text-input"
          type="text"
          maxlength="16"
          placeholder="贵州茅台"
          autocomplete="off"
        />
      </div>
    </div>

    <div class="watch-form__row">
      <div class="field">
        <label class="field__label" for="watch-price">现价</label>
        <input
          id="watch-price"
          v-model="form.price"
          class="text-input mono"
          type="text"
          inputmode="decimal"
          placeholder="1586.00"
          autocomplete="off"
        />
      </div>

      <div class="field">
        <label class="field__label" for="watch-change">涨跌幅 %</label>
        <input
          id="watch-change"
          v-model="form.changePct"
          class="text-input mono"
          type="text"
          inputmode="decimal"
          placeholder="0.00"
          autocomplete="off"
        />
      </div>
    </div>

    <p class="watch-form__hint mono">
      自动归类：{{ boardLabel }}
      <span v-if="inferred" class="watch-form__preview">
        {{ form.changePct ? formatPct(Number(form.changePct) || 0) : '—' }}
      </span>
    </p>

    <p v-if="localError || error" class="watch-form__error">{{ localError ?? error }}</p>

    <AppButton type="submit" :loading="isCreating" :disabled="!canSubmit">
      {{ isCreating ? '入池中…' : '加入自选盘面' }}
    </AppButton>
  </form>
</template>

<style scoped>
.watch-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.watch-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.watch-form__hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-dim);
}

.watch-form__preview {
  color: var(--text-muted);
}

.watch-form__error {
  font-size: 11.5px;
  color: var(--up);
}
</style>
