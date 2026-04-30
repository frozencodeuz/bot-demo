// index.js
// Render.com + Telegram Bot + Google Sheets Apps Script
// Node.js 18+ kerak. package.json bo'lmasa Render Build Command: npm init -y
// Start Command: node index.js

const http = require("http");
const fs = require("fs");
const path = require("path");

// -----------------------------------------------------------------------------
// SOZLAMALAR
// -----------------------------------------------------------------------------

process.env.TZ = "Asia/Tashkent";

const BOT_TOKEN =
  process.env.BOT_TOKEN ||
  "";

const GOOGLE_SCRIPT_URL =
  process.env.GOOGLE_SCRIPT_URL ||
  ""; // Render Environment ga Apps Script Web App URL qo'ying

const DEVONXONA_ID =
  process.env.DEVONXONA_ID ||
  "1157115397";

const ADMIN_IDS = (process.env.ADMIN_IDS || "554338234")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

const GROUP_ID =
  process.env.GROUP_ID ||
  "-1001819145287";

const REQUIRED_CHANNEL =
  process.env.REQUIRED_CHANNEL ||
  "@Nishonhokimligi";

const INSTAGRAM_LINK =
  process.env.INSTAGRAM_LINK ||
  "https://www.instagram.com/nishonhokimligi";

const PORT = process.env.PORT || 3000;

const STORAGE_DIR = path.join(__dirname, "sessions");
const APPEALS_DIR = path.join(__dirname, "appeals");

if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
if (!fs.existsSync(APPEALS_DIR)) fs.mkdirSync(APPEALS_DIR, { recursive: true });

const MAHALLA_LIST = [
  "Нишон",
  "Навбаҳор",
  "Пахтакор",
  "Орзу бўстони",
  "Гулистон",
  "Жалажин",
  "Ойдин",
  "Янги Нурчи",
  "Умр бунёдкори",
  "Боғишамол",
  "Кимёгар",
  "Байналминал",
  "Нурчи",
  "Истиқбол",
  "Чаман",
  "Ширинобод",
  "Қирққулоч",
  "Самарқанд",
  "Ёшлар диёри",
  "Юксалиш",
  "Балхияк",
  "Катта анҳор",
  "Каптарли",
  "Дўстлик",
  "Бўстон",
  "Обод",
  "Кўксой",
  "А. Қодирий",
  "Оқ олтин",
  "Пахтаобод",
  "Янги обод",
  "Наврўз",
  "Пахтазор",
  "Нуристон",
  "Гулзор",
  "Жануб машъали",
  "Ибн Сино",
];

// -----------------------------------------------------------------------------
// YORDAMCHI FUNKSIYALAR
// -----------------------------------------------------------------------------

function now() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeText(text) {
  return String(text || "").trim();
}

async function telegram(method, data = {}) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json || json.ok === false) {
      console.error("Telegram API error:", method, json || res.statusText);
    }

    return json;
  } catch (err) {
    console.error("Telegram request failed:", method, err.message);
    return null;
  }
}

async function sendMessage(chatId, text, keyboard = null) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  if (keyboard) payload.reply_markup = keyboard;

  return telegram("sendMessage", payload);
}

async function editMessageText(chatId, messageId, text, keyboard = null) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  if (keyboard) payload.reply_markup = keyboard;

  return telegram("editMessageText", payload);
}

async function deleteMessage(chatId, messageId) {
  return telegram("deleteMessage", {
    chat_id: chatId,
    message_id: messageId,
  });
}

async function answerCallbackQuery(callbackQueryId, text, showAlert = false) {
  return telegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

async function checkJoin(userId) {
  const res = await telegram("getChatMember", {
    chat_id: REQUIRED_CHANNEL,
    user_id: userId,
  });

  const status = res?.result?.status;

  return ["member", "creator", "administrator", "restricted"].includes(status);
}

function sessionPath(chatId) {
  return path.join(STORAGE_DIR, `${chatId}.json`);
}

function appealPath(id) {
  return path.join(APPEALS_DIR, `${id}.json`);
}

function getUserData(chatId) {
  const file = sessionPath(chatId);

  if (!fs.existsSync(file)) {
    return { step: "none", data: {} };
  }

  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { step: "none", data: {} };
  }
}

