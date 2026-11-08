"use strict";
// Todos los datos viven en memoria. No se realizan peticiones de red.
const $ = (id) => document.getElementById(id);
const canvas = $("canvas");
const ctx = canvas.getContext("2d");
let picture = null;
let loadVersion = 0;
let toastTimer;
const controls = ["title", "prompt", "tool", "ratio", "level", "accent", "format"];
const palettes = { dark: { bg: "#182321", text: "#f5f7f0", muted: "#bbc7be" }, light: { bg: "#fafbf5", text: "#202d26", muted: "#55634f" } };

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 2400);
}

// Divide las palabras demasiado largas y conserva los saltos de línea del prompt.
function wrap(text, width, size, weight = 400) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  const lines = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) { lines.push(""); continue; }
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      if (ctx.measureText(line ? `${line} ${word}` : word).width <= width) {
        line = line ? `${line} ${word}` : word;
        continue;
      }
      if (line) { lines.push(line); line = ""; }
      for (const char of word) {
        if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = ""; }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawText(lines, x, y, size, color, weight = 400) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, y + i * size * 1.4);
}

function imageArea(x, y, w, h, accent) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (picture) {
    // La copia del fondo se recorta; la imagen principal siempre se ve completa.
    const cover = Math.max(w / picture.width, h / picture.height) * 1.13;
    ctx.filter = `blur(${Math.max(18, w * .025)}px)`;
    ctx.drawImage(picture, x + (w - picture.width * cover) / 2, y + (h - picture.height * cover) / 2, picture.width * cover, picture.height * cover);
    ctx.filter = "none";
    ctx.fillStyle = "#00000035"; ctx.fillRect(x, y, w, h);
    const contain = Math.min(w / picture.width, h / picture.height);
    ctx.drawImage(picture, x + (w - picture.width * contain) / 2, y + (h - picture.height * contain) / 2, picture.width * contain, picture.height * contain);
  } else {
    const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
    gradient.addColorStop(0, "#354b3c"); gradient.addColorStop(1, "#162923");
    ctx.fillStyle = gradient; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent; ctx.globalAlpha = .3; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + w * .5, y + h * .5, Math.min(w, h) * (.12 + i * .075), 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    drawText(["Tu próxima creación", "empieza aquí."], x + w / 2, y + h * .43, Math.min(w, h) * .06, "#e5efdb", 500);
    ctx.textAlign = "left";
  }
  ctx.restore();
}

function render() {
  const [w, h] = $("format").value.split(",").map(Number);
  canvas.width = w; canvas.height = h;
  ctx.textBaseline = "top";
  const accent = $("accent").value;
  const theme = document.querySelector('input[name="theme"]:checked').value;
  const rgb = accent.match(/\w\w/g).map(v => parseInt(v, 16));
  const ink = (rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114) > 155 ? "#15231b" : "#ffffff";
  const p = theme === "color" ? { bg: accent, text: ink, muted: ink } : palettes[theme];
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, w, h);
  const pad = Math.round(Math.min(w, h) * .05);
  const landscape = w > h;
  let tx, ty, tw, th;
  if (landscape) {
    imageArea(pad, pad, w * .52, h - pad * 2, accent);
    tx = w * .52 + pad * 1.65; ty = pad; tw = w - tx - pad; th = h - pad * 2;
  } else {
    const ih = Math.round(h * (h / w > 1.5 ? .49 : .45));
    imageArea(pad, pad, w - 2 * pad, ih, accent);
    tx = pad; ty = pad + ih + pad * .65; tw = w - pad * 2; th = h - ty - pad;
  }
  const base = Math.min(w, h);
  const title = $("title").value.trim() || "Una idea, infinitas posibilidades";
  const prompt = $("prompt").value.trim() || "Aquí aparecerá el prompt de tu imagen. Cuenta tu proceso y comparte la idea que lo hizo posible.";
  const footerSize = base * .017;
  const labelSize = base * .014;
  const bottom = ty + th;
  // El título y el prompt se ajustan juntos para conservar todo el contenido.
  let titleSize = base * .041, promptSize = base * .024;
  let titleLines, promptLines, contentHeight;
  const available = th - base * .125;
  for (let tries = 0; tries < 500; tries++) {
    titleLines = wrap(title, tw, titleSize, 650);
    promptLines = wrap(prompt, tw, promptSize);
    contentHeight = titleLines.length * titleSize * 1.4 + base * .047 + promptLines.length * promptSize * 1.4;
    if (contentHeight <= available) break;
    titleSize *= .97; promptSize *= .97;
  }
  ctx.fillStyle = theme === "color" ? p.text : accent;
  ctx.fillRect(tx, ty, base * .05, 4);
  const titleY = ty + base * .022;
  drawText(titleLines, tx, titleY, titleSize, p.text, 650);
  const labelY = titleY + titleLines.length * titleSize * 1.4 + base * .012;
  drawText(["EL PROMPT"], tx, labelY, labelSize, p.muted, 650);
  drawText(promptLines, tx, labelY + base * .027, promptSize, p.muted);
  const ratio = $("ratio").value === "auto" ? detectedRatio() : $("ratio").value;
  const metadata = `${$("tool").value}  ·  Uso de IA: ${$("level").value}  ·  ${ratio}`;
  ctx.font = `500 ${footerSize}px system-ui, sans-serif`;
  const metadataSize = Math.min(footerSize, footerSize * tw / ctx.measureText(metadata).width);
  drawText([metadata], tx, bottom - base * .067, metadataSize, p.muted, 500);
  ctx.fillStyle = p.muted; ctx.globalAlpha = .25; ctx.fillRect(tx, bottom - base * .031, tw, 1); ctx.globalAlpha = 1;
  drawText(["Mi Portafolio IA"], tx, bottom - footerSize, footerSize, p.text, 650);
  $("dimensions").textContent = `${w} × ${h} px`;
  $("accentValue").textContent = accent.toUpperCase();
  $("textStatus").textContent = promptSize < base * .018 ? "Este prompt es muy largo: se conserva completo, pero la letra será pequeña. Prueba el formato 9:16 o resume el texto para mejorar la lectura." : "";
}

