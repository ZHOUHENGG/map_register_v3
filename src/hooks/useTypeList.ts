import type { FetchHookOptions } from '@/hooks'
import { useFetchHook } from '@/hooks'
import { array2Tree } from '@/utils'
import Api from '@/api/api'

/** 物品类型列表与相关操作方法 */
export const useTypeList = (options: FetchHookOptions<API.RPageListVoItemTypeVo> = {}) => {
  const { immediate = true, loading = ref(false) } = options

  const typeList = ref<API.ItemTypeVo[]>([])

  const typeTree = computed(() => array2Tree(typeList.value, {
    idKey: 'typeId',
    pidKey: 'parentId',
    rootId: -1,
  }))

  const { refresh: updateTypeList, onSuccess, ...rest } = useFetchHook({
    immediate,
    loading,
    onRequest: () => Api.itemType.listItemType({}),
  })

  onSuccess(({ data = [] }) => {
    typeList.value = data
    console.log(typeTree)
  })

  return { typeList, typeTree, updateTypeList, onSuccess, ...rest }
}
