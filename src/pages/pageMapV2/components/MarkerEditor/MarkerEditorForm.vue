<script lang="ts" setup>
import type { FormRules } from 'element-plus'
import { cloneDeep } from 'lodash'
import {
  AddonContenEditor,
  AddonEditHistory,
  AddonExtraEditor,
  AddonImageEditor,
  AddonItemSelector,
  AddonRefreshtimeEditor,
} from '.'
import { AppAreaCodeSelecter } from '@/components'
import { useUserStore } from '@/stores'
import type { ElFormType } from '@/shared'
import { HiddenFlagEnum } from '@/shared'
import { isTreasureChestMatched, requireCheck } from '@/utils'

const props = defineProps<{
  modelValue: API.MarkerVo
  initAreaCode?: string
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', v: API.MarkerVo): void
}>()

/** 用户信息 */
const userStore = useUserStore()

/** 表单数据 */
const form = ref<API.MarkerVo & { areaCode: string }>({
  ...cloneDeep(props.modelValue),
  areaCode: props.initAreaCode ?? '',
})
watch(form, () => emits('update:modelValue', form.value), { deep: true })

/** 表单校验规则 */
const rules: FormRules = {
  areaCode: [requireCheck('change', '所属地区')],
  markerTitle: [requireCheck('change', '标题')],
  hiddenFlag: [requireCheck('change', '点位标识')],
  itemList: [
    {
      required: true,
      validator: (_, items: API.MarkerItemLinkVo[] = []) => (form.value.itemList ??= items).length > 0,
      message: '至少需要选择一项物品',
      trigger: 'change',
    },
    {
      validator: (_, items: API.MarkerItemLinkVo[] = []) => items.every(({ count = 0 }) => count > 0),
      message: '物品数量不能为 0',
      trigger: 'change',
    },
    isTreasureChestMatched(),
  ],
  videoPath: [{
    validator: (_, value = '') => {
      form.value.videoPath = value.trim()
      return !form.value.videoPath || /^https:\/\/www.bilibili.com\/video\/BV[a-zA-Z0-9]+/.test(form.value.videoPath)
    },
    message: '视频链接不正确(需要B站链接)',
    trigger: 'blur',
  }],
}

/** 右侧额外面板识别 id */
const addonId = ref('')

/** 表单实例 */
const formRef = ref<ElFormType | null>(null)
/** 图片编辑器实例 */
const imageEditorRef = ref<InstanceType<typeof AddonImageEditor> | null>(null)

const extraPanelRef = ref<HTMLElement | null>(null)
provide('extraPanel', extraPanelRef)

const extraVisible = ref(false)
const onExtraTransitionStart = (ev: TransitionEvent) => {
  if (ev.propertyName === 'width')
    extraVisible.value = false
}
const onExtraTransitionEnd = (ev: TransitionEvent) => {
  if (ev.propertyName === 'width')
    extraVisible.value = true
}

defineExpose({
  validate: async () => await formRef.value?.validate().catch(() => false),
  uploadPicture: async () => await imageEditorRef.value?.uploadPicture(),
})
</script>

<template>
  <div
    class="marker-editor-form grid p-4 h-full rounded-lg"
    :style="{
      '--theme-color': `var(--gs-color-${form.areaCode.split(':')[1]?.toLowerCase() ?? 'unknown'})`,
    }"
  >
    <el-form ref="formRef" :rules="rules" :model="form" class="form-content w-96" label-width="80px">
      <el-form-item label="点位名称" prop="markerTitle">
        <div class="w-full flex justify-between gap-1">
          <el-input v-model="form.markerTitle" />
          <AddonEditHistory v-if="form.id !== undefined" v-model:addon-id="addonId" v-model:marker-vo="form" />
        </div>
      </el-form-item>

      <el-form-item label="所属地区" prop="areaCode">
        <AppAreaCodeSelecter v-model="form.areaCode" style="width: 100%" />
      </el-form-item>

      <el-form-item label="所属物品" prop="itemList">
        <AddonItemSelector v-model="form.itemList" v-model:addon-id="addonId" v-model:area-code="form.areaCode" />
      </el-form-item>

      <el-form-item v-if="form.areaCode" label="点位层级" prop="extra">
        <AddonExtraEditor v-model="form.extra" :area-code="form.areaCode" />
      </el-form-item>

      <el-form-item label="点位描述" prop="content">
        <AddonContenEditor v-model="form.content" v-model:addon-id="addonId" :item-list="form.itemList" />
      </el-form-item>

      <el-form-item label="点位图像" prop="picture">
        <AddonImageEditor
          ref="imageEditorRef"
          v-model="form.picture"
          v-model:addon-id="addonId"
          v-model:creator-id="form.pictureCreatorId"
        />
      </el-form-item>

      <el-form-item label="显示状态" prop="hiddenFlag">
        <el-radio-group v-model="form.hiddenFlag">
          <el-radio-button :label="HiddenFlagEnum.SHOW">
            显示
          </el-radio-button>
          <el-radio-button :label="HiddenFlagEnum.HIDDEN">
            隐藏
          </el-radio-button>
          <el-radio-button v-if="userStore.isAdmin || userStore.isNeigui" :label="HiddenFlagEnum.NEIGUI">
            测试服点位
          </el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="刷新时间" prop="refreshTime">
        <AddonRefreshtimeEditor v-model="form.refreshTime" />
      </el-form-item>

      <el-form-item label="视频链接" prop="videoPath">
        <el-input v-model="form.videoPath" />
      </el-form-item>

      <el-form-item v-if="$slots.footer" label-width="0" style="margin-bottom: 0;">
        <slot name="footer" />
      </el-form-item>
    </el-form>

    <div
      class="addon-panel"
      :class="{ visible: addonId }"
      @transitionstart="onExtraTransitionStart"
      @transitionend="onExtraTransitionEnd"
    >
      <div v-show="extraVisible" ref="extraPanelRef" class="addon-panel-content" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.marker-editor-form {
  --gap: 5px;

  grid-template-columns: 1fr auto;
  box-shadow: 0px 0px 8px var(--theme-color);
  border: 1px solid var(--theme-color);
}

.addon-panel {
  --padding-left: 16px;

  width: 0;
  height: 100%;
  padding-left: 0;
  transition: var(--el-transition-all);
  overflow: hidden;
  position: relative;

  &.visible {
    width: 400px;
    padding-left: var(--padding-left);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 100%;
    translate: calc(var(--padding-left) / 2) 0;
    border-left: 1px solid var(--el-border-color);
  }
}

.addon-panel-content {
  position: absolute;
  top: 0;
  height: 100%;
  width: calc(100% - var(--padding-left));
}
</style>