function saveUserData(chatId, data) {
  fs.writeFileSync(sessionPath(chatId), JSON.stringify(data, null, 2));
}

function saveAppeal(id, data) {
  fs.writeFileSync(appealPath(id), JSON.stringify(data, null, 2));
}

function getAppeal(id) {
  const file = appealPath(id);

  if (!fs.existsSync(file)) return null;

  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function makeReplyKeyboard(rows, options = {}) {
  return {
    keyboard: rows,
    resize_keyboard: true,
    one_time_keyboard: options.one_time_keyboard ?? false,
    input_field_placeholder: options.input_field_placeholder,
  };
}

function removeKeyboard() {
  return { remove_keyboard: true };
}

function makeInlineKeyboard(rows) {
  return { inline_keyboard: rows };
}

function statusKeyboard(appealId) {
  return makeInlineKeyboard([
    [
      { text: "⏳ Ижрога олиш", callback_data: `status_doing_${appealId}` },
      { text: "✅ Ҳал қилинди", callback_data: `status_done_${appealId}` },
      { text: "🚫 Рад этиш", callback_data: `status_reject_${appealId}` },
    ],
  ]);
}

function generateAppealId() {
  return `${Math.floor(Date.now() / 1000)}${Math.floor(100 + Math.random() * 900)}`;
}

function getAppealTypeText(type) {
  if (type === "corruption") {
    return "Коррупцион ҳолат бўйича хабар";
  }

  return "Мурожаат";
}

function getAppealTypeHashTag(type) {
  if (type === "corruption") {
    return "#коррупция";
  }

  return "#мурожаат";
}

function generateReport(data, appealId, statusInfo) {
  const safe = {};
  for (const [key, value] of Object.entries(data || {})) {
    safe[key] = escapeHtml(value);
  }

  const appealTypeText = getAppealTypeText(data?.appeal_type || "appeal");

  let report = `📄 <b>${escapeHtml(appealTypeText).toUpperCase()} ВАРАҚАСИ №${escapeHtml(appealId)}</b>\n`;
  report += "--------------------------------------------------\n";
  report += `<b>Тури:</b> ${escapeHtml(appealTypeText)}\n`;
  report += `<b>Ҳолати:</b> ${statusInfo.emoji} <b>${escapeHtml(statusInfo.text)}</b>\n`;
  report += "--------------------------------------------------\n";
  report += `<b>Кимдан:</b> ${safe.name || ""}\n`;
  report += "👤 <b>Шахсий маълумотлар:</b>\n";
  report += `📅 Т.сана: ${safe.dob || ""}\n`;
  report += `👫 Жинси: ${safe.gender || ""}\n`;
  report += `📗 Паспорт: ${safe.passport || ""}\n`;
  report += `💼 Мақоми: ${safe.status_job || ""}\n`;
  report += `📞 Тел: ${safe.phone || ""}\n\n`;
  report += "📍 <b>Манзил:</b>\n";
  report += `🏘 Маҳалла: ${safe.mahalla || ""}\n`;
  report += `🏠 Уй манзили: ${safe.address || ""}\n\n`;

  if (data?.appeal_type === "corruption") {
    report += "🚨 <b>Коррупцион ҳолат мазмуни:</b>\n";
  } else {
    report += "📝 <b>Мурожаат мазмуни:</b>\n";
  }

  report += `${safe.appeal_text || ""}\n`;
  report += "--------------------------------------------------\n";
  report += "🕒 <b>ВАҚТ НАЗОРАТИ:</b>\n";
  report += `📥 Яратилди: <b>${safe.created_at || ""}</b>\n`;

  if (safe.processed_at) {
    report += `⏳ Ижрога олинди: <b>${safe.processed_at}</b>\n`;
  }

  if (safe.finished_at) {
    report += `🏁 Якунланди: <b>${safe.finished_at}</b>\n`;
  }

  if (safe.executor) {
    report += `👨‍💼 Ижрочи: <b>${safe.executor}</b>\n`;
  }

  if (safe.final_conclusion) {
    report += `📌 Хулоса: <b>${safe.final_conclusion}</b>\n`;
  }

  report += "--------------------------------------------------\n";

  if (data?.appeal_type === "corruption") {
    report += "🔒 <b>Эслатма:</b> хабар берувчининг шахси қонунчиликда белгиланган тартибда сир сақланади.\n";
    report += "--------------------------------------------------\n";
  }

  if (data?.user_id) {
    report += `👤 <a href='tg://user?id=${escapeHtml(data.user_id)}'>Фойдаланувчи профили</a>`;
  }

  return report;
}

async function sendToGoogleSheet(payload) {
  if (!GOOGLE_SCRIPT_URL) {
    console.warn("GOOGLE_SCRIPT_URL kiritilmagan. Google Sheets ga yuborilmadi.");
    return { ok: false, skipped: true };
  }

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let json = null;

    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!res.ok || json.result === "error") {
      console.error("Google Sheets error:", json);
      return { ok: false, data: json };
    }

    return { ok: true, data: json };
  } catch (err) {
    console.error("Google Sheets request failed:", err.message);
    return { ok: false, error: err.message };
  }
}

