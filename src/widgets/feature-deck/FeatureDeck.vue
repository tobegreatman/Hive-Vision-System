<script setup lang="ts">
import { RouterLink } from 'vue-router'

interface Portal {
  to: string
  index: string
  label: string
  caption: string
  tone: 'gold' | 'red' | 'green'
}

/** 功能入口不是菜单栏，而是盘面底部的三枚「控制台接口」。 */
const PORTALS: readonly Portal[] = [
  { to: '/flow', index: '01', label: '行业资金流', caption: 'CAPITAL FLOW', tone: 'gold' },
  { to: '/mainline', index: '02', label: '市场主线分析', caption: 'MAINLINE', tone: 'red' },
  { to: '/stock', index: '03', label: '个股分析', caption: 'STOCK', tone: 'green' },
]
</script>

<template>
  <section class="feature-deck" aria-label="功能入口">
    <header class="feature-deck__head">
      <span class="feature-deck__eyebrow mono">EXPLORE THE HIVE</span>
      <span class="feature-deck__rule" aria-hidden="true" />
      <span class="feature-deck__hint">进入分析工作台</span>
    </header>

    <nav class="feature-deck__rail">
      <RouterLink
        v-for="portal in PORTALS"
        :key="portal.to"
        :to="portal.to"
        class="portal"
        :class="`portal--${portal.tone}`"
      >
        <span class="portal__node" aria-hidden="true">
          <span class="portal__hex" />
          <span class="portal__index mono">{{ portal.index }}</span>
        </span>

        <span class="portal__text">
          <span class="portal__label">{{ portal.label }}</span>
          <span class="portal__caption mono">{{ portal.caption }}</span>
        </span>

        <span class="portal__arrow" aria-hidden="true">→</span>
      </RouterLink>
    </nav>
  </section>
</template>

<style scoped>
.feature-deck {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(760px, calc(100% - 32px));
  padding: 10px 12px 11px;
  border-radius: 20px;
  background:
    linear-gradient(160deg, rgba(12, 24, 44, 0.9), rgba(5, 11, 20, 0.72)),
    rgba(6, 12, 22, 0.7);
  border: 1px solid rgba(96, 196, 255, 0.2);
  backdrop-filter: blur(26px) saturate(150%);
  box-shadow:
    0 30px 60px -36px rgba(0, 0, 0, 0.95),
    0 0 0 1px rgba(242, 194, 92, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 44px -30px rgba(80, 190, 255, 0.9);
}

.feature-deck__head {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 6px;
}

.feature-deck__eyebrow {
  font-size: 8.5px;
  letter-spacing: 0.22em;
  color: var(--accent-gold);
  white-space: nowrap;
}

.feature-deck__rule {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(242, 194, 92, 0.5), rgba(96, 196, 255, 0.2), transparent);
}

.feature-deck__hint {
  font-size: 9px;
  color: var(--text-dim);
  white-space: nowrap;
}

.feature-deck__rail {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.portal {
  --portal-tone: var(--accent-gold);
  --portal-tint: rgba(232, 179, 57, 0.16);
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 13px;
  color: var(--text-strong);
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}

.portal--red {
  --portal-tone: var(--up);
  --portal-tint: rgba(255, 93, 115, 0.16);
}

.portal--green {
  --portal-tone: var(--down);
  --portal-tint: rgba(46, 230, 166, 0.16);
}

.portal:hover {
  background: var(--portal-tint);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--portal-tone) 35%, transparent);
  transform: translateY(-2px);
}

.portal:focus-visible {
  outline: 2px solid var(--portal-tone);
  outline-offset: 1px;
}

.portal__node {
  position: relative;
  display: grid;
  place-items: center;
  width: 30px;
  height: 34px;
  flex-shrink: 0;
}

.portal__hex {
  position: absolute;
  inset: 0;
  background: linear-gradient(160deg, rgba(22, 44, 76, 0.95), var(--portal-tint));
  border: 1px solid var(--portal-tone);
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  opacity: 0.9;
  box-shadow: 0 0 16px -6px var(--portal-tone);
}

.portal__index {
  position: relative;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--portal-tone);
}

.portal__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.portal__label {
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.portal__caption {
  font-size: 7.5px;
  letter-spacing: 0.16em;
  color: var(--text-dim);
}

.portal__arrow {
  margin-left: auto;
  font-size: 13px;
  color: var(--portal-tone);
  transition: transform 0.18s ease;
}

.portal:hover .portal__arrow {
  transform: translateX(3px);
}

@media (max-width: 860px) {
  .feature-deck {
    width: calc(100% - 20px);
    padding: 8px;
  }

  .feature-deck__head {
    display: none;
  }

  .portal {
    gap: 7px;
    padding: 7px 6px;
  }

  .portal__caption {
    display: none;
  }

  .portal__label {
    font-size: 11px;
  }

  .portal__arrow {
    display: none;
  }
}

@media (max-width: 560px) {
  .feature-deck__rail {
    gap: 3px;
  }

  .portal {
    justify-content: center;
    gap: 0;
    padding: 9px 4px;
  }

  .portal__node {
    display: none;
  }

  .portal__label {
    font-size: 10.5px;
    letter-spacing: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .portal {
    transition: none;
  }
}
</style>
