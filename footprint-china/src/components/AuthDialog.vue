<template>
  <el-dialog v-model="visible" :title="isLogin ? '欢迎回来' : '开启足迹之旅'" width="400px">
    <el-form :model="form" label-position="top">
      <el-form-item label="邮箱账号">
        <el-input v-model="form.email" placeholder="输入邮箱" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="form.password" type="password" placeholder="输入密码(至少6位)" show-password />
      </el-form-item>
    </el-form>
    
    <div style="text-align: right; margin-bottom: 20px;">
      <el-link type="primary" underline="never" @click="isLogin = !isLogin">
        {{ isLogin ? '没有账号？去注册' : '已有账号？去登录' }}
      </el-link>
    </div>

    <template #footer>
      <el-button type="primary" style="width: 100%" :loading="loading" @click="handleSubmit">
        {{ isLogin ? '登 录' : '注 册' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { authService } from '../services/authService';

const visible = ref(false);
const isLogin = ref(true); // 控制显示登录还是注册
const loading = ref(false);

const form = reactive({ email: '', password: '' });

const emit = defineEmits(['auth-success']);

const handleSubmit = async () => {
  if (!form.email || form.password.length < 6) {
    return ElMessage.warning('请填写正确的邮箱和至少6位密码');
  }
  
  loading.value = true;
  try {
    if (isLogin.value) {
      await authService.signIn(form.email, form.password);
      ElMessage.success('登录成功！');
    } else {
      await authService.signUp(form.email, form.password);
      ElMessage.success('注册成功并已自动登录！');
    }
    visible.value = false;
    emit('auth-success'); // 通知父组件刷新状态
  } catch (error: any) {
    ElMessage.error(error.message);
  } finally {
    loading.value = false;
  }
};

defineExpose({ open: () => visible.value = true });
</script>