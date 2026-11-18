// 還不能使用論壇時看到的畫面：登入、註冊、審核中、已停用、連不上伺服器。

import { api } from "./api.js";
import { checkText, showCount } from "./form.js";
import { showGoogleButton } from "./google.js";
import { getGoogleName } from "./session.js";
import { el } from "./ui.js";

// 跟 backend 的上限一致。
const NAME_MAX = 30;
const UNIT_MAX = 30;

/** 登入頁。登入成功呼叫 onSignedIn(帳號狀態)。notice 是要先顯示的提示，例如「登入已過期」。 */
export function loginScreen(container, onSignedIn, notice = "") {
  const buttonBox = el("div", { class: "google-button" });
  const error = el("p", { class: "form-error", role: "alert", text: notice });
  container.replaceChildren(
    el(
      "section",
      { class: "card card-center" },
      el("h2", { class: "page-title", text: "歡迎來到老爺華廈論壇" }),
      el("p", { class: "card-text", text: "這裡是社區住戶專用的論壇，請用 Google 帳號登入。" }),
      buttonBox,
      error,
    ),
  );
  showGoogleButton(buttonBox, {
    onSuccess: onSignedIn,
    onError: (message) => {
      error.textContent = message;
    },
  });
}

/** 註冊表單：第一次登入的人填顯示名稱與戶號。送出後呼叫 onRegistered(帳號狀態)。 */
export function registerScreen(container, account, onRegistered) {
  const nameInput = el("input", { class: "input", id: "register-name", type: "text", autocomplete: "name" });
  const unitInput = el("input", { class: "input", id: "register-unit", type: "text", autocomplete: "off" });
  nameInput.value = getGoogleName().slice(0, NAME_MAX);
  const nameCounter = el("span", { class: "counter" });
  const unitCounter = el("span", { class: "counter" });
  const formError = el("p", { class: "form-error", role: "alert" });
  const submitButton = el("button", { class: "button button-primary", type: "submit", text: "送出申請" });

  function updateCounters() {
    showCount(nameCounter, nameInput.value, NAME_MAX);
    showCount(unitCounter, unitInput.value, UNIT_MAX);
  }
  nameInput.addEventListener("input", updateCounters);
  unitInput.addEventListener("input", updateCounters);
  updateCounters();

  async function submit(event) {
    event.preventDefault();
    const displayName = nameInput.value.trim();
    const unitNo = unitInput.value.trim();
    const problem = checkText(displayName, "顯示名稱", NAME_MAX) || checkText(unitNo, "戶號", UNIT_MAX);
    if (problem) {
      formError.textContent = problem;
      return;
    }
    // 送出期間把按鈕鎖住，連按兩下才不會送出兩次。
    submitButton.disabled = true;
    formError.textContent = "";
    try {
      onRegistered(await api.post("/auth/register", { display_name: displayName, unit_no: unitNo }));
    } catch (error) {
      formError.textContent = error.message;
      submitButton.disabled = false;
    }
  }

  container.replaceChildren(
    el(
      "form",
      { class: "form", novalidate: true, onSubmit: submit },
      el("h2", { class: "page-title", text: "申請加入" }),
      el("p", { class: "card-text", text: `你登入的帳號是 ${account.email}。填好下面的資料送出後，要等管理員審核。` }),
      el(
        "div",
        { class: "field" },
        el("label", { class: "label", for: "register-name", text: "顯示名稱" }),
        nameInput,
        nameCounter,
      ),
      el(
        "div",
        { class: "field" },
        el("label", { class: "label", for: "register-unit", text: "戶號" }),
        unitInput,
        unitCounter,
      ),
      formError,
      submitButton,
    ),
  );
}

/** 審核中。onRefresh 重新確認一次狀態。 */
export function pendingScreen(container, onRefresh) {
  container.replaceChildren(
    el(
      "section",
      { class: "card card-center" },
      el("h2", { class: "page-title", text: "審核中" }),
      el("p", { class: "card-text", text: "申請已經送出，正在等管理員審核。審核通過之後，按下面的按鈕或重新整理這個頁面就能進入。" }),
      el("button", { class: "button", type: "button", text: "重新確認", onClick: onRefresh }),
    ),
  );
}

/** 已停用。 */
export function disabledScreen(container) {
  container.replaceChildren(
    el(
      "section",
      { class: "card card-center" },
      el("h2", { class: "page-title", text: "帳號無法使用" }),
      el("p", { class: "card-text", text: "這個帳號目前不能使用論壇。有疑問請聯絡社區的管理員。" }),
    ),
  );
}

/**
 * 啟動時連不上伺服器。這不代表登入失效，所以不登出，只給「再試一次」。
 */
export function unreachableScreen(container, error, onRetry) {
  container.replaceChildren(
    el(
      "section",
      { class: "card card-center" },
      el("h2", { class: "page-title", text: "暫時連不上伺服器" }),
      el("p", { class: "card-text", text: `${error.message}。伺服器一陣子沒人使用時會休息，第一次連線可能要等一分鐘左右。` }),
      el("button", { class: "button button-primary", type: "button", text: "再試一次", onClick: onRetry }),
    ),
  );
}
