// 後台：成員管理。版主與管理員用它審核申請、調整角色、停用帳號。
//
// 這裡把不能改的欄位鎖起來只是為了好操作；能不能改，最後是 backend 決定的。

import { api } from "./api.js";
import { formatTime } from "./format.js";
import { getUser } from "./session.js";
import { el, showError, showLoading } from "./ui.js";

const ROLE_LABELS = { member: "一般使用者", moderator: "版主", admin: "管理員" };
const STATUS_LABELS = { pending: "審核中", approved: "已審核", disabled: "已停用" };

export async function adminView(container) {
  const content = el("div");
  container.replaceChildren(
    el("div", { class: "toolbar" }, el("h2", { class: "page-title", text: "後台：成員管理" })),
    content,
  );

  showLoading(content);
  let data;
  try {
    data = await api.get("/admin/users");
  } catch (error) {
    showError(content, error, () => adminView(container));
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

  content.replaceChildren(
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
  function fill() {
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
      fill();
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
  fill();

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
