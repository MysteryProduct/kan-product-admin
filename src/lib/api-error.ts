import axios from 'axios';

export function isLoginRequest(url?: string): boolean {
  const path = url?.split(/[?#]/)[0];
  return !!path && /(?:^|\/)auth\/(?:employee-login|login)\/?$/.test(path);
}

export function getApiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError<{ message?: string | string[] }>(error)) {
    return error instanceof Error
      ? error.message
      : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
  }
  const status = error.response?.status;
  if (status === 403)
    return 'คุณไม่มีสิทธิ์ดำเนินการนี้ กรุณาติดต่อผู้ดูแลระบบ';
  if (status === 401)
    return isLoginRequest(error.config?.url)
      ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
      : 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง';
  const message = error.response?.data?.message;
  if (Array.isArray(message)) {
    const messages = message.filter(
      (item): item is string => typeof item === 'string' && item.length > 0,
    );
    if (messages.length) return messages.join('\n');
  }
  if (typeof message === 'string' && message) return message;
  if (!error.response) return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่';
  return `เกิดข้อผิดพลาดจาก API (${status})`;
}
