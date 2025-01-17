import { BitmapLayer } from '@deck.gl/layers/typed'
import type { Color } from '@deck.gl/core/typed'
import type { GenshinBaseLayer } from '../core'
import type { OverlayChunk } from '@/stores'
import { useMapSettingStore, useOverlayStore } from '@/stores'

const CONSPICUOUS_COLOR: Color = [255, 255, 255]
const INCONSPICUOUS_COLOR: Color = [128, 128, 128]
const NO_MASK_COLOR: Color = [200, 200, 200]

export const getOverlaysFrom = (target: GenshinBaseLayer): BitmapLayer[] => {
  const overlayStore = useOverlayStore()
  const mapSettingStore = useMapSettingStore()

  const isOverlayVisible = (overlay: OverlayChunk) => {
    if (!mapSettingStore.showOverlay)
      return false
    if (overlayStore.hiddenOverlayGroups.has(overlay.group.id))
      return false
    if (!overlay.group.multiple && overlayStore.topOverlayInGroup[overlay.group.id] !== overlay.item.id)
      return false
    return true
  }

  const getTintColor = (overlay: OverlayChunk) => {
    return overlayStore.topOverlayInGroup[overlay.group.id] === overlay.item.id
      ? CONSPICUOUS_COLOR
      : mapSettingStore.showOverlayMask
        ? INCONSPICUOUS_COLOR
        : NO_MASK_COLOR
  }

  return overlayStore.normalOverlays.reduce((seed, overlay) => {
    let [[xmin, ymin], [xmax, ymax]] = overlay.bounds
    ;[xmin, ymin] = target.context.deck.projectCoord([xmin, ymin])
    ;[xmax, ymax] = target.context.deck.projectCoord([xmax, ymax])
    seed.push(new BitmapLayer({
      id: `${target.props.id}-overlay-${overlay.id}`,
      pickable: mapSettingStore.showTooltip,
      coordinateSystem: target.rawProps.coordinateSystem,
      coordinateOrigin: target.rawProps.coordinateOrigin,
      bounds: [xmin, ymax, xmax, ymin],
      image: overlay.url,
      opacity: isOverlayVisible(overlay) ? 1 : 0,
      tintColor: getTintColor(overlay),
      transitions: {
        opacity: 150,
        tintColor: 150,
      },
      updateTriggers: {
        opacity: mapSettingStore.showOverlay,
        tintColor: overlayStore.stateId,
      },
    }))
    return seed
  }, [] as BitmapLayer[])
}
