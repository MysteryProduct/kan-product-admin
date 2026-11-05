const DIGITS = [
  "ศูนย์",
  "หนึ่ง",
  "สอง",
  "สาม",
  "สี่",
  "ห้า",
  "หก",
  "เจ็ด",
  "แปด",
  "เก้า",
];
const PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

/** Up to six digits in words; `afterMillion` keeps the "เอ็ด" of a final 1 that stands alone in its group. */
function readGroup(digits: string, afterMillion = false): string {
  const length = digits.length;
  return [...digits]
    .map((character, index) => {
      const digit = Number(character);
      const place = length - index - 1;
      if (digit === 0) return "";
      if (place === 0 && digit === 1 && (length > 1 || afterMillion))
        return "เอ็ด";
      if (place === 1 && digit === 2) return "ยี่สิบ";
      if (place === 1 && digit === 1) return "สิบ";
      return `${DIGITS[digit]}${PLACES[place]}`;
    })
    .join("");
}

function readNumber(value: string): string {
  const digits = value.replace(/^0+/, "");
  if (!digits) return "";
  if (digits.length <= 6) return readGroup(digits);
  const split = digits.length - 6;
  return `${readNumber(digits.slice(0, split))}ล้าน${readGroup(digits.slice(split).replace(/^0+/, ""), true)}`;
}

/** A Baht amount in Thai words, as a receipt prints it: 1290.5 → หนึ่งพันสองร้อยเก้าสิบบาทห้าสิบสตางค์. */
export function thaiBahtText(amount: number): string {
  const satangTotal = Math.round(Math.abs(amount) * 100);
  const baht = Math.floor(satangTotal / 100);
  const satang = satangTotal % 100;
  const bahtText = baht > 0 ? `${readNumber(String(baht))}บาท` : "";
  if (satang > 0) return `${bahtText}${readNumber(String(satang))}สตางค์`;
  return bahtText ? `${bahtText}ถ้วน` : "ศูนย์บาทถ้วน";
}
