<script lang="ts" setup>
import { ElMessage } from 'element-plus'
import { AreaDetailForm } from '.'
import { GlobalDialogController, useFetchHook } from '@/hooks'
import Api from '@/api/api'

const props = defineProps<{
  area: API.AreaVo
  parent?: API.AreaVo
}>()

const emits = defineEmits<{
  success: []
}>()

const formData = ref<API.AreaVo>(props.area)

const { loading, refresh: submit, onSuccess, onError } = useFetchHook({
  onRequest: () => Api.area.updateArea(formData.value),
})

onSuccess(() => {
  ElMessage.success({
    message: '编辑地区信息成功',
    offset: 48,
  })
  GlobalDialogController.close()
  emits('success')
})

onError(err => ElMessage.error({
  message: `编辑地区失败，原因为：${err.message}`,
  offset: 48,
}))

const formRef = ref<InstanceType<typeof AreaDetailForm> | null>(null)
const updateArea = async () => {
  try {
    await formRef.value?.validate()
    await submit()
  }
  catch {
    // validate, no error
  }
}
</script>

<template>
  <div class="p-5">
    <AreaDetailForm ref="formRef" v-model="formData" :parent="parent" />

    <div class="text-end pt-4">
      <el-button type="primary" :loading="loading" @click="updateArea">
        确定
      </el-button>
      <el-button :disabled="loading" @click="GlobalDialogController.close">
        取消
      </el-button>
    </div>
  </div>
</template>