function makeCreateSheetPayload(appealId, data) {
  return {
    action: "create",
    id: appealId,
    appeal_type: data.appeal_type || "appeal",
    appeal_type_text: getAppealTypeText(data.appeal_type || "appeal"),
    created_at: data.created_at,
    status: "Янги",
    name: data.name,
    dob: data.dob,
    gender: data.gender,
    passport: data.passport,
    status_job: data.status_job,
    mahalla: data.mahalla,
    address: data.address,
    phone: data.phone,
    appeal_text: data.appeal_text,
    user_id: data.user_id,
  };
}

function makeUpdateSheetPayload(appealId, action, data) {
  const base = {
    action: "update",
    id: appealId,
    appeal_type: data.appeal_type || "appeal",
    appeal_type_text: getAppealTypeText(data.appeal_type || "appeal"),
    timestamp: now(),
  };

  if (action === "doing") {
    return {
      ...base,
      status: "Ижрода",
      status_code: "processing",
      executor: data.executor || "",
    };
  }

  if (action === "done") {
    return {
      ...base,
      status: "Ҳал қилинди",
      status_code: "solved",
      final_status: "Ҳал қилинди",
      final_conclusion: data.final_conclusion || "Мурожаат ижобий ҳал қилинди.",
    };
  }

  if (action === "reject") {
    return {
      ...base,
      status: "Рад этилди",
      status_code: "rejected",
      final_status: "Рад этилди",
      final_conclusion:
        data.final_conclusion ||
        "Мурожаат маълумотлар нотўғрилиги ёки асоссизлиги сабабли рад этилди.",
    };
  }

  return base;
}

async function showAppealTypeMenu(chatId) {
  let msg = "✅ Раҳмат!\n\n";
  msg += "Илтимос, мурожаат турини танланг:\n\n";
  msg += "📝 <b>Мурожаат йўллаш</b> — умумий масала, таклиф, ариза ёки шикоят юбориш.\n";
  msg += "🚨 <b>Коррупцион ҳолат бўйича хабар бериш</b> — пора, таъмагирлик, мансабни суиистеъмол қилиш ёки шубҳали ҳолат ҳақида хабар бериш.\n\n";
  msg += "🔒 <i>Коррупцион ҳолат бўйича хабар берган шахснинг маълумотлари қонунчиликда белгиланган тартибда сир сақланади.</i>";

  await sendMessage(
    chatId,
    msg,
    makeReplyKeyboard(
      [
        [{ text: "📝 Мурожаат йўллаш" }],
        [{ text: "🚨 Коррупцион ҳолат бўйича хабар бериш" }],
        [{ text: "❌ Бекор қилиш" }],
      ],
      { one_time_keyboard: true }
    )
  );
}

