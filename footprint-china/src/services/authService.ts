// src/services/authService.ts
import { supabase } from '../utils/supabase';

export const authService = {
  // 注册
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },

  // 登录
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  // 登出
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // 获取当前会话状态
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },
  // 1. 获取用户档案
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single(); // single() 确保只返回一条对象，而不是数组
    
    if (error) {
      console.error('获取档案失败', error);
      return null;
    }
    return data;
  },

  // 2. 更新用户档案 (昵称、头像)
  async updateProfile(userId: string, updates: { username?: string; avatar_url?: string }) {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    if (error) throw error;
  },

  // 3. 上传头像专用方法
  async uploadAvatar(file: File) {
    const fileExt = file.name.split('.').pop();
    const fileName = `user_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('avatars') // 存入刚建好的 avatars 桶
      .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    return publicUrl;
  }
};