// 畫面用的小工具：建立元素、載入中與錯誤畫面、確認視窗。

/**
 * 建立一個元素。
 *   el("a", { class: "button", href: "#/forum", text: "回列表" })
 *   el("ul", {}, el("li", { text: "第一項" }), el("li", { text: "第二項" }))
 * props 裡 text 是文字內容，on 開頭的是事件（onClick、onSubmit），其他都是 HTML 屬性。
 * 文字一律當成純文字放進去，不會被當成 HTML。
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

/**
 * 把 container 的內容換成 children，會略過 false、null、undefined。
 *
 * 畫面上常寫「條件 && 元素」：條件成立才放那個元素。條件不成立時，那一格的值是 false。
 * el() 會略過它；但直接呼叫 container.replaceChildren(…) 不會，false 會被當成文字，
 * 畫面上就多出「false」五個字。所以內容裡有條件的時候，一律用這個函式。
 */
export function fill(container, ...children) {
  container.replaceChildren(
    ...children.filter((child) => child !== null && child !== undefined && child !== false),
  );
}

/** 在 container 裡顯示「載入中」。 */
export function showLoading(container) {
  const status = el("p", { class: "status", role: "status", text: "載入中…" });
  container.replaceChildren(status);
  // 伺服器閒置一陣子之後，第一個請求可能要等比較久。先說明，免得看起來像壞掉。
  setTimeout(() => {
    if (status.isConnected) status.textContent = "伺服器回應比較慢，還在連線中，請稍候…";
  }, 5000);
}

/** 在 container 裡顯示錯誤訊息。有給 onRetry 就多一顆「再試一次」。 */
export function showError(container, error, onRetry) {
  container.replaceChildren(
    el(
      "div",
      { class: "status status-error", role: "alert" },
      el("p", { text: error.message || "發生錯誤，請稍後再試" }),
      onRetry && el("button", { class: "button", type: "button", text: "再試一次", onClick: onRetry }),
    ),
  );
}

/** 跳出確認視窗。使用者按下確認回傳 true，按取消或 Esc 回傳 false。 */
export function confirmDialog(message, confirmLabel) {
  return new Promise((resolve) => {
    const dialog = el(
      "dialog",
      { class: "dialog" },
      el("p", { class: "dialog-message", text: message }),
      el(
        "div",
        { class: "dialog-actions" },
        el("button", { class: "button", type: "button", text: "取消", onClick: () => dialog.close("cancel") }),
        el("button", {
          class: "button button-danger",
          type: "button",
          text: confirmLabel,
          onClick: () => dialog.close("confirm"),
        }),
      ),
    );
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(dialog.returnValue === "confirm");
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}