async function showRules(chatId) {
  let rules = "⚠️ <b>ДИҚҚАТ! МУРОЖААТ ЙЎЛЛАШ ТАРТИБИ</b>\n\n";
  rules += "Ҳурматли фуқаро! Сиз Нишон тумани ҳокимлигига расмий мурожаат ёки коррупцион ҳолат бўйича хабар йўллашингиз мумкин.\n\n";
  rules += "🔒 <b>Муҳим:</b> коррупцион ҳолат бўйича хабар берувчи шахснинг маълумотлари қонунчиликда белгиланган тартибда сир сақланади.\n";
  rules += "Сиз юборган маълумотлар масъуллар томонидан белгиланган тартибда кўриб чиқилади.\n\n";
  rules += "❗️ <i>Эслатма: Ўзбекистон Республикаси қонунчилигига мувофиқ, ёлғон, туҳмат ёки асоссиз маълумотларни юбориш жавобгарликка сабаб бўлади.</i>\n\n";
  rules += "Илтимос, фақат ҳақиқий ва текширилган маълумотларни киритинг.";

  await sendMessage(
    chatId,
    rules,
    makeInlineKeyboard([
      [{ text: "✅ Танишдим ва розиман", callback_data: "agree_rules" }],
    ])
  );
}

async function showSubscriptionMessage(chatId, fullName) {
  let msg = `👋 <b>Ассалому алайкум, ${escapeHtml(fullName)}!</b>\n\n`;
  msg += "Ботдан фойдаланиш учун қуйидаги расмий саҳифаларимизга аъзо бўлишингиз шарт:\n\n";
  msg += "1. <a href='https://t.me/Nishonhokimligi'>Нишон ҳокимлиги Telegram</a>\n";
  msg += `2. <a href='${escapeHtml(INSTAGRAM_LINK)}'>Нишон ҳокимлиги Instagram</a>\n\n`;
  msg += "<i>Аъзо бўлгач, <b>«✅ Аъзо бўлдим»</b> тугмасини босинг.</i>";

  await sendMessage(
    chatId,
    msg,
    makeInlineKeyboard([
      [{ text: "🔵 Telegram каналимиз", url: "https://t.me/Nishonhokimligi" }],
      [{ text: "🟣 Instagram саҳифамиз", url: INSTAGRAM_LINK }],
      [{ text: "✅ Аъзо бўлдим / Текшириш", callback_data: "check_subscription" }],
    ])
  );
}

// -----------------------------------------------------------------------------
// CALLBACK QUERY
// -----------------------------------------------------------------------------

