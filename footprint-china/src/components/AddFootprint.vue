<template>
  <el-dialog 
    v-model="visible" 
    :title="`在 ${cityName} 打卡`" 
    width="500px"
    @closed="resetForm"
    :close-on-click-modal="false" 
  >
    <el-form :model="form" label-width="80px">
      <el-form-item label="旅行随笔">
        <el-input v-model="form.content" type="textarea" :rows="3" placeholder="记录下此刻的感受吧..." />
      </el-form-item>

      <el-form-item label="天气">
        <el-select v-model="form.weather" placeholder="选择天气">
          <el-option label="☀️ 晴天" value="晴天" />
          <el-option label="☁️ 多云" value="多云" />
          <el-option label="🌧️ 雨天" value="雨天" />
          <el-option label="❄️ 雪天" value="雪天" />
        </el-select>
      </el-form-item>

      <el-form-item label="心情指数">
        <el-rate v-model="form.mood" />
      </el-form-item>

      <el-form-item label="现场照片">
        <el-upload
          ref="uploadRef"
          action="#"
          list-type="picture-card"
          :auto-upload="false"
          :limit="9"
          multiple
          :on-change="handleFileChange"
          :on-remove="handleRemove"
          accept="image/*"
        >
          <el-icon><Plus /></el-icon>
        </el-upload>
      </el-form-item>

      <el-form-item v-if="photoExifInfo" label="照片解析">
        <div class="exif-tags">
          <el-tag size="small" type="info" v-if="photoExifInfo.date">
            📅 拍摄于: {{ photoExifInfo.date }}
          </el-tag>
          <el-tag size="small" type="success" v-if="photoExifInfo.hasGps">
            📍 包含真实地理坐标
          </el-tag>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="visible = false" :disabled="submitting">取 消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">
          发布足迹
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import type { UploadInstance, UploadFile } from 'element-plus';
import Compressor from 'compressorjs';
import EXIF from 'exif-js';
import { footprintService } from '../services/footprintService';
import { supabase } from '../utils/supabase';

const props = withDefaults(defineProps<{ cityName: string; provinceName: string }>(), {
  cityName: '', provinceName: ''
});

const emit = defineEmits(['success']);

const visible = ref(false);
const submitting = ref(false);
const uploadRef = ref<UploadInstance>();

// 核心改动：把单文件变成多文件数组
const selectedFiles = ref<(File & { uid: number })[]>([]);
const photoExifInfo = ref<{ date?: string, hasGps?: boolean } | null>(null);

const form = reactive({
  content: '', weather: '晴天', mood: 5
});

// 图片压缩算法保持不变
const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality: 0.6, maxWidth: 1200,
      success(result) { resolve(result as File); },
      error(err) { reject(err); },
    });
  });
};

// 解析照片底层 EXIF 数据
const extractExif = (file: File) => {
  EXIF.getData(file as any, function(this: any) {
    const date = EXIF.getTag(this, "DateTimeOriginal"); // 获取拍摄时间
    const lat = EXIF.getTag(this, "GPSLatitude");       // 获取 GPS 纬度

    if (date || lat) {
      photoExifInfo.value = {
        // EXIF 日期格式通常是 "YYYY:MM:DD HH:MM:SS"，我们稍作格式化
        date: date ? date.split(' ')[0].replace(/:/g, '-') : undefined,
        hasGps: !!lat
      };
    }
  });
};

// 文件发生变化时（添加图片）
const handleFileChange = (uploadFile: UploadFile) => {
  if (uploadFile.raw) {
    // 强制转换为我们定义的交叉类型
    const fileWithUid = uploadFile.raw as File & { uid: number };
    selectedFiles.value.push(fileWithUid);
    extractExif(fileWithUid); 
  }
};

const handleRemove = (uploadFile: UploadFile) => {
  // 注意这里：直接拿 uploadFile.uid 去比对，因为它本身是带有 uid 的
  selectedFiles.value = selectedFiles.value.filter(f => f.uid !== uploadFile.uid);
  if (selectedFiles.value.length === 0) {
    photoExifInfo.value = null;
  }
};

// 弹窗关闭时彻底重置状态
const resetForm = () => {
  form.content = ''; form.weather = '晴天'; form.mood = 5;
  selectedFiles.value = [];
  photoExifInfo.value = null;
  uploadRef.value?.clearFiles();
};

const submit = async () => {
  if (!form.content) return ElMessage.warning('写点随笔吧！');
  if (selectedFiles.value.length === 0) return ElMessage.warning('请至少上传一张照片！');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return ElMessage.error('请先登录！');

  submitting.value = true;
  try {
    // 核心改造：使用 Promise.all 实现高并发的多图压缩与上传
    const uploadPromises = selectedFiles.value.map(async (file) => {
      const compressedFile = await compressImage(file);
      return await footprintService.uploadImage(compressedFile);
    });

    // 等待所有图片上传完毕，拿到 URL 数组
    const imageUrls = await Promise.all(uploadPromises);

    await footprintService.addFootprint({
      user_id: session.user.id,
      province_name: props.provinceName,
      city_name: props.cityName,
      content: form.content,
      mood: form.mood,
      weather: form.weather,
      images: imageUrls // 直接存入整个 URL 数组
    });

    ElMessage.success('打卡成功！');
    visible.value = false; 
    emit('success');
  } catch (error: any) {
    ElMessage.error('发布失败: ' + error.message);
  } finally {
    submitting.value = false;
  }
};

defineExpose({ open: () => visible.value = true });
</script>

<style scoped>
.dialog-footer { display: flex; justify-content: flex-end; }
.exif-tags { display: flex; gap: 10px; flex-wrap: wrap; }
</style>