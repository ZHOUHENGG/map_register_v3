import { defineStore } from 'pinia'
import type { AxiosRequestConfig } from 'axios'
import { ElNotification } from 'element-plus'
import dayjs from 'dayjs'
import { liveQuery } from 'dexie'
import { Compress, messageFrom } from '@/utils'
import Api from '@/api/api'
import db from '@/database'
import { localSettings } from '@/stores'
import { secondClock } from '@/shared'

const loading = ref(false)
const updateTimer = ref<number>()
const updateEnd = ref<number>()
const total = ref(0)

liveQuery(() => db.iconTag.count()).subscribe((v) => {
  total.value = v
})

/** 本地图标标签数据 */
export const useIconTagStore = defineStore('global-icon-tag', {
  state: () => ({
  }),

  getters: {
    total: () => total.value,
    /** 全量更新处理状态 */
    updateAllLoading: () => loading.value,
    /** 全量更新剩余时间 */
    updateAllRestTime: () => updateEnd.value === undefined ? 0 : updateEnd.value - secondClock.value,
  },

  actions: {
    /** 获取图标标签数据最新的 MD5 */
    async getIconTagMD5() {
      const { data = '' } = await Api.tagDoc.listAllTagBz2Md5()
      return data
    },

    /** 获取解析后的图标标签数据 */
    async getIconTagData() {
      const data = await Api.tagDoc.listAllTagBz2({
        responseType: 'arraybuffer',
      } as AxiosRequestConfig) as unknown as ArrayBuffer
      const depressedData = await Compress.decompress(new Uint8Array(data), 60000)
      const stringData = new TextDecoder('utf-8').decode(depressedData.buffer)
      const parseredData = JSON.parse(stringData) as API.TagVo[]
      return parseredData
    },

    /** 更新图标标签数据 */
    async updateIconTag() {
      // 检查 MD5 是否有变化，如无则跳过更新
      const newMD5 = await this.getIconTagMD5()
      const oldMD5 = (await db.md5.get('iconTag-0'))?.value
      if (newMD5 === oldMD5)
        return 0
      const parseredData = await this.getIconTagData()
      const localTotal = await db.iconTag.count()
      // 当本地图标标签数大于远程图标标签数时，需要同步已删除的图标标签，所以这里做一次清空
      localTotal > parseredData.length && await db.iconTag.clear()
      await db.iconTag.bulkPut(parseredData)
      // 图标标签信息成功之后才更新本地 MD5
      await db.md5.put({ id: 'iconTag-0', value: newMD5 })
      return parseredData.length
    },

    /** 全量更新 */
    async updateAll() {
      try {
        loading.value = true
        const startTime = dayjs()
        const total = await this.updateIconTag()
        const spentTime = (dayjs().diff(startTime) / 1000).toFixed(0)
        localSettings.value.noticeDataUpdated && ElNotification.success({
          title: '图标标签更新成功',
          message: `本次共更新图标标签 ${total} 个，耗时 ${spentTime} 秒`,
          position: 'bottom-right',
        })
      }
      catch (err) {
        ElNotification.error({
          title: '图标标签更新失败',
          message: messageFrom(err),
          position: 'bottom-right',
        })
      }
      finally {
        loading.value = false
      }
    },

    /** 清除全部图标标签 */
    async clearAll() {
      try {
        loading.value = true
        await db.iconTag.clear()
        await db.md5.where('id').startsWith('iconTag-').delete()
      }
      catch {
        // no action
      }
      finally {
        loading.value = false
      }
    },

    /** 清除后台定时任务 */
    clearBackgroundUpdate() {
      window.clearTimeout(updateTimer.value)
      updateTimer.value = undefined
    },

    /** 后台定时自动更新 */
    async backgroundUpdate() {
      if (updateTimer.value !== undefined)
        this.clearBackgroundUpdate()
      await this.updateAll()
      const interval = (localSettings.value.autoUpdateInterval ?? 20) * 60000
      updateEnd.value = new Date().getTime() + interval
      updateTimer.value = window.setTimeout(() => {
        updateTimer.value = undefined
        this.backgroundUpdate()
      }, interval)
    },
  },
})