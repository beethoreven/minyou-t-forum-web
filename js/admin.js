// 後台。版主與管理員用它新增公告、新增文檔、管理成員。
//
// 這裡把不能改的欄位鎖起來只是為了好操作；能不能改，最後是 backend 決定的。

import { api } from "./api.js";
import { formatTime } from "./format.js";
import { getUser } from "./session.js";
import { el, fill, showError, showLoading } from "./ui.js";

const ROLE_LABELS = { member: "一般使用者", moderator: "版主", admin: "管理員" };
const STATUS_LABELS = { pending: "審核中", approved: "已審核", disabled: "已停用" };

export function adminView(container) {
  const documentsBox = el("div");
  const membersBox = el("div");
  fill(
    container,
    el("div", { class: "toolbar" }, el("h2", { class: "page-title", text: "後台" })),
    el(
      "section",
      { class: "card admin-section" },
      el("h3", { class: "section-title", text: "公告" }),
      el("p", { class: "card-text", text: "發布給所有住戶看的公告。要修改或刪除，到「社區公告」點進那一則。" }),
      el("a", { class: "button button-primary", href: "#/announcements/new", text: "新增公告" }),
    ),
    el(
      "section",
      { class: "card admin-section" },
      el("h3", { class: "section-title", text: "文檔" }),
      documentsBox,
    ),
    el(
      "section",
      { class: "admin-section" },
      el("h3", { class: "section-title", text: "成員管理" }),
      membersBox,
    ),
  );
  loadDocuments(documentsBox);
  loadMembers(membersBox);
}

// ── 文檔 ─────────────────────────────────────────────────

/**
 * 文檔不經過論壇上傳，而是直接放進存放的地方（正式環境是 Google Drive 的一個資料夾）。
 * 這裡給一顆按鈕把那個資料夾打開。
 */
async function loadDocuments(box) {
  showLoading(box);
  let info;
  try {
    info = await api.get("/admin/documents");
  } catch (error) {
    showError(box, error, () => loadDocuments(box));
    return;
  }

  if (info.manage_url) {
    fill(
      box,
      el("p", {
        class: "card-text",
        text: "文檔放在 Google Drive 的資料夾裡。按下面的按鈕會開啟那個資料夾，把檔案放進去，回到「社區文檔」重新整理就看得到。要刪除或改名，也在那個資料夾裡做。",
      }),
      el("a", {
        class: "button button-primary",
        href: info.manage_url,
        target: "_blank",
        rel: "noopener noreferrer",
        text: "新增文檔",
      }),
      el("p", {
        class: "entry-meta",
        text: "只有一般檔案（PDF、Word、圖片等）會出現在「社區文檔」。要有那個資料夾的編輯權限才放得進去。",
      }),
    );
    return;
  }
  fill(
    box,
    el("p", {
      class: "card-text",
      text: `文檔放在這台電腦的資料夾：${info.location}。把檔案放進去，回到「社區文檔」重新整理就看得到。`,
    }),
  );
}

// ── 成員管理 ─────────────────────────────────────────────

async function loadMembers(box) {
  showLoading(box);
  let data;
  try {
    data = await api.get("/admin/users");
  } catch (error) {
    showError(box, error, () => loadMembers(box));
    return;
  }

  // 最上面那一行「還有幾位在等審核」。每次儲存之後重算一次。
  const statuses = new Map(data.items.map((item) => [item.id, item.status]));
  const summary = el("p", { class: "card-text" });
  function updateSummary(changed) {
    if (changed) statuses.set(changed.id, changed.status);
    const pendingCount = [...statuses.values()].filter((status) => status === "pending").length;
    summary.textContent =
      pendingCount > 0 ? `有 ${pendingCount} 位在等審核，排在最前面。` : "目前沒有等待審核的申請。";
  }
  updateSummary();

  fill(
    box,
    summary,
    el("ul", { class: "member-list" }, ...data.items.map((item) => memberItem(item, updateSummary))),
  );
}

