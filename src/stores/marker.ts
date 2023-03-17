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
const updateMissions = shallowRef<API.MarkerVo[]>([])

liveQuery(() => db.marker.count()).subscribe((v) => {
  total.value = v
})

/** 全量点位的全局数据 */
export const useMarkerStore = defineStore('global-marker', {
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
    /**
     * @internal
     * 获取点位分页数据的 MD5 数组
     */
    async _getMarkerMD5List() {
      const { data = [] } = await Api.markerDoc.listMarkerBz2MD5()
      return data
    },

    /**
     * @internal
     * 更新分页点位数据
     */
    async _updateMarkerInfo(index: number, newMD5: string) {
      // 检查 MD5 是否有变化，如无则跳过更新
      const oldMD5 = (await db.md5.get(`marker-${index}`))?.value
      if (newMD5 === oldMD5)
        return 0
      const data = await Api.markerDoc.listPageMarkerBy7zip({ index }, ({
        responseType: 'arraybuffer',
      } as AxiosRequestConfig)) as unknown as ArrayBuffer
      await db.md5.put({ id: `marker-${index}`, value: newMD5 })
      // 解压点位数据至任务列表
      const depressedData = await Compress.decompress(new Uint8Array(data), 60000)
      const stringData = new TextDecoder('utf-8').decode(depressedData.buffer)
      const parseredData = JSON.parse(stringData) as API.MarkerVo[]
      updateMissions.value = updateMissions.value.concat(parseredData)
    },

    /** 全量更新 */
    async updateAll() {
      updateMissions.value = []
      try {
        loading.value = true
        const startTime = dayjs()
        const md5List = await this._getMarkerMD5List()
        await Promise.all(md5List.map((_, index) => this._updateMarkerInfo(index + 1, md5List[index])))
        // TODO 已删除点位的点位不会被同步，需要在本地进行删除
        await db.transaction('rw', db.marker, async () => {
          await db.marker.bulkPut(updateMissions.value)
        })
        // 由于全量数据不包含已删除的点位，这里需要筛选出本地存在但在云点位中不存在的点位并删除
        const total = updateMissions.value.length
        localSettings.value.noticeDataUpdated && ElNotification.success({
          title: '点位更新成功',
          message: `本次共更新点位 ${total} 个，耗时 ${(dayjs().diff(startTime) / 1000).toFixed(0)} 秒`,
          position: 'bottom-right',
        })
      }
      catch (err) {
        ElNotification.error({
          title: '点位更新失败',
          message: messageFrom(err),
          position: 'bottom-right',
        })
      }
      finally {
        loading.value = false
        updateMissions.value = []
      }
    },

    /** 清除全部点位 */
    async clearAll() {
      try {
        loading.value = true
        await db.marker.clear()
        await db.md5.where('id').startsWith('marker-').delete()
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
    async backgroundUpdate(immediate = true) {
      if (updateTimer.value !== undefined)
        this.clearBackgroundUpdate()
      immediate && await this.updateAll()
      const interval = (localSettings.value.autoUpdateInterval ?? 20) * 60000
      updateEnd.value = new Date().getTime() + interval
      updateTimer.value = window.setTimeout(() => {
        updateTimer.value = undefined
        this.backgroundUpdate()
      }, interval)
    },

    /** 重新创建后台更新任务，适用于手动刷新后推迟更新时间 */
    async reCreateBackgroundUpdate() {
      this.clearBackgroundUpdate()
      this.backgroundUpdate(false)
    },
  },
})