async function handleCallbackQuery(callbackQuery) {
  const callbackId = callbackQuery.id;
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const dataText = callbackQuery.data || "";
  const userId = callbackQuery.from.id;
  const fullName = callbackQuery.from.first_name || "Фойдаланувчи";

  if (dataText === "check_subscription") {
    const joined = await checkJoin(userId);

    if (joined) {
      await deleteMessage(chatId, messageId);
      await showRules(chatId);
    } else {
      await answerCallbackQuery(
        callbackId,
        "❌ Сиз ҳали каналга аъзо бўлмадингиз!",
        true
      );
    }

    return;
  }

  if (dataText === "agree_rules") {
    await deleteMessage(chatId, messageId);

    saveUserData(chatId, {
      step: "waiting_appeal_type",
      data: {},
    });

    await showAppealTypeMenu(chatId);

    return;
  }

  if (dataText.startsWith("status_")) {
    const parts = dataText.split("_");
    const action = parts[1];
    const appealId = parts.slice(2).join("_");

    const appealData = getAppeal(appealId);

    if (!appealData) {
      await answerCallbackQuery(callbackId, "Мурожаат топилмади!", true);
      return;
    }

    const currentTime = now();
    const executorName = `${fullName} (${userId})`;
    const appealTypeText = getAppealTypeText(appealData.appeal_type || "appeal");

    let statusInfo = { emoji: "🆕", text: "Янги" };
    let notificationText = "";

    if (action === "doing") {
      appealData.status = "processing";
      appealData.processed_at = currentTime;
      appealData.executor = executorName;

      statusInfo = { emoji: "⏳", text: "Ижрода" };

      notificationText = `⏳ <b>${escapeHtml(appealTypeText)} ҳолати ўзгарди:</b>\n\n`;
      notificationText += "Сизнинг мурожаатингиз масъуллар томонидан <b>ИЖРОГА ОЛИНДИ</b>.\n";
      notificationText += `⏰ Вақти: ${currentTime}\n\n`;
      notificationText += "Тез орада ўрганиб чиқилади.";
    } else if (action === "done") {
      appealData.status = "solved";
      appealData.finished_at = currentTime;
      appealData.final_status = "Ҳал қилинди";
      appealData.final_conclusion = "Мурожаат ижобий ҳал қилинди.";

      statusInfo = { emoji: "✅", text: "Ҳал қилинди" };

      notificationText = `✅ <b>${escapeHtml(appealTypeText)} ҳолати ўзгарди:</b>\n\n`;
      notificationText += "Сизнинг мурожаатингиз <b>ҲАЛ ҚИЛИНДИ</b>.\n";
      notificationText += `⏰ Вақти: ${currentTime}\n\n`;
      notificationText += "Эътиборингиз учун раҳмат!";
    } else if (action === "reject") {
      appealData.status = "rejected";
      appealData.finished_at = currentTime;
      appealData.final_status = "Рад этилди";
      appealData.final_conclusion =
        "Мурожаат маълумотлар нотўғрилиги ёки асоссизлиги сабабли рад этилди.";

      statusInfo = { emoji: "🚫", text: "Рад этилди" };

      notificationText = `🚫 <b>${escapeHtml(appealTypeText)} ҳолати ўзгарди:</b>\n\n`;
      notificationText += "Мурожаатингиз маълумотлар нотўғрилиги ёки асоссизлиги сабабли <b>РАД ЭТИЛДИ</b>.\n";
      notificationText += `⏰ Вақти: ${currentTime}`;
    } else {
      await answerCallbackQuery(callbackId, "Номаълум амал!", true);
      return;
    }

    saveAppeal(appealId, appealData);

    const sheetPayload = makeUpdateSheetPayload(appealId, action, appealData);
    await sendToGoogleSheet(sheetPayload);

    await sendMessage(appealData.user_id, notificationText);

    const updatedReport = generateReport(appealData, appealId, statusInfo);

    await editMessageText(chatId, messageId, updatedReport, statusKeyboard(appealId));

    await answerCallbackQuery(callbackId, `Статус: ${statusInfo.text}`);

    return;
  }
}

// -----------------------------------------------------------------------------
// ODDIY XABARLAR
// -----------------------------------------------------------------------------

