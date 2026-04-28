<template>
  
  <div class="app-layout">
  <div class="user-panel">
      <el-button v-if="!session" type="primary" round @click="authDialogRef?.open()">
        登录 / 注册
      </el-button>
      <div v-else class="user-info">
        <div class="profile-trigger" @click="profileSettingsRef?.open(userProfile)">
          <el-avatar 
            :size="32" 
            :src="userProfile?.avatar_url || 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'" 
          />
          <span class="email-text">{{ userProfile?.username || session.user.email }}</span>
        </div>
        <ProfileSettings ref="profileSettingsRef" @success="loadUserProfile" />
        <el-button size="small" text @click="handleLogout">退出</el-button>
      </div>
      <div v-if="session" class="mode-switch">
    <span class="label">{{ isExploreMode ? '探索世界' : '我的足迹' }}</span>
    <el-switch 
      v-model="isExploreMode" 
      @change="handleModeChange"
      active-color="#13ce66"
    />
  </div>
    </div>

    <AuthDialog ref="authDialogRef" @auth-success="initAuthState" />
  <MapChart ref="mapChartRef" @openDrawer="handleOpenDrawer" />
    <el-drawer
      v-model="drawerVisible"
      :title="selectedCity + ' 的足迹'"
      direction="rtl"
      size="40%"
    >
      <div class="drawer-header-actions">
        <el-button type="primary" @click="openAddForm" size="large">
          📍 我也去过这里，记录足迹
        </el-button>
      </div>

      <el-divider />

      <div v-if="loading" class="skeleton-container">
      <el-skeleton animated :count="2">
        <template #template>
          <div style="padding: 14px">
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
              <el-skeleton-item variant="h3" style="width: 40%;" />
              <el-skeleton-item variant="text" style="width: 20%;" />
            </div>
            <el-skeleton-item variant="p" style="width: 100%; margin-bottom: 10px;" />
            <el-skeleton-item variant="p" style="width: 80%; margin-bottom: 20px;" />
            <div style="display: flex; gap: 10px;">
              <el-skeleton-item variant="image" style="width: 50%; height: 160px; border-radius: 8px;" />
            </div>
          </div>
        </template>
      </el-skeleton>
    </div>
      
      <el-empty v-else-if="currentFootprints.length === 0" description="这片土地还没有你的足迹，快来打卡吧！" />
      
      <div v-else class="footprints-list">
        <el-card v-for="item in currentFootprints" :key="item.id" class="mb-4">
          <div class="card-header">
            <h3>{{ item.created_at ? item.created_at.substring(0, 10) : '刚刚' }} - {{ item.weather }}</h3>
            <el-rate v-model="item.mood" disabled />
          </div>
          <p class="content-text">{{ item.content }}</p>
          <div class="images-grid">
            <el-image 
              v-for="img in item.images" 
              :key="img" 
              :src="img" 
              :preview-src-list="item.images"
              fit="cover"
              class="photo"
              lazy
            />
          </div>
        </el-card>
      </div>
    </el-drawer>

   <AddFootprint 
    ref="addFormRef" 
    :cityName="selectedCity" 
    :provinceName="selectedProvince"
    @success="handleAddSuccess" 
  />
  </div>
</template>

