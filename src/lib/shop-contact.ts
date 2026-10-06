// TASK-0046: how a shopper reaches the shop. The channels are saved in the
// settings table and shown on the Store. The API is the authority on what is
// valid; these checks only tell the person before they save, with the same
// limits and wording.

import type { ShopContactChannels } from '@/types/settings';

export type ShopContactForm = {
  [K in keyof ShopContactChannels]-?: string;
};

export const SHOP_CONTACT_LIMITS = {
  shop_phone: 30,
  shop_email: 120,
  shop_line: 200,
  shop_hours: 200,
} as const;

// 8-15 digits, optionally led by +, with spaces, dashes or brackets between.
const PHONE = /^\+?(?=(?:\D*\d){8,15}\D*$)\d[\d ()-]*$/;
const EMAIL = /^[^\s@<>"',;:()]+@[^\s@<>"',;:()]+\.[^\s@<>"',;:()]+$/;
// A LINE Official Account id (@shop) or a line.me / lin.ee page.
const LINE = /^(?:@[A-Za-z0-9._-]{2,40}|https:\/\/(?:line\.me|lin\.ee)(?:\/\S*)?)$/;

export const emptyShopContact: ShopContactForm = {
  shop_phone: '',
  shop_email: '',
  shop_line: '',
  shop_hours: '',
};

export const shopContactFrom = (
  settings: ShopContactChannels | null | undefined,
): ShopContactForm => ({
  shop_phone: settings?.shop_phone ?? '',
  shop_email: settings?.shop_email ?? '',
  shop_line: settings?.shop_line ?? '',
  shop_hours: settings?.shop_hours ?? '',
});

/** Error text per field; a blank field is fine (it is cleared and not shown). */
export function validateShopContact(form: ShopContactForm): Record<string, string> {
  const errors: Record<string, string> = {};
  const phone = form.shop_phone.trim();
  const email = form.shop_email.trim();
  const line = form.shop_line.trim();
  const hours = form.shop_hours.trim();

  if (phone && (phone.length > SHOP_CONTACT_LIMITS.shop_phone || !PHONE.test(phone))) {
    errors.shop_phone = 'เบอร์โทรร้านต้องเป็นตัวเลข 8-15 หลัก (ขึ้นต้นด้วย + ได้)';
  }
  if (email && (email.length > SHOP_CONTACT_LIMITS.shop_email || !EMAIL.test(email))) {
    errors.shop_email = 'รูปแบบอีเมลร้านไม่ถูกต้อง';
  }
  if (line && (line.length > SHOP_CONTACT_LIMITS.shop_line || !LINE.test(line))) {
    errors.shop_line =
      'LINE ของร้านต้องเป็น LINE ID ที่ขึ้นต้นด้วย @ หรือลิงก์ https ของ line.me / lin.ee';
  }
  if (hours.length > SHOP_CONTACT_LIMITS.shop_hours) {
    errors.shop_hours = 'เวลาทำการยาวเกินไป (ไม่เกิน 200 ตัวอักษร)';
  }
  return errors;
}

/** What is sent to the API: a blank field is sent as null so it is cleared. */
export const shopContactPayload = (form: ShopContactForm): ShopContactChannels => ({
  shop_phone: form.shop_phone.trim() || null,
  shop_email: form.shop_email.trim() || null,
  shop_line: form.shop_line.trim() || null,
  shop_hours: form.shop_hours.trim() || null,
});
