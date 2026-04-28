<template>
  <el-dialog v-model="visible" title="修改个人资料" width="400px">
    <div class="avatar-uploader-container">
      <el-upload
        class="avatar-uploader"
        action="#"
        :show-file-list="false"
        :auto-upload="false"
        :on-change="handleAvatarChange"
      >
        <img v-if="form.avatar_url" :src="form.avatar_url" class="avatar" />
        <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
      </el-upload>
      <div class="el-upload__tip" style="text-align: center; margin-top: 10px;">点击图片更换头像</div>
    </div>

    <el-form :model="form" label-position="top">
      <el-form-item label="专属昵称">
        <el-input v-model="form.username" placeholder="给自己起个好听的名字吧" />
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="visible = false" :disabled="loading">取消</el-button>
        <el-button type="primary" :loading="loading" @click="submit">保存修改</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { supabase } from '../utils/supabase';
import { authService } from '../services/authService';

const visible = ref(false);
const loading = ref(false);
const selectedFile = ref<File | null>(null);
const emit = defineEmits(['success']);

// 响应式表单数据
const form = reactive({
  username: '',
  avatar_url: ''
});

// 打开弹窗并回显当前数据
const open = async (currentProfile: any) => {
  if (currentProfile) {
    form.username = currentProfile.username || '';
    form.avatar_url = currentProfile.avatar_url || '';
  }
  visible.value = true;
};

// 本地预览图片
const handleAvatarChange = (uploadFile: any) => {
  selectedFile.value = uploadFile.raw;
  form.avatar_url = URL.createObjectURL(uploadFile.raw); // 实现瞬间本地预览
};

// 提交修改
const submit = async () => {
  loading.value = true;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('未登录');

    const updates: any = { username: form.username };

    // 如果用户选了新图片，先传图片
    if (selectedFile.value) {
      const newAvatarUrl = await authService.uploadAvatar(selectedFile.value);
      updates.avatar_url = newAvatarUrl;
    }

    // 更新数据库中的档案
    await authService.updateProfile(session.user.id, updates);
    
    ElMessage.success('资料修改成功！');
    visible.value = false;
    emit('success'); // 通知父组件刷新头像和昵称
  } catch (error: any) {
    ElMessage.error('修改失败: ' + error.message);
  } finally {
    loading.value = false;
  }
};

defineExpose({ open });
</script>

<style scoped>
.avatar-uploader-container { display: flex; flex-direction: column; align-items: center; margin-bottom: 20px; }
.avatar-uploader .avatar { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; display: block; }
.avatar-uploader :deep(.el-upload) { border: 1px dashed var(--el-border-color); border-radius: 50%; cursor: pointer; position: relative; overflow: hidden; transition: var(--el-transition-duration-fast); }
.avatar-uploader :deep(.el-upload:hover) { border-color: var(--el-color-primary); }
.avatar-uploader-icon { font-size: 28px; color: #8c939d; width: 100px; height: 100px; text-align: center; line-height: 100px; }
.dialog-footer { display: flex; justify-content: flex-end; }
</style>