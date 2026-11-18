// 登入狀態：存在瀏覽器裡的登入憑證，以及「現在登入的是誰、是什麼角色」。
//
// 登入憑證是 backend 發的（不是 Google 的），存在 localStorage，所以關掉分頁、重新整理、
// 關掉瀏覽器再開，都還是登入狀態。只有按登出、太久沒用、或帳號被停用才會登出。

const STORAGE_KEY = "minyou_t_forum.session";

// 存在瀏覽器裡的內容：{ token: 登入憑證, email, name: Google 帳號上的名稱 }
let stored = readStored();

// backend 回報的帳號狀態：{ email, state, authorized, user }。還沒問過 backend 之前是 null。
let account = null;

function readStored() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return value && typeof value.token === "string" ? value : null;
  } catch {
    return null; // 沒存過、存的內容壞了、或瀏覽器不讓用 localStorage
  }
}

export function getToken() {
  return stored ? stored.token : null;
}

/** Google 帳號上的名稱，註冊表單拿來當預設的顯示名稱。 */
export function getGoogleName() {
  return stored ? stored.name || "" : "";
}

export function saveSession(next) {
  stored = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 存不進去就只留在記憶體：這次還能用，重新整理後要再登入一次。
  }
}

export function clearSession() {
  stored = null;
  account = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上。
  }
}

export function setAccount(next) {
  account = next;
}

export function getAccount() {
  return account;
}

/** 現在登入的成員：{ id, display_name, unit_no, role }。還沒註冊就是 null。 */
export function getUser() {
  return account ? account.user : null;
}

/** 是不是版主或管理員。畫面用它決定要不要顯示按鈕；真正的把關在 backend。 */
export function isStaff() {
  const user = getUser();
  return Boolean(user) && (user.role === "moderator" || user.role === "admin");
}
