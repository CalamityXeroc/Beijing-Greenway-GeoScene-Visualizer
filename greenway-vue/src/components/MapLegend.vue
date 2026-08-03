<template>
  <div ref="legendContainer" class="map-legend-container"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Legend from '@geoscene/core/widgets/Legend.js'
import Expand from '@geoscene/core/widgets/Expand.js'

const props = defineProps({
  mapManager: { type: Object, required: true }
})

const legendContainer = ref(null)
let legend = null
let expand = null

const buildLayerInfos = () => {
  const map = props.mapManager?.getView?.()?.map
  if (!map) return []
  return [
    { layer: map.findLayerById('greenway-facilities'), title: '附近设施' },
    { layer: map.findLayerById('greenway-heatmap'), title: '绿道热度' }
  ].filter(x => x.layer)
}

const refresh = () => {
  if (!legend) return
  legend.layerInfos = buildLayerInfos()
  legend.refresh?.()
}

const init = () => {
  const view = props.mapManager?.getView?.()
  if (!view || !legendContainer.value || legend) return

  legend = new Legend({
    view,
    style: 'card',
    layerInfos: buildLayerInfos()
  })
  legend.container = legendContainer.value

  expand = new Expand({
    view,
    content: legendContainer.value,
    expandIconClass: 'esri-icon-legend',
    expanded: false
  })
  view.ui.add(expand, 'bottom-right')
}

onMounted(init)
onBeforeUnmount(() => {
  expand?.destroy?.()
  expand = null
  legend?.destroy?.()
  legend = null
})

defineExpose({ refresh })
</script>
