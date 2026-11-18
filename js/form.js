// 表單共用的檢查與字數顯示。

import { countChars } from "./format.js";

/** 檢查一個欄位。有問題就回傳要顯示的訊息，沒問題回傳空字串。text 要先去掉頭尾空白。 */
export function checkText(text, label, max) {
  if (!text) return `請填寫${label}`;
  if (countChars(text) > max) return `${label}最多 ${max} 字`;
  return "";
}

/** 在 counter 顯示「目前字數 / 上限」，超過時變色。字數算的是去掉頭尾空白之後的。 */
export function showCount(counter, text, max) {
  const count = countChars(text.trim());
  counter.textContent = `${count} / ${max}`;
  counter.classList.toggle("counter-over", count > max);
}
