<script setup lang="ts">
import type { SpanRow } from '../../../data/diagrams'

defineProps<{
  spans: SpanRow[]
  note?: string
}>()
</script>

<template>
  <div class="dg-tree">
    <div
      v-for="(s, i) in spans"
      :key="i"
      class="dg-tree__row"
      :class="`dg-tone-${s.tone ?? 'accent'}`"
    >
      <div class="dg-tree__label" :style="{ paddingLeft: `${s.lvl * 16}px` }">
        <span class="dg-tree__name">{{ s.t }}</span>
        <span v-if="s.s" class="dg-tree__attr">{{ s.s }}</span>
      </div>
      <div class="dg-tree__track">
        <span class="dg-tree__bar" :style="{ width: `${s.w}%` }"></span>
      </div>
      <span class="dg-tree__dur">{{ s.dur }}</span>
    </div>
    <div v-if="note" class="dg-tree__note">{{ note }}</div>
  </div>
</template>
