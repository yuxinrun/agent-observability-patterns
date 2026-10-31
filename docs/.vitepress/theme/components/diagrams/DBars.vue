<script setup lang="ts">
import { computed } from 'vue'
import type { BarItem } from '../../../data/diagrams'

const props = defineProps<{
  items: BarItem[]
  unit?: string
  note?: string
}>()

const max = computed(() => Math.max(...props.items.map((i) => i.v), 1))
</script>

<template>
  <div class="dg-bars">
    <div
      v-for="(b, i) in items"
      :key="i"
      class="dg-bars__row"
      :class="`dg-tone-${b.tone ?? 'accent'}`"
    >
      <span class="dg-bars__label">{{ b.t }}</span>
      <span class="dg-bars__track">
        <span class="dg-bars__fill" :style="{ width: `${Math.max((b.v / max) * 100, 3)}%` }"></span>
      </span>
      <span class="dg-bars__val">{{ b.v.toLocaleString() }}</span>
      <span v-if="b.s" class="dg-bars__sub">{{ b.s }}</span>
    </div>
    <div v-if="note" class="dg-bars__note">{{ note }}</div>
    <div v-if="unit" class="dg-bars__unit">{{ unit }}</div>
  </div>
</template>