function detectedRatio() {
  if (!picture) return "Ratio automático";
  let a = picture.width, b = picture.height;
  while (b) [a, b] = [b, a % b];
  return `${picture.width / a}:${picture.height / a}`;
}

async function loadImage(file) {
  if (!file) return;
  const version = ++loadVersion;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { $("imageStatus").textContent = "Elige una imagen JPG, PNG o WEBP válida."; return; }
  const url = URL.createObjectURL(file);
  const candidate = new Image();
  try {
    candidate.src = url;
    await candidate.decode();
    if (version !== loadVersion) return;
    picture = candidate;
    $("fileLabel").textContent = file.name;
    $("imageStatus").textContent = `${picture.width} × ${picture.height} px · Imagen lista. Puedes cambiarla cuando quieras.`;
    $("download").disabled = false;
    render();
  } catch { if (version === loadVersion) $("imageStatus").textContent = "No pudimos leer esta imagen. Prueba con otro archivo."; }
  finally { URL.revokeObjectURL(url); $("imageInput").value = ""; }
}

controls.forEach(id => $(id).addEventListener("input", render));
document.querySelectorAll('input[name="theme"]').forEach(el => el.addEventListener("change", render));
$("imageInput").addEventListener("change", e => loadImage(e.target.files[0]));
const zone = $("dropzone");
["dragenter", "dragover"].forEach(name => zone.addEventListener(name, e => { e.preventDefault(); zone.classList.add("dragging"); }));
["dragleave", "drop"].forEach(name => zone.addEventListener(name, e => { e.preventDefault(); zone.classList.remove("dragging"); }));
zone.addEventListener("drop", e => loadImage(e.dataTransfer.files[0]));
// Evita que el navegador abra un archivo si cae fuera del área de carga.
window.addEventListener("dragover", e => e.preventDefault());
window.addEventListener("drop", e => e.preventDefault());
$("copy").addEventListener("click", async () => {
  const text = $("prompt").value;
  if (!text.trim()) { toast("Escribe un prompt primero"); return; }
  try {
    if (!navigator.clipboard) throw new Error("Usar alternativa local");
    await navigator.clipboard.writeText(text);
  } catch {
    // Alternativa para navegadores que restringen el portapapeles en archivos locales.
    const previous = document.activeElement;
    $("prompt").focus(); $("prompt").select();
    const copied = document.execCommand("copy");
    previous?.focus();
    if (!copied) { toast("Selecciona el prompt y presiona Ctrl+C para copiarlo"); return; }
  }
  $("copy").textContent = "Copiado"; toast("Copiado");
  setTimeout(() => $("copy").textContent = "Copiar prompt", 2000);
});
$("download").addEventListener("click", () => {
  if (!picture) return;
  render();
  canvas.toBlob(blob => {
    if (!blob) { toast("No se pudo generar el PNG. Inténtalo de nuevo."); return; }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const name = ($("title").value.trim() || "mi-portafolio-ia").replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").slice(0, 80);
    link.download = `${name}-${canvas.width}x${canvas.height}.png`;
    link.href = url; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast("PNG generado");
  }, "image/png");
});
render();
