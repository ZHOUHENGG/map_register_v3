<script lang="ts" setup>
defineProps<{
  item: API.ItemVo
  iconMap: Record<string, API.TagVo>
}>()
</script>

<template>
  <div
    v-bind="$attrs"
    :title="item.name"
    class="item-selecter-button"
  >
    <slot name="prepend" />

    <img :src="iconMap[item.iconTag ?? '']?.url" crossorigin="" loading="lazy" class="w-8 h-8 object-contain">

    <span class="flex-1 overflow-hidden whitespace-nowrap text-ellipsis">{{ item.name }}</span>

    <slot name="append" />
  </div>
</template>

<style lang="scss" scoped>
.item-selecter-button {
  height: 40px;
  padding: 4px 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 4px;
  user-select: none;
  content-visibility: auto;

  &:hover {
    background-color: var(--el-color-info-light-9);
  }
  &:active {
    background-color: var(--el-color-info-light-8);
  }
}
</style>
