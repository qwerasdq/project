/**
 * ECharts 按需注册。
 *
 * 全量 `import * as echarts from 'echarts'` 会把所有图表类型打进产物（数百 KB），
 * 这里只注册用到的模块。**注册是模块级副作用**，所以组件一律从本模块导入 VChart，
 * 由导入顺序保证注册先于渲染发生。
 */

import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

export { default as VChart } from 'vue-echarts'
