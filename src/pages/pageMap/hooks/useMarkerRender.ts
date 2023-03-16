import type { Ref, ShallowRef } from 'vue'
import { render } from 'vue'
import L from 'leaflet'
import type { UnionMarkerVo } from '.'
import { GenshinMarker } from '@/pages/pageMap/core'
import { useMap } from '@/pages/pageMap/hooks'
import { localSettings } from '@/stores'
import { sleep } from '@/utils'
import { MarkerEditPanel, MarkerPopup } from '@/pages/pageMap/components'
import { useGlobalDialog } from '@/hooks'

export class GenshinMarkerGroup extends L.LayerGroup {
  constructor(layers: GenshinMarker[]) {
    super(layers)
  }
}

export const useMarkerRender = (markerListRef: Ref<UnionMarkerVo[]>) => {
  const { map } = useMap()
  const { DialogService } = useGlobalDialog()
  const componentCtx = getCurrentInstance()

  /** 缓存的 popup DOM */
  const popupDOM = L.DomUtil.create('div', 'w-full h-full')

  /**
   * 根据点位坐标将地图移动到点集中心
   */
  const moveToCenter = async (markers: GenshinMarker[]) => {
    if (!localSettings.value.moveToCenter || !markers.length)
      return
    const { xmin, xmax, ymin, ymax } = markers.slice(1).reduce((rect, marker) => {
      const { lat, lng } = marker.getLatLng()
      if (lat < rect.xmin)
        rect.xmin = lat
      else if (lat > rect.xmax)
        rect.xmax = lat
      if (lng < rect.ymin)
        rect.ymin = lng
      else if (lng > rect.ymax)
        rect.ymax = lng
      return rect
    }, (() => {
      const { lat, lng } = markers[0].getLatLng()
      return { xmin: lat, xmax: lat, ymin: lng, ymax: lng }
    })())
    const centerLatlng: [number, number] = [(xmin + xmax) / 2, (ymin + ymax) / 2]
    // 延迟到点位渲染大致完成后再移动视野，以避免同时移动视野导致的卡顿
    await sleep(100)
    map.value?.flyTo(centerLatlng, map.value.getZoom(), { duration: 0.2 })
  }

  /** 点位创建方法 */
  const createGenshinMarker = (markerVo: UnionMarkerVo) => {
    const marker = new GenshinMarker(markerVo, {
      radius: 15,
      pane: 'markerPane',
    })

    const onCommand = (command: string) => ({
      edit: () => DialogService
        .config({
          title: `编辑点位：${markerVo.id} - ${markerVo.markerTitle}`,
          width: 'fit-content',
          alignCenter: true,
          closeOnPressEscape: false,
          class: 'transition-all',
        })
        .props({
          markerInfo: markerVo,
        })
        .open(MarkerEditPanel),
    } as Record<string, () => void>)[command]?.()

    /** 这里绕一圈用 focus 而不是 click，是因为点位的 focus 事件并不一定由 click 触发 */
    marker.on('focus', () => {
      if (!map.value)
        return
      const vnode = h(MarkerPopup, {
        markerInfo: markerVo,
        latlng: marker.getLatLng(),
        onCommand,
      })
      vnode.appContext = componentCtx?.appContext ?? null
      render(vnode, popupDOM)
      map.value.popups.markerPopup
        .close()
        .setContent(popupDOM)
        .setLatLng(marker.getLatLng())
        .openOn(map.value)
    })
    marker.on('mouseover', () => {
      if (!map.value)
        return
      map.value.pointToMarker(marker)
    })
    marker.on('mouseout', () => {
      if (!map.value)
        return
      map.value.pointToMarker()
    })

    return marker
  }

  /** 点位组 */
  const markerLayer = shallowRef() as ShallowRef<GenshinMarkerGroup | undefined>
  /** 渲染点位 */
  const renderMarkers = (markers: UnionMarkerVo[]) => {
    map.value?.popups.markerPopup.close()
    markerLayer.value && map.value?.removeLayer(markerLayer.value)
    const canvasMarkers = markers.map(createGenshinMarker)
    const markerGroup = new GenshinMarkerGroup(canvasMarkers)
    map.value?.addLayer(markerGroup)
    markerLayer.value = markerGroup
    moveToCenter(canvasMarkers)
  }

  watch(markerListRef, renderMarkers)

  return { markerLayer }
}