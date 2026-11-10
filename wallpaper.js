"use strict";

const scene = document.getElementById("scene");
const dateLabel = document.getElementById("date");
const clock = document.getElementById("clock");
const seconds = document.getElementById("seconds");
const media = document.getElementById("media");
const titleLabel = document.getElementById("track");
const artistLabel = document.getElementById("artist");
const canvas = document.getElementById("wave");
const ctx = canvas.getContext("2d");
const weekday = "日一二三四五六";
const pad = value => String(value).padStart(2, "0");

function updateClock() {
  const now = new Date();
  dateLabel.textContent = (now.getMonth() + 1) + "月" + now.getDate() + "日　星期" + weekday[now.getDay()];
  clock.textContent = pad(now.getHours()) + ":" + pad(now.getMinutes());
  seconds.textContent = pad(now.getSeconds());
  setTimeout(updateClock, 1005 - now.getMilliseconds());
}
updateClock();

let mediaEnabled = true;
let song = "", artist = "", playback = "unknown";
let lastAudible = -Infinity;
let audibleSince = -Infinity;
let hostPaused = false;
const thought = document.getElementById("thought");
const thoughtText = thought.querySelector("span");
const thoughts = [
  "刚才那片银杏，是不是跟了我两站？",
  "围巾暖好了，再眯一小会儿。",
  "梦里那片海，怎么也报站呀。",
  "今天先把自己调成省电模式。",
  "风从帽沿钻进来了，头鳍先知道。",
  "嘀。原来鲸鱼上岸也要刷卡。",
  "明早的豆浆，还是要热乎的。",
  "车开得好轻。梦里的海也这么晃。",
  "玻璃里还有一条我。她也困了。",
  "那盏路灯，好像一只发光的水母。",
  "回去把这片叶子夹进书里吧。",
  "谁的烤红薯这么香……我都快醒了。",
  "数到第七盏路灯……刚才算到哪儿了？",
  "我把尾巴收好啦，旁边还能坐人。",
  "要是坐过站，就多看一段北京。",
  "月亮也靠窗。它在哪一站下呢？",
  "围巾上还留着中午那点太阳。",
  "我算过了，再眯一站刚刚好。",
  "刚才梦到下雪了，落进海里一点声响也没有。",
  "等红灯的工夫，够梦见一条小鱼。",
  "想家了。回去给家里拨个电话。",
  "谁把月亮落在护城河里了？",
  "车窗上的雾，刚好够我画一条鲸。",
  "前面那盏亮着的窗，和我家的颜色一样。"
];
let deck = [], previousThought = "", thoughtTimer = 0, dreaming = false;

function revealThought() {
  if (!deck.length) {
    deck = thoughts.slice();
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    if (deck[deck.length - 1] === previousThought) {
      [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1], deck[0]];
    }
  }
  previousThought = deck.pop();
  thoughtText.textContent = previousThought;
  thought.classList.add("visible");
  thoughtTimer = setTimeout(() => {
    thought.classList.remove("visible");
    thoughtTimer = setTimeout(revealThought, 15000 + Math.random() * 10000);
  }, 9000);
}

function setDreaming(enabled) {
  if (enabled === dreaming) return;
  dreaming = enabled;
  clearTimeout(thoughtTimer);
  thought.classList.remove("visible");
  if (dreaming) thoughtTimer = setTimeout(revealThought, 850);
}

function showMedia() {
  const available = playback !== "stopped" && playback !== "paused";
  const named = available && mediaEnabled && song;
  const sounding = available && lastAudible - audibleSince >= 1250 && performance.now() - lastAudible < 1000;
  const mode = named || sounding ? "playing" : "idle";
  const title = named ? song : sounding ? "系统音频" : "";
  const byline = named ? artist : "";
  if (media.dataset.mode !== mode) media.dataset.mode = mode;
  if (titleLabel.textContent !== title) titleLabel.textContent = title;
  if (artistLabel.textContent !== byline) artistLabel.textContent = byline;
  setDreaming(mode === "idle" && !hostPaused && !document.hidden);
}

// Wallpaper Engine supplies 64 frequency bands per stereo channel. The graph
// scrolls their measured energy over time, with left above and right below.
const points = 88;
const left = new Float32Array(points), right = new Float32Array(points);
let head = 0, peakL = 0, peakR = 0, activeUntil = 0, frame = 0, lastSample = 0;
let recentL = 0, recentR = 0;
const interval = 1000 / 25;
let width = 1, height = 1;

