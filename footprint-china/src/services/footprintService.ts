import { supabase } from '../utils/supabase';

export const footprintService = {
// 1. 获取足迹列表（增加 userId 参数）
  async getFootprintsByCity(cityName: string, userId?: string) {
    let query = supabase
      .from('footprints')
      .select('*')
      .eq('city_name', cityName);
    
    // 如果传入了 userId，则开启“私密模式”过滤
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    return error ? [] : data;
  },

  // 2. 上传单张图片并返回公开的 URL
  async uploadImage(file: File) {
    // 生成随机文件名，防止同名文件覆盖 (如: 1a2b3c4d.jpg)
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 10)}.${fileExt}`;

    // 上传到 footprints 桶
    const { error } = await supabase.storage
      .from('footprints')
      .upload(fileName, file);

    if (error) throw error;

    // 获取公开访问的 URL
    const { data: { publicUrl } } = supabase.storage
      .from('footprints')
      .getPublicUrl(fileName);

    return publicUrl;
  },

  // 3. 将包含图片 URL 的完整表单数据存入数据库
  async addFootprint(formData: any) {
    const { data, error } = await supabase
      .from('footprints')
      .insert([formData]);

    if (error) throw error;
    return data;
  },

 // 4. 获取热力图聚合数据（同时统计省和市）
    async getHeatmapData(userId?: string) {
    let query = supabase.from('footprints').select('province_name, city_name');
    
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) return { provinceData: [], cityData: [] };

    const provinceCounts: Record<string, number> = {};
    const cityCounts: Record<string, number> = {};

    data.forEach(item => {
      if (item.province_name) {
        provinceCounts[item.province_name] = (provinceCounts[item.province_name] || 0) + 1;
      }
      if (item.city_name) {
        cityCounts[item.city_name] = (cityCounts[item.city_name] || 0) + 1;
      }
    });

    return {
      provinceData: Object.keys(provinceCounts).map(k => ({ name: k, value: provinceCounts[k] })),
      cityData: Object.keys(cityCounts).map(k => ({ name: k, value: cityCounts[k] }))
    };
}
};