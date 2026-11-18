// 社區文檔：列出文件，點了就下載。

import { api } from "./api.js";
import { formatSize, formatTime } from "./format.js";
import { el, showError, showLoading } from "./ui.js";

export async function documentsView(container) {
  const content = el("div");
  container.replaceChildren(
    el("div", { class: "toolbar" }, el("h2", { class: "page-title", text: "社區文檔" })),
    content,
  );

  showLoading(content);
  let data;
  try {
    data = await api.get("/documents");
  } catch (error) {
    showError(content, error, () => documentsView(container));
    return;
  }

  if (data.items.length === 0) {
    content.replaceChildren(el("p", { class: "status", text: "目前沒有文件" }));
    return;
  }
  content.replaceChildren(el("ul", { class: "entry-list" }, ...data.items.map(documentItem)));
}

function documentItem(file) {
  const info = `${formatTime(file.modified_time)}・${formatSize(file.size)}`;
  const meta = el("span", { class: "entry-meta", text: info });
  const button = el(
    "button",
    { class: "entry", type: "button" },
    el("span", { class: "entry-title", text: file.name }),
    meta,
  );
  button.addEventListener("click", async () => {
    // 下載期間把這一列鎖住，連按兩下才不會下載兩次。
    button.disabled = true;
    meta.textContent = "下載中…";
    try {
      saveFile(await api.download(`/documents/${file.id}/download`), file.name);
      meta.textContent = info;
    } catch (error) {
      meta.textContent = `下載失敗：${error.message}`;
    } finally {
      button.disabled = false;
    }
  });
  return el("li", {}, button);
}

/**
 * 把已經抓回來的檔案交給瀏覽器存檔。
 * 不直接用連結下載，是因為之後下載要帶登入憑證，一般的連結帶不了。
 */
function saveFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = el("a", { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  // 馬上釋放的話，有些瀏覽器還沒開始存檔，網址就失效了。晚一點再釋放。
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