async function handleMessage(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = normalizeText(message.text || "");
  const contact = message.contact || null;
  const fullName = message.from.first_name || "Фойдаланувчи";

  let userSession = getUserData(chatId);
  let step = userSession.step || "none";
  let userData = userSession.data || {};

  if (text === "❌ Бекор қилиш") {
    saveUserData(chatId, { step: "none", data: {} });

    await sendMessage(
      chatId,
      "❌ Жараён бекор қилинди. Қайта бошлаш учун /start ни босинг.",
      removeKeyboard()
    );

    return;
  }

  if (text === "/start") {
    const joined = await checkJoin(userId);

    if (joined) {
      await showRules(chatId);
    } else {
      await showSubscriptionMessage(chatId, fullName);
    }

    return;
  }

  if (step !== "none") {
    const joined = await checkJoin(userId);

    if (!joined) {
      saveUserData(chatId, { step: "none", data: {} });

      await sendMessage(
        chatId,
        "⚠️ Сиз каналдан чиқиб кетдингиз! Илтимос, қайта аъзо бўлинг ва /start ни босинг.",
        removeKeyboard()
      );

      return;
    }
  }

  if (step === "waiting_appeal_type") {
    if (text === "📝 Мурожаат йўллаш") {
      userData.appeal_type = "appeal";
      userData.appeal_type_text = "Мурожаат";

      saveUserData(chatId, {
        step: "waiting_name",
        data: userData,
      });

      await sendMessage(
        chatId,
        "😊 <b>Илтимос, Ф.И.Ш ни тўлиқ киритинг.</b>\n<i>Намуна: Алиев Вали Солиевич</i>",
        makeReplyKeyboard([[{ text: "❌ Бекор қилиш" }]])
      );

      return;
    }

    if (text === "🚨 Коррупцион ҳолат бўйича хабар бериш") {
      userData.appeal_type = "corruption";
      userData.appeal_type_text = "Коррупцион ҳолат бўйича хабар";

      saveUserData(chatId, {
        step: "waiting_name",
        data: userData,
      });

      await sendMessage(
        chatId,
        "🔒 <b>Коррупцион ҳолат бўйича хабар бериш</b>\n\nХабар берувчи шахснинг маълумотлари қонунчиликда белгиланган тартибда сир сақланади.\n\n😊 <b>Илтимос, Ф.И.Ш ни тўлиқ киритинг.</b>\n<i>Намуна: Алиев Вали Солиевич</i>",
        makeReplyKeyboard([[{ text: "❌ Бекор қилиш" }]])
      );

      return;
    }

    await showAppealTypeMenu(chatId);
    return;
  }

  if (step === "waiting_name") {
    if (text.length < 5) {
      await sendMessage(
        chatId,
        "⚠️ Илтимос, Ф.И.Ш ни тўлиқроқ ёзинг.\n\nНамуна: Алиев Вали Солиевич"
      );
      return;
    }

    userData.name = text;

    saveUserData(chatId, {
      step: "waiting_dob",
      data: userData,
    });

    await sendMessage(
      chatId,
      "📅 <b>Туғилган кунингизни киритинг.</b>\n\n<i>Намуна: 01.01.2001</i>",
      makeReplyKeyboard([[{ text: "❌ Бекор қилиш" }]])
    );

    return;
  }

  if (step === "waiting_dob") {
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
      userData.dob = text;

      saveUserData(chatId, {
        step: "waiting_gender",
        data: userData,
      });

      await sendMessage(
        chatId,
        "<b>Жинсингизни танланг:</b>",
        makeReplyKeyboard(
          [
            [{ text: "Эркак" }, { text: "Аёл" }],
            [{ text: "❌ Бекор қилиш" }],
          ],
          { one_time_keyboard: true }
        )
      );
    } else {
      await sendMessage(chatId, "⚠️ Сана нотўғри! (Намуна: 01.01.2001)");
    }

    return;
  }

  if (step === "waiting_gender") {
    if (text === "Эркак" || text === "Аёл") {
      userData.gender = text;

      saveUserData(chatId, {
        step: "waiting_passport",
        data: userData,
      });

      await sendMessage(
        chatId,
        "<b>Паспорт серия ва рақамини киритинг.</b>\n\n<i>Намуна: AA1234567</i>",
        makeReplyKeyboard([[{ text: "❌ Бекор қилиш" }]])
      );
    } else {
      await sendMessage(chatId, "Тугмалардан бирини танланг.");
    }

    return;
  }

  if (step === "waiting_passport") {
    const passport = text.toUpperCase();

    if (/^[A-Z]{2}\d{7}$/.test(passport)) {
      userData.passport = passport;

      saveUserData(chatId, {
        step: "waiting_status",
        data: userData,
      });

      await sendMessage(
        chatId,
        "<b>Мақомингизни танланг:</b>",
        makeReplyKeyboard(
          [
            [{ text: "Ишчи" }, { text: "Ўқувчи" }],
            [{ text: "Нафақахўр" }, { text: "Ишсиз" }],
            [{ text: "Хизматчи" }, { text: "Ҳарбий хизматчи" }],
            [{ text: "Талаба" }, { text: "Тадбиркор" }],
            [{ text: "Бошқа" }, { text: "❌ Бекор қилиш" }],
          ],
          { one_time_keyboard: true }
        )
      );
    } else {
      await sendMessage(chatId, "‼️ Паспорт серия хато! (Намуна: AA1234567)");
    }

    return;
  }

  if (step === "waiting_status") {
    if (text.length < 2) {
      await sendMessage(chatId, "⚠️ Илтимос, мақомингизни тўғри танланг.");
      return;
    }

    userData.status_job = text;

    saveUserData(chatId, {
      step: "waiting_mahalla",
      data: userData,
    });

    const buttons = MAHALLA_LIST.map((m) => ({ text: m }));
    buttons.push({ text: "❌ Бекор қилиш" });

    await sendMessage(
      chatId,
      "🏘 <b>Маҳаллангизни рўйхатдан танланг:</b>",
      makeReplyKeyboard(chunkArray(buttons, 2), {
        one_time_keyboard: true,
        input_field_placeholder: "Рўйхатдан танланг",
      })
    );

    return;
  }

  if (step === "waiting_mahalla") {
    if (MAHALLA_LIST.includes(text)) {
      userData.mahalla = text;

      saveUserData(chatId, {
        step: "waiting_address",
        data: userData,
      });

      await sendMessage(
        chatId,
        "🏠 <b>Манзилингизни тўлиқ киритинг.</b>\n\n<i>Намуна: Собиробод маҳалласи, 2-кўча, 14-хонадон</i>",
        makeReplyKeyboard([[{ text: "❌ Бекор қилиш" }]])
      );
    } else {
      const buttons = MAHALLA_LIST.map((m) => ({ text: m }));
      buttons.push({ text: "❌ Бекор қилиш" });

      await sendMessage(
        chatId,
        "🚫 Илтимос, фақат рўйхатдан танланг!",
        makeReplyKeyboard(chunkArray(buttons, 2), { one_time_keyboard: true })
      );
    }

    return;
  }

  if (step === "waiting_address") {
    if (text.length < 5) {
      await sendMessage(chatId, "⚠️ Манзил жуда қисқа. Тўлиқроқ ёзинг.");
      return;
    }

    userData.address = text;

    saveUserData(chatId, {
      step: "waiting_phone",
      data: userData,
    });

    await sendMessage(
      chatId,
      "<b>Телефон рақамингизни юборинг:</b>\n(Пастдаги тугмани босинг)",
      makeReplyKeyboard(
        [
          [{ text: "📱 Рақамни юбориш", request_contact: true }],
          [{ text: "❌ Бекор қилиш" }],
        ],
        { one_time_keyboard: true }
      )
    );

    return;
  }

  if (step === "waiting_phone") {
    const phone = contact ? contact.phone_number : text;

    if (!phone || String(phone).length < 7) {
      await sendMessage(chatId, "⚠️ Телефон рақам нотўғри киритилди.");
      return;
    }

    userData.phone = String(phone);

    saveUserData(chatId, {
      step: "waiting_appeal_text",
      data: userData,
    });

    if (userData.appeal_type === "corruption") {
      await sendMessage(
        chatId,
        "🚨 <b>Коррупцион ҳолат мазмунини киритинг:</b>\n\nИлтимос, ҳолат қаерда, қачон, кимлар иштирокида ва қандай содир бўлганини имкон қадар аниқ баён қилинг.\n\n🔒 <i>Шахсингиз сир сақланади. Маълумотлар қонунчиликда белгиланган тартибда ўрганилади.</i>",
        makeReplyKeyboard([[{ text: "❌ Бекор қилиш" }]])
      );
    } else {
      await sendMessage(
        chatId,
        "📝 <b>Мурожаат матнини киритинг:</b>\n\nИлтимос, муаммо моҳиятини қисқа ва лўнда баён қилинг.",
        makeReplyKeyboard([[{ text: "❌ Бекор қилиш" }]])
      );
    }

    return;
  }

  if (step === "waiting_appeal_text") {
    if (text.length < 10) {
      if (userData.appeal_type === "corruption") {
        await sendMessage(chatId, "⚠️ Хабар матни жуда қисқа. Илтимос, ҳолатни батафсилроқ ёзинг.");
      } else {
        await sendMessage(chatId, "⚠️ Мурожаат матни жуда қисқа. Батафсилроқ ёзинг.");
      }

      return;
    }

    userData.appeal_text = text;
    userData.created_at = now();

    const previewReport = generateReport(userData, "ЯНГИ", {
      emoji: "🆕",
      text: "Янги (Лойиҳа)",
    });

    saveUserData(chatId, {
      step: "confirmation",
      data: userData,
      preview_text: previewReport,
    });

    let confirmText = `${previewReport}\n\n<b>Маълумотлар тўғрими? Тасдиқлаш тугмасини босинг.</b>`;

    if (userData.appeal_type === "corruption") {
      confirmText += "\n\n🔒 <i>Эслатма: коррупцион ҳолат бўйича хабар берган шахснинг маълумотлари сир сақланади.</i>";
    }

    await sendMessage(
      chatId,
      confirmText,
      makeReplyKeyboard(
        [[{ text: "✅ Тасдиқлаш" }, { text: "❌ Бекор қилиш" }]],
        { one_time_keyboard: true }
      )
    );

    return;
  }

  if (step === "confirmation") {
    if (text === "✅ Тасдиқлаш") {
      const appealId = generateAppealId();

      const finalData = {
        ...userData,
        user_id: chatId,
        status: "new",
        created_at: now(),
      };

      saveAppeal(appealId, finalData);

      await sendToGoogleSheet(makeCreateSheetPayload(appealId, finalData));

      if (finalData.appeal_type === "corruption") {
        await sendMessage(
          chatId,
          `✅ <b>Коррупцион ҳолат бўйича хабарингиз қабул қилинди!</b> (№${appealId})\n\nХабарингиз масъулларга юборилди.\n\n🔒 Шахсингиз қонунчиликда белгиланган тартибда сир сақланади.\n\nСтатус ўзгарганда сизга хабар келади.`,
          removeKeyboard()
        );
      } else {
        await sendMessage(
          chatId,
          `✅ <b>Мурожаатингиз қабул қилинди!</b> (№${appealId})\n\nСизнинг мурожаатингиз ҳокимлик девонхонасига юборилди.\n\nСтатус ўзгарганда сизга хабар келади.`,
          removeKeyboard()
        );
      }

      const adminReport = generateReport(finalData, appealId, {
        emoji: "🆕",
        text: "Янги",
      });

      const kb = statusKeyboard(appealId);
      const appealTypeText = getAppealTypeText(finalData.appeal_type || "appeal");

      if (DEVONXONA_ID) {
        await sendMessage(
          DEVONXONA_ID,
          `🔔 <b>Янги ${escapeHtml(appealTypeText)} (Девонхона)!</b>\n\n${adminReport}`,
          kb
        );
      }

      for (const adminId of ADMIN_IDS) {
        if (adminId !== DEVONXONA_ID) {
          await sendMessage(
            adminId,
            `🔔 <b>Янги ${escapeHtml(appealTypeText)}!</b>\n\n${adminReport}`,
            kb
          );
        }
      }

      if (GROUP_ID) {
        await sendMessage(
          GROUP_ID,
          `${getAppealTypeHashTag(finalData.appeal_type || "appeal")} №${appealId}\n\n${adminReport}`,
          kb
        );
      }

      saveUserData(chatId, { step: "none", data: {} });
    } else {
      await sendMessage(
        chatId,
        "⚠️ Илтимос, <b>✅ Тасдиқлаш</b> ёки <b>❌ Бекор қилиш</b> тугмасини босинг."
      );
    }

    return;
  }

  await sendMessage(
    chatId,
    "Ботдан фойдаланиш учун /start ни босинг."
  );
}

function chunkArray(arr, size) {
  const result = [];

  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }

  return result;
}

// -----------------------------------------------------------------------------
// UPDATE HANDLER
// -----------------------------------------------------------------------------

async function handleUpdate(update) {
  try {
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return;
    }

    if (update.message) {
      await handleMessage(update.message);
      return;
    }
  } catch (err) {
    console.error("Update handler error:", err);
  }
}

// -----------------------------------------------------------------------------
// HTTP SERVER
// -----------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Nishon murojaat bot ishlayapti.");
    return;
  }

  if (req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();

      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on("end", async () => {
      try {
        const update = JSON.parse(body || "{}");
        await handleUpdate(update);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        console.error("POST parse error:", err.message);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false }));
      }
    });

    return;
  }

  res.writeHead(405, { "Content-Type": "text/plain" });
  res.end("Method Not Allowed");
});

server.listen(PORT, () => {
  console.log(`Bot server started on port ${PORT}`);
  console.log(`Webhook URL should be: https://YOUR-RENDER-DOMAIN.onrender.com/`);
});