<script setup lang="ts">
import { ref,onMounted } from 'vue';
import MapChart from './components/MapChart.vue';
import AddFootprint from './components/AddFootprint.vue'; // 引入新建的表单组件
import { footprintService } from './services/footprintService';
import { supabase } from './utils/supabase';
import AuthDialog from './components/AuthDialog.vue';
import ProfileSettings from './components/ProfileSettings.vue'; // 引入组件
import { authService } from './services/authService';
const selectedProvince = ref('');
const mapChartRef = ref();
const drawerVisible = ref(false);
const selectedCity = ref('');
const loading = ref(false);
const currentFootprints = ref<any[]>([]);
const props = defineProps<{ cityName: string, provinceName: string }>();
// 弹窗引用
const addFormRef = ref();
const authDialogRef = ref();
const profileSettingsRef = ref();
const userProfile = ref<any>(null); // 保存用户的真实档案数据
const session = ref<any>(null); // 保存登录状态
// 触发弹窗打开
const openAddForm = () => {
  addFormRef.value.open();
};
// 稍微修改一下原有的 initAuthState，加上拉取档案的逻辑
const initAuthState = async () => {
  const { data } = await supabase.auth.getSession();
  session.value = data.session;
  
  if (session.value) {
    await loadUserProfile(); // 登录成功后，立刻拉取档案
  } else {
    userProfile.value = null; // 没登录则清空档案
  }
  
  const filterUserId = (!isExploreMode.value && session.value) ? session.value.user.id : undefined;
  mapChartRef.value?.loadHeatmapData(filterUserId); 
};
// 退出登录
const handleLogout = async () => {
  await supabase.auth.signOut();
  session.value = null;
  mapChartRef.value?.loadHeatmapData(); // 退出后刷新地图（清空别人的足迹）
};
// 新增：拉取用户档案的方法
const loadUserProfile = async () => {
  if (session.value) {
    userProfile.value = await authService.getProfile(session.value.user.id);
  }
};

const isExploreMode = ref(false); // 默认显示“我的足迹”

// 切换模式时的逻辑
const handleModeChange = () => {
  // 计算出到底要不要传 userId
  const filterUserId = (!isExploreMode.value && session.value) ? session.value.user.id : undefined;
  
  // 把算好的 filterUserId 传给地图组件
  mapChartRef.value?.loadHeatmapData(filterUserId);
  
  if (drawerVisible.value) {
    handleOpenDrawer({ cityName: selectedCity.value, provinceName: selectedProvince.value });
  }
};


// 重构拉取数据的逻辑
const handleOpenDrawer = async (payload: { cityName: string, provinceName: string }) => {
  selectedCity.value = payload.cityName;
  selectedProvince.value = payload.provinceName;
  drawerVisible.value = true;
  loading.value = true;
  
  try {
    // 关键点：如果不是探索模式且已登录，就传用户 ID 过滤
    const filterUserId = (!isExploreMode.value && session.value) ? session.value.user.id : undefined;
    const data = await footprintService.getFootprintsByCity(payload.cityName, filterUserId);
    currentFootprints.value = data;
  } finally {
    loading.value = false;
  }
};
const handleAddSuccess = () => {
  // 1. 刷新抽屉里的游记列表
  handleOpenDrawer({ cityName: selectedCity.value, provinceName: selectedProvince.value });
  // 2. 核心！调用 MapChart 暴露的方法，重新拉取热力图数据，刷新地图颜色！
  mapChartRef.value?.loadHeatmapData();
};


// 页面加载时初始化
onMounted(() => {
  initAuthState();
  
  // 监听 Supabase 自动派发的登录状态变化事件（比如 token 过期等）
  supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession;
  });
});
</script>

<style scoped>
.app-layout { width: 100vw; height: 100vh; overflow: hidden; }
.drawer-header-actions { text-align: center; margin-bottom: 10px; }
.mb-4 { margin-bottom: 1.5rem; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.card-header h3 { margin: 0; font-size: 16px; color: #303133; }
.content-text { color: #606266; line-height: 1.6; margin-bottom: 15px; }
.images-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.photo { width: 100%; height: 160px; border-radius: 8px; border: 1px solid #ebeef5; }
.user-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 100;
  background: rgba(255, 255, 255, 0.9);
  padding: 8px 15px;
  border-radius: 20px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
}
.user-info { display: flex; align-items: center; gap: 10px; }
.email-text { font-size: 14px; font-weight: 500; color: #333; }
.profile-trigger { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 8px; border-radius: 8px; transition: background 0.2s; }
.profile-trigger:hover { background-color: #f0f2f5; }
</style>