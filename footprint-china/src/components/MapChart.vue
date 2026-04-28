<template>
  <div class="map-container">
    <el-button 
      v-if="currentLevel !== 'china'" 
      class="btn-back" 
      type="primary" 
      @click="backToChina"
    >
      返回全国地图
    </el-button>
    <div class="location-text" v-if="currentLevel !== 'china'">
      当前位置：{{ currentProvince }}
    </div>
    
    <div ref="chartRef" class="echarts-dom"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, shallowRef, markRaw } from 'vue';
import * as echarts from 'echarts';
import { ElMessage } from 'element-plus';
import chinaJson from '../assets/maps/china.json';
import { footprintService } from '../services/footprintService';

const emit = defineEmits(['openDrawer']);

const chartRef = ref<HTMLElement | null>(null);
const chartInstance = shallowRef<echarts.ECharts | null>(null);
const currentLevel = ref<'china' | 'province'>('china');
const currentProvince = ref('');

const provinceHeatmap = ref<any[]>([]);
const cityHeatmap = ref<any[]>([]);

// 拉取热力图数据
// 拉取热力图数据
const loadHeatmapData = async (filterUserId?: string) => {
  const res = await footprintService.getHeatmapData(filterUserId);
  provinceHeatmap.value = res.provinceData;
  cityHeatmap.value = res.cityData;
  
  // 核心修复点：不要重新 registerAndRenderMap！
  // 只需要判断当前在哪个层级，把对应的新数据喂给 ECharts 即可
  const currentData = currentLevel.value === 'china' ? provinceHeatmap.value : cityHeatmap.value;
  
  chartInstance.value?.setOption({
    series: [{
      data: currentData
    }]
  });
};

// 暴露给父组件 App.vue 使用
defineExpose({ loadHeatmapData });

// 初始化地图实例
const initMap = () => {
  if (chartRef.value) {
    chartInstance.value = markRaw(echarts.init(chartRef.value));
    registerAndRenderMap('china', chinaJson);
    chartInstance.value.on('click', (params: any) => {
      handleMapClick(params);
    });
  }
};

// 渲染核心逻辑
const registerAndRenderMap = (mapName: string, geoJson: any) => {
  echarts.registerMap(mapName, geoJson);
  
  const currentData = currentLevel.value === 'china' ? provinceHeatmap.value : cityHeatmap.value;
  
  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    visualMap: { 
      min: 0, max: 10, left: 'left', top: 'bottom', 
      inRange: { color: ['#e0ffff', '#006edd'] } 
    },
    series: [{
      name: '足迹数量', 
      type: 'map', 
      map: mapName, 
      roam: true,
      emphasis: { label: { show: true }, itemStyle: { areaColor: '#fbdc59' } },
      data: currentData
    }]
  };
  chartInstance.value?.setOption(option, true);
};

// 点击省份下钻或城市打卡
const handleMapClick = async (params: any) => {
  const areaName = params.name;

  if (currentLevel.value === 'china') {
    try {
      // 省份代码字典映射
      const adcodeMap: Record<string, string> = {
        '北京市': '110000', '天津市': '120000', '河北省': '130000', '山西省': '140000', '内蒙古自治区': '150000',
        '辽宁省': '210000', '吉林省': '220000', '黑龙江省': '230000', '上海市': '310000', '江苏省': '320000',
        '浙江省': '330000', '安徽省': '340000', '福建省': '350000', '江西省': '360000', '山东省': '370000',
        '河南省': '410000', '湖北省': '420000', '湖南省': '430000', '广东省': '440000', '广西壮族自治区': '450000',
        '海南省': '460000', '重庆市': '500000', '四川省': '510000', '贵州省': '520000', '云南省': '530000',
        '西藏自治区': '540000', '陕西省': '610000', '甘肃省': '620000', '青海省': '630000', '宁夏回族自治区': '640000',
        '新疆维吾尔自治区': '650000', '台湾省': '710000', '香港特别行政区': '810000', '澳门特别行政区': '820000'
      };
      
      const adcode = adcodeMap[areaName];
      if (!adcode) return ElMessage.warning('暂无该区域数据');

      // 加上 { referrerPolicy: 'no-referrer' }，告诉浏览器不要携带来源域名
      const response = await fetch(`https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`, {
        referrerPolicy: 'no-referrer'
      });
      const geoJson = await response.json();
      
      currentLevel.value = 'province';
      currentProvince.value = areaName;
      registerAndRenderMap(areaName, geoJson);
    } catch (error) {
      ElMessage.error(`加载地图失败`);
    }
  } else {
    emit('openDrawer', { cityName: areaName, provinceName: currentProvince.value });
  }
};

const backToChina = () => {
  currentLevel.value = 'china';
  currentProvince.value = '';
  registerAndRenderMap('china', chinaJson);
};

onMounted(() => {
  initMap();
  window.addEventListener('resize', () => chartInstance.value?.resize());
});
</script>

<style scoped>
.map-container { width: 100%; height: 100%; position: relative; }
.echarts-dom { width: 100%; height: 100%; }
.btn-back { position: absolute; top: 20px; left: 20px; z-index: 10; }
.location-text { position: absolute; top: 25px; left: 160px; font-size: 16px; font-weight: bold; z-index: 10; }
</style>