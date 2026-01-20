import axios from 'axios';

// สร้าง axios instance พร้อม config
const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/',
  timeout: 10000, // 10 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor - เพิ่ม auth token ทุก request
axiosInstance.interceptors.request.use(
  (config) => {
    // ดึง token จาก localStorage (ถ้ามี)
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          // เพิ่ม token ใน header (ปรับตามโครงสร้าง API ของคุณ)
          if (user.token) {
            config.headers.Authorization = `Bearer ${user.token}`;
          }
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor - จัดการ errors แบบรวมศูนย์
axiosInstance.interceptors.response.use(
  (response) => {
    // ส่งข้อมูลกลับไปตรงๆ
    return response;
  },
  (error) => {
    // จัดการ error ต่างๆ
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Unauthorized - ให้ redirect ไป login
          if (typeof window !== 'undefined') {
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
          break;
        case 403:
          console.error('Forbidden: You do not have permission');
          break;
        case 404:
          console.error('Not Found:', data.message || 'Resource not found');
          break;
        case 500:
          console.error('Server Error:', data.message || 'Internal server error');
          break;
        default:
          console.error('API Error:', data.message || 'Unknown error');
      }
      
      // Throw error with message
      throw new Error(data.message || `API Error: ${status}`);
    } else if (error.request) {
      // Request was made but no response
      console.error('Network Error: No response from server');
      throw new Error('Network Error: Unable to connect to server');
    } else {
      // Something else happened
      console.error('Error:', error.message);
      throw error;
    }
  }
);

export default axiosInstance;
