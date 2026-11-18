// 公告與文章的附圖：新增時選圖片（最多五張，先縮小再上傳），以及在內容頁把圖片顯示出來。

import { api } from "./api.js";
import { el } from "./ui.js";

const MAX_PICTURES = 5;
// 480P：短的那一邊最多 480 像素。橫的照片是高 480，直的照片是寬 480。
const SHORT_SIDE = 480;
// 壓縮的品質從高試到低。一般的照片第一個就夠小了，很長的全景照才會用到後面的。
const QUALITIES = [0.8, 0.6, 0.4];
// 跟 backend 的上限一致。
const MAX_BYTES = 300 * 1024;

/** 把一張圖畫到畫布上再存成 JPEG。 */
function toJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("這張圖片處理不了"))),
      "image/jpeg",
      quality,
    );
  });
}

/**
 * 把使用者選的圖片縮小成 480P 的 JPEG。
 * 在瀏覽器裡縮，上傳的就只有幾十 KB，手機網路也傳得快。
 */
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error("這不是瀏覽器看得懂的圖片");
    }
    const scale = Math.min(1, SHORT_SIDE / Math.min(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    // JPEG 沒有透明。原圖透明的地方先鋪成白色，不然會變成黑色。
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of QUALITIES) {
      const blob = await toJpeg(canvas, quality);
      if (blob.size <= MAX_BYTES) return blob;
    }
    throw new Error("縮小之後還是太大");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 把圖片的內容轉成 base64 文字，才能放進 JSON 送給 backend。 */
function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(",") + 1));
    reader.onerror = () => reject(new Error("圖片讀不出來"));
    reader.readAsDataURL(blob);
  });
}

/**
 * 新增公告或文章時選圖片的區塊。回傳 { element, encode }：
 * element 放進表單；送出時呼叫 encode()，拿到要送給 backend 的內容。
 */
export function picturePicker() {
  const chosen = []; // 每一張：{ blob: 縮小後的圖, url: 預覽用的網址 }
  const input = el("input", {
    class: "picture-input",
    id: "picture-input",
    type: "file",
    accept: "image/*",
    multiple: true,
  });
  const count = el("p", { class: "entry-meta" });
  const previews = el("ul", { class: "picture-previews" });
  const message = el("p", { class: "form-error", role: "alert" });

  function render() {
    previews.replaceChildren(
      ...chosen.map((picture, index) =>
        el(
          "li",
          { class: "picture-preview" },
          el("img", { src: picture.url, alt: `第 ${index + 1} 張圖` }),
          el("button", {
            class: "button button-small",
            type: "button",
            text: "移除",
            onClick: () => {
              URL.revokeObjectURL(picture.url);
              chosen.splice(chosen.indexOf(picture), 1);
              render();
            },
          }),
        ),
      ),
    );
    count.textContent = `已選 ${chosen.length} 張，最多 ${MAX_PICTURES} 張`;
    input.disabled = chosen.length >= MAX_PICTURES;
  }

  input.addEventListener("change", async () => {
    message.textContent = "";
    const files = [...input.files];
    input.value = ""; // 清掉，下次才能再選到同一個檔案
    for (const file of files) {
      if (chosen.length >= MAX_PICTURES) {
        message.textContent = `最多只能附 ${MAX_PICTURES} 張圖，多選的沒有加進來`;
        break;
      }
      try {
        const blob = await shrink(file);
        chosen.push({ blob, url: URL.createObjectURL(blob) });
      } catch (error) {
        message.textContent = `「${file.name}」加不進來：${error.message}`;
      }
      render();
    }
  });
  render();

  return {
    element: el(
      "div",
      { class: "field" },
      el("label", { class: "label", for: "picture-input", text: "附圖" }),
      el("p", { class: "entry-meta", text: "可以不附。圖片會自動縮小再上傳。" }),
      input,
      count,
      previews,
      message,
    ),
    /** 要送給 backend 的內容：[{ data: base64 文字 }, …]。 */
    encode: () => Promise.all(chosen.map(async (picture) => ({ data: await toBase64(picture.blob) }))),
  };
}

/**
 * 內容頁裡的附圖。entryPath 是那則公告或那篇文章在 backend 的路徑，例如 /posts/12。
 *
 * 看圖也要帶登入憑證，所以不能直接把網址放進 <img>：先用程式把圖抓回來，再交給 <img> 顯示。
 */
export function pictureGallery(entryPath, images) {
  const gallery = el("div", { class: "picture-list" });
  for (const image of images) {
    const frame = el("p", { class: "picture-frame", text: "圖片載入中…" });
    gallery.append(frame);
    api
      .download(`${entryPath}/images/${image.id}`)
      .then((blob) => {
        const picture = el("img", { src: URL.createObjectURL(blob), alt: "附圖" });
        // 圖顯示出來之後，暫時的網址就可以放掉了。
        picture.addEventListener("load", () => URL.revokeObjectURL(picture.src));
        frame.replaceChildren(picture);
      })
      .catch(() => {
        frame.textContent = "這張圖片讀不到";
      });
  }
  return gallery;
}
