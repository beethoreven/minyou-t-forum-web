// Google 登入按鈕。
//
// Google 只負責證明「這個人是誰」：使用者按下按鈕登入後，Google 給一段身分證明（ID Token）。
// 這裡馬上把它交給 backend，換成論壇自己的登入憑證存起來；Google 的那一段之後就不再使用。

import { api } from "./api.js";
import { GOOGLE_CLIENT_ID } from "./config.js";
import { saveSession } from "./session.js";

const LOAD_TIMEOUT_MS = 15000;

let initialized = false;
// 現在是誰在等登入結果：{ onSuccess(account), onError(message) }。
// Google 的元件只能設定一個回呼函式，所以用這個變數轉交給目前畫面上的那一顆按鈕。
let waiting = null;

/** 等 index.html 裡那支 Google 的 script 載入完成。 */
function loadGoogle() {
  return new Promise((resolve, reject) => {
    const ready = () => window.google && window.google.accounts && window.google.accounts.id;
    if (ready()) {
      resolve(window.google);
      return;
    }
    const script = document.getElementById("google-script");
    const failed = () => reject(new Error("Google 登入元件載入失敗，請確認網路連線後重新整理"));
    const timer = setTimeout(failed, LOAD_TIMEOUT_MS);
    script.addEventListener("load", () => {
      clearTimeout(timer);
      if (ready()) resolve(window.google);
      else failed();
    });
    script.addEventListener("error", () => {
      clearTimeout(timer);
      failed();
    });
  });
}

async function handleCredential(response) {
  const target = waiting;
  try {
    // session: false —— 這時候還沒有論壇的登入憑證，這一步就是要去換它。
    const data = await api.post("/auth/login", { id_token: response.credential }, { session: false });
    saveSession({ token: data.session_token, email: data.email, name: data.google_name });
    if (target) target.onSuccess(data);
  } catch (error) {
    if (target) target.onError(error.message);
  }
}

/**
 * 在 container 裡放一顆 Google 登入按鈕。
 * 登入成功呼叫 onSuccess(帳號狀態)，失敗呼叫 onError(訊息)。
 */
export async function showGoogleButton(container, { onSuccess, onError }) {
  waiting = { onSuccess, onError };
  let google;
  try {
    google = await loadGoogle();
  } catch (error) {
    onError(error.message);
    return;
  }
  if (!initialized) {
    google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential });
    initialized = true;
  }
  google.accounts.id.renderButton(container, {
    type: "standard",
    theme: "outline",
    size: "large",
    shape: "pill",
    text: "signin_with",
    locale: "zh_TW",
  });
}

/** 登出時呼叫：請 Google 不要自動幫這個瀏覽器選回同一個帳號。 */
export function forgetGoogleAccount() {
  if (initialized) window.google.accounts.id.disableAutoSelect();
}