function memberItem(member, onSaved) {
  const me = getUser();
  const isSelf = member.id === me.id;
  // 版主不能動管理員的帳號。
  const locked = me.role !== "admin" && member.role === "admin";

  const nameInput = el("input", { class: "input", type: "text", "aria-label": "顯示名稱" });
  const unitInput = el("input", { class: "input", type: "text", "aria-label": "戶號" });
  const roleSelect = el("select", { class: "input", "aria-label": "角色" });
  const statusSelect = el("select", { class: "input", "aria-label": "狀態" });
  const badge = el("span", { class: "badge" });
  const message = el("p", { class: "save-message", role: "status" });
  const saveButton = el("button", { class: "button button-primary", type: "button", text: "儲存" });
  const approveButton = el("button", { class: "button", type: "button", text: "通過審核" });

  /** 把畫面上這一列更新成 member 現在的內容。 */
  function show() {
    nameInput.value = member.display_name;
    unitInput.value = member.unit_no;

    // 只有管理員能指定管理員，所以版主的選單裡沒有這一項（除非這個人本來就是管理員）。
    const roles = Object.keys(ROLE_LABELS).filter(
      (role) => role !== "admin" || me.role === "admin" || member.role === "admin",
    );
    roleSelect.replaceChildren(...roles.map((role) => el("option", { value: role, text: ROLE_LABELS[role] })));
    roleSelect.value = member.role;

    // 帳號不能改回審核中，所以只有本來就在審核中的人看得到這個選項。
    const statuses = Object.keys(STATUS_LABELS).filter(
      (status) => status !== "pending" || member.status === "pending",
    );
    statusSelect.replaceChildren(
      ...statuses.map((status) => el("option", { value: status, text: STATUS_LABELS[status] })),
    );
    statusSelect.value = member.status;

    badge.textContent = STATUS_LABELS[member.status];
    badge.className = `badge badge-${member.status}`;
    approveButton.hidden = member.status !== "pending" || locked;

    for (const control of [nameInput, unitInput, saveButton]) control.disabled = locked;
    // 不能改自己的角色與狀態：唯一的管理員把自己降級或停用，就沒有人能改回來了。
    for (const control of [roleSelect, statusSelect]) control.disabled = locked || isSelf;
  }

  async function save() {
    saveButton.disabled = true;
    approveButton.disabled = true;
    message.textContent = "";
    message.classList.remove("save-message-error");
    try {
      const result = await api.put(`/admin/users/${member.id}`, {
        display_name: nameInput.value.trim(),
        unit_no: unitInput.value.trim(),
        role: roleSelect.value,
        status: statusSelect.value,
      });
      member = result.item;
      show();
      onSaved(member);
      message.textContent = result.changed ? "已儲存" : "沒有修改";
    } catch (error) {
      message.textContent = error.message;
      message.classList.add("save-message-error");
    } finally {
      saveButton.disabled = locked;
      approveButton.disabled = false;
    }
  }

  saveButton.addEventListener("click", save);
  approveButton.addEventListener("click", () => {
    statusSelect.value = "approved";
    save();
  });
  show();

  return el(
    "li",
    { class: "member" },
    el(
      "div",
      { class: "member-head" },
      el("span", { class: "member-email", text: member.email + (isSelf ? "（你自己）" : "") }),
      badge,
    ),
    el("p", { class: "entry-meta", text: `加入時間：${formatTime(member.created_at)}` }),
    el(
      "div",
      { class: "member-fields" },
      el("label", { class: "member-field" }, el("span", { class: "label", text: "顯示名稱" }), nameInput),
      el("label", { class: "member-field" }, el("span", { class: "label", text: "戶號" }), unitInput),
      el("label", { class: "member-field" }, el("span", { class: "label", text: "角色" }), roleSelect),
      el("label", { class: "member-field" }, el("span", { class: "label", text: "狀態" }), statusSelect),
    ),
    locked && el("p", { class: "entry-meta", text: "版主不能修改管理員的帳號。" }),
    el("div", { class: "actions" }, approveButton, saveButton),
    message,
  );
}

/** 給頁首顯示用：角色的中文名稱。 */
export function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}
