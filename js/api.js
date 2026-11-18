// 跟 backend 溝通的唯一出口。每個請求都從這裡出去，所以「帶上登入憑證」與
// 「憑證失效時怎麼辦」只要在這裡處理一次。

import { API_BASE_URL } from "./config.js";
import { getToken } from "./session.js";

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code; // backend 給的錯誤代碼，給程式判斷用
    this.status = status; // HTTP 狀態碼；0 代表根本沒連上
  }
}

// backend 用這幾個代碼說「你登入了，但現在不能用論壇」：還沒註冊、審核中、已停用。
const BLOCKED_CODES = new Set(["unregistered", "pending", "disabled"]);

// 這兩件事要動到畫面，由 main.js 提供做法：
//   reauthenticate()  憑證失效時請使用者重新登入，回傳有沒有成功
//   blocked()         帳號狀態變了（例如剛被停用），重新確認該顯示哪個畫面
let handlers = { reauthenticate: async () => false, blocked: () => {} };

export function setAuthHandlers(next) {
  handlers = next;
}

async function send(method, path, body, withSession) {
  const options = { method, headers: {} };
  const token = getToken();
  if (withSession && token) options.headers.Authorization = `Bearer ${token}`;
  if (body instanceof FormData) {
    // 上傳檔案用的表單。Content-Type 不能自己設：裡面有一段分隔字串，要讓瀏覽器自己產生。
    options.body = body;
  } else if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  try {
    return await fetch(API_BASE_URL + path, options);
  } catch {
    throw new ApiError("連不上伺服器，請確認網路連線後再試一次", "network_error", 0);
  }
}

/** 把失敗的回應變成 ApiError。backend 的錯誤格式是 {"error": 訊息, "code": 代碼}。 */
async function errorFrom(response) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    // 回來的不是 JSON，用下面的預設訊息。
  }
  return new ApiError(
    data?.error ?? "伺服器發生錯誤，請稍後再試",
    data?.code ?? "unknown_error",
    response.status,
  );
}

/**
 * 送出請求，回傳成功的回應。
 * options.session === false：不帶登入憑證（只有登入本身用）。
 * options.reauth === false：憑證失效時不要跳重新登入（只有啟動時確認登入狀態用）。
 */
async function fetchOk(method, path, body, options = {}) {
  const withSession = options.session !== false;
  let response = await send(method, path, body, withSession);

  // 401 代表登入憑證失效了。就地請使用者重新登入，成功就用同樣的內容再送一次，
  // 畫面上還沒送出的文字不會不見。只重送一次，避免繞不出來。
  if (response.status === 401 && withSession && options.reauth !== false) {
    if (await handlers.reauthenticate()) response = await send(method, path, body, true);
  }

  if (!response.ok) {
    const error = await errorFrom(response);
    if (response.status === 403 && withSession && BLOCKED_CODES.has(error.code)) handlers.blocked();
    throw error;
  }
  return response;
}

async function request(method, path, body, options) {
  const response = await fetchOk(method, path, body, options);
  if (response.status === 204) return null; // 刪除成功、登出成功時沒有內容
  try {
    return await response.json();
  } catch {
    throw new ApiError("伺服器回應的格式不正確，請稍後再試", "invalid_response", response.status);
  }
}

export const api = {
  get: (path, options) => request("GET", path, undefined, options),
  post: (path, body, options) => request("POST", path, body, options),
  put: (path, body, options) => request("PUT", path, body, options),
  delete: (path, options) => request("DELETE", path, undefined, options),

  /** 下載檔案，回傳檔案內容（Blob）。 */
  async download(path) {
    return (await fetchOk("GET", path)).blob();
  },

  /** 上傳一個檔案。file 是使用者在 <input type="file"> 選的那個檔案。 */
  upload(path, file) {
    const form = new FormData();
    form.append("file", file); // backend 讀的欄位名稱就叫 file
    return request("POST", path, form);
  },
};
