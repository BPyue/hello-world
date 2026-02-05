const STORAGE_KEY = "drift-bottles-v2";

const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
const throwForm = document.getElementById("throwForm");
const messageInput = document.getElementById("message");
const moodInput = document.getElementById("mood");
const counter = document.getElementById("counter");
const pickBtn = document.getElementById("pickBtn");
const replyBtn = document.getElementById("replyBtn");
const reportBtn = document.getElementById("reportBtn");
const voiceBtn = document.getElementById("voiceBtn");
const voiceHint = document.getElementById("voiceHint");
const pickedBottle = document.getElementById("pickedBottle");
const myBottles = document.getElementById("myBottles");
const myEmpty = document.getElementById("myEmpty");
const toast = document.getElementById("toast");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let lastPickedId = null;
let recognition = null;
let isListening = false;

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadBottles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBottles(bottles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bottles));
}

function showToast(text) {
  toast.textContent = text;
  window.setTimeout(() => {
    if (toast.textContent === text) {
      toast.textContent = "";
    }
  }, 2200);
}

function formatTime(ts) {
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function updateCounter() {
  counter.textContent = messageInput.value.length;
}

function renderMine() {
  const mine = loadBottles().filter((bottle) => bottle.mine);
  myBottles.innerHTML = "";

  if (mine.length === 0) {
    myEmpty.hidden = false;
    return;
  }

  myEmpty.hidden = true;

  mine
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach((bottle) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div>${bottle.message}</div>
        <div class="bottle-meta">#${bottle.mood} · ${formatTime(bottle.createdAt)} · 回复 ${bottle.replies.length}</div>
      `;
      myBottles.appendChild(li);
    });
}

function renderPickedBottle(bottle) {
  if (!bottle) {
    pickedBottle.classList.add("empty-state");
    pickedBottle.innerHTML = `
      <h2>海面平静中</h2>
      <p>点击下方按钮，随机捞一个陌生人的漂流瓶。</p>
    `;
    replyBtn.disabled = true;
    reportBtn.disabled = true;
    return;
  }

  pickedBottle.classList.remove("empty-state");
  pickedBottle.innerHTML = `
    <h2>捞到了一个匿名漂流瓶</h2>
    <p>${bottle.message}</p>
    <p class="bottle-meta">心情：${bottle.mood} · ${formatTime(bottle.createdAt)}</p>
    <p class="bottle-meta">已有匿名回复：${bottle.replies.length} · 举报次数：${bottle.reports.length}</p>
  `;
  replyBtn.disabled = false;
  reportBtn.disabled = false;
}

function pickRandomBottle() {
  const pool = loadBottles().filter((bottle) => !bottle.mine);
  if (pool.length === 0) {
    renderPickedBottle(null);
    showToast("还没有陌生人的瓶子，先投一个吧！");
    return;
  }

  const item = pool[Math.floor(Math.random() * pool.length)];
  lastPickedId = item.id;
  renderPickedBottle(item);
}

function seedStrangerBottlesIfNeeded(bottles) {
  const strangers = bottles.filter((item) => !item.mine);
  if (strangers.length > 0) {
    return bottles;
  }

  return [
    ...bottles,
    {
      id: makeId(),
      message: "希望明天会更好。",
      mood: "期待",
      mine: false,
      replies: [],
      reports: [],
      createdAt: Date.now() - 1000 * 60 * 45,
    },
    {
      id: makeId(),
      message: "今天在地铁上被陌生人的善意治愈了。",
      mood: "开心",
      mine: false,
      replies: ["也祝你每天都被温柔相待！"],
      reports: [],
      createdAt: Date.now() - 1000 * 60 * 120,
    },
  ];
}

function initVoiceRecognition() {
  if (!SpeechRecognition) {
    voiceHint.textContent = "当前浏览器不支持语音输入，请改用手动输入。";
    voiceBtn.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => {
    isListening = true;
    voiceBtn.textContent = "🛑 停止语音输入";
    voiceHint.textContent = "正在聆听，请开始说话...";
  };

  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript?.trim() || "";
    if (!transcript) {
      return;
    }

    const next = `${messageInput.value} ${transcript}`.trim().slice(0, 200);
    messageInput.value = next;
    updateCounter();
    showToast("语音转文字成功");
  };

  recognition.onerror = () => {
    showToast("语音输入失败，请重试");
  };

  recognition.onend = () => {
    isListening = false;
    voiceBtn.textContent = "🎙️ 语音输入";
    voiceHint.textContent = "点击开始语音转文字（浏览器支持时可用）";
  };

  voiceBtn.addEventListener("click", () => {
    if (!recognition) {
      return;
    }
    if (isListening) {
      recognition.stop();
      return;
    }
    recognition.start();
  });
}

function ensureBottleShape(bottle) {
  return {
    ...bottle,
    replies: Array.isArray(bottle.replies) ? bottle.replies : [],
    reports: Array.isArray(bottle.reports) ? bottle.reports : [],
  };
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((node) => node.classList.remove("is-active"));
    panels.forEach((node) => node.classList.remove("is-active"));

    tab.classList.add("is-active");
    const panel = document.getElementById(tab.dataset.tab);
    panel.classList.add("is-active");
  });
});

messageInput.addEventListener("input", updateCounter);

throwForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();

  if (!message) {
    showToast("内容不能为空");
    return;
  }

  let bottles = loadBottles().map(ensureBottleShape);
  bottles.push({
    id: makeId(),
    message,
    mood: moodInput.value,
    mine: true,
    replies: [],
    reports: [],
    createdAt: Date.now(),
  });

  bottles = seedStrangerBottlesIfNeeded(bottles);

  saveBottles(bottles);
  throwForm.reset();
  updateCounter();
  renderMine();
  showToast("漂流瓶已投入大海 🌊");
});

pickBtn.addEventListener("click", pickRandomBottle);

replyBtn.addEventListener("click", () => {
  if (!lastPickedId) {
    showToast("请先捞一个漂流瓶");
    return;
  }

  const reply = window.prompt("输入匿名回复（最多60字）");
  const clean = reply ? reply.trim().slice(0, 60) : "";
  if (!clean) {
    return;
  }

  const bottles = loadBottles().map(ensureBottleShape);
  const target = bottles.find((bottle) => bottle.id === lastPickedId);
  if (!target) {
    showToast("这个漂流瓶已经漂走啦");
    return;
  }

  target.replies.push(clean);
  saveBottles(bottles);
  renderPickedBottle(target);
  renderMine();
  showToast("匿名回复发送成功");
});

reportBtn.addEventListener("click", () => {
  if (!lastPickedId) {
    showToast("请先捞一个漂流瓶");
    return;
  }

  const reason = window.prompt("请输入举报原因（最多80字）", "违规内容/骚扰/广告等");
  const clean = reason ? reason.trim().slice(0, 80) : "";
  if (!clean) {
    showToast("已取消举报");
    return;
  }

  const bottles = loadBottles().map(ensureBottleShape);
  const target = bottles.find((bottle) => bottle.id === lastPickedId);
  if (!target) {
    showToast("该瓶子不存在或已被处理");
    return;
  }

  target.reports.push({
    reason: clean,
    createdAt: Date.now(),
  });

  saveBottles(bottles);
  renderPickedBottle(target);
  showToast("举报已提交，我们会尽快处理");
});

function bootstrap() {
  const normalized = loadBottles().map(ensureBottleShape);
  saveBottles(normalized);
  renderMine();
  renderPickedBottle(null);
  initVoiceRecognition();
}

bootstrap();