function resizeWave() {
  width = canvas.clientWidth || 1;
  height = canvas.clientHeight || 1;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  paint();
}

function paint() {
  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.strokeStyle = "rgba(232,192,139,.38)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  const mid = height / 2;
  for (let i = 0; i < points; i++) {
    const index = (head + i) % points;
    if (left[index] + right[index] < .008) continue;
    const x = width * (i + .5) / points;
    ctx.moveTo(x, mid - mid * .94 * left[index]);
    ctx.lineTo(x, mid + mid * .94 * right[index]);
  }
  ctx.strokeStyle = "rgba(248,207,148,.88)";
  ctx.lineWidth = Math.min(3, Math.max(1.2, width / points * .39));
  ctx.lineCap = "round";
  ctx.stroke();
}

function animate(now) {
  frame = 0;
  if (hostPaused || document.hidden) return;
  if (now - lastSample >= interval) {
    const hold = Math.exp(-Math.max(0, now - lastAudible - 48) / 74);
    left[head] = Math.max(peakL, recentL * hold);
    right[head] = Math.max(peakR, recentR * hold);
    peakL = peakR = 0;
    head = (head + 1) % points;
    lastSample = now - ((now - lastSample) % interval);
    showMedia();
    paint();
  }
  if (now < activeUntil) frame = requestAnimationFrame(animate);
  else {
    left.fill(0); right.fill(0);
    paint();
    showMedia();
  }
}

function audioLevels(bands) {
  if (!bands || bands.length < 128 || hostPaused || document.hidden) return;
  let energyL = 0, energyR = 0;
  for (let i = 0; i < 64; i++) {
    const l = Math.max(0, Number(bands[i]) || 0), r = Math.max(0, Number(bands[64+i]) || 0);
    energyL += l*l;
    energyR += r*r;
  }
  const level = energy => Math.min(1, Math.log1p(5 * Math.sqrt(energy / 64)) / Math.log(4));
  if (Math.max(energyL, energyR) < 0.00001) return;
  recentL = level(energyL);
  recentR = level(energyR);
  peakL = Math.max(peakL, recentL);
  peakR = Math.max(peakR, recentR);
  const now = performance.now();
  if (now - lastAudible > 1000) audibleSince = now;
  lastAudible = now;
  activeUntil = lastAudible + interval * (points + 2);
  if (!frame) frame = requestAnimationFrame(animate);
}

function register(hook, listener) {
  if (typeof window[hook] === "function") window[hook](listener);
}
register("wallpaperRegisterAudioListener", audioLevels);
register("wallpaperRegisterMediaStatusListener", event => {
  mediaEnabled = Boolean(event.enabled);
  if (!mediaEnabled) { song = artist = ""; playback = "unknown"; }
  showMedia();
});
register("wallpaperRegisterMediaPropertiesListener", event => {
  song = (event.title || "").trim();
  artist = (event.artist || event.albumArtist || "").trim();
  showMedia();
});
register("wallpaperRegisterMediaPlaybackListener", event => {
  const api = window.wallpaperMediaIntegration || {};
  const states = api.playback || {};
  const stopped = api.PLAYBACK_STOPPED ?? states.STOPPED ?? 0;
  const paused = api.PLAYBACK_PAUSED ?? states.PAUSED ?? 2;
  playback = event.state === stopped ? "stopped" : event.state === paused ? "paused" : "playing";
  if (playback !== "playing") lastAudible = -Infinity;
  if (playback === "stopped") { song = artist = ""; }
  showMedia();
});

function syncVisibility() {
  if (hostPaused || document.hidden) {
    scene.pause();
    if (frame) cancelAnimationFrame(frame);
    frame = head = peakL = peakR = recentL = recentR = 0;
    activeUntil = 0; lastAudible = -Infinity;
    left.fill(0); right.fill(0);
    paint();
  } else {
    scene.play().catch(() => {});
  }
  showMedia();
}
window.wallpaperPropertyListener = {
  setPaused(paused) { hostPaused = paused; syncVisibility(); }
};
document.addEventListener("visibilitychange", syncVisibility);
window.addEventListener("resize", resizeWave);
resizeWave();
showMedia();
