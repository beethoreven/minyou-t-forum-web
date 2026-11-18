// 環境設定。換環境時只改這個檔案。

const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";

// backend 的網址：在自己的電腦上開發時連本機的 backend，其他情況連正式環境的。
export const API_BASE_URL = isLocal
  ? "http://localhost:5180"
  : "https://minyou-t-forum-backend.onrender.com";

// Google 登入用的 OAuth 用戶端 ID。這是公開的值，不是秘密。
// 要跟 backend 的設定 GOOGLE_CLIENT_ID 一樣。
export const GOOGLE_CLIENT_ID =
  "1089673206336-8q0m6a60vvjjifbk7ii4k4q62brko2u3.apps.googleusercontent.com";
