/** Render existing recipe content locally; no generation request or external service. */
export interface RitualImageContent {
  goal: string;
  actions: { number: number; instruction: string; image: string }[];
  speech?: string;
  sources: string[];
  adapted: boolean;
}

export async function renderRitualShareImage(content: RitualImageContent): Promise<Blob> {
  await document.fonts.ready;
  await document.fonts.load('48px "Gentium Plus"');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image export is unavailable');
  const width = 1080, margin = 64, inner = width - margin * 2;
  const wrap = (text: string, maxWidth: number, font: string) => {
    ctx.font = font;
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      if (ctx.measureText(line ? `${line} ${word}` : word).width <= maxWidth) { line += `${line ? ' ' : ''}${word}`; continue; }
      if (line) lines.push(line);
      line = '';
      // Long names and unbroken input must not escape the image.
      for (const char of word) {
        if (ctx.measureText(line + char).width > maxWidth && line) { lines.push(line); line = ''; }
        line += char;
      }
    }
    if (line) lines.push(line);
    return lines;
  };
  const titleFont = '52px "Gentium Plus", Georgia, serif';
  const bodyFont = '24px Arial, sans-serif';
  const speechFont = '40px "Gentium Plus", Georgia, serif';
  const smallFont = '21px Arial, sans-serif';
  const titles = wrap(content.goal, inner, titleFont);
  const gap = 24;
  const cardWidth = (inner - gap * (content.actions.length - 1)) / Math.max(1, content.actions.length);
  const labels = content.actions.map(action => wrap(`${action.number}. ${action.instruction}`, cardWidth - 28, bodyFont));
  const cardHeight = 264 + Math.max(0, ...labels.map(lines => lines.length)) * 32;
  const speech = content.speech ? wrap(`“${content.speech}”`, inner - 40, speechFont) : [];
  const sources = wrap(content.sources.join(' · '), inner, smallFont);
  const cardsY = 118 + titles.length * 60;
  const speechY = cardsY + (content.actions.length ? cardHeight + 48 : 0);
  const footerY = speechY + (speech.length ? speech.length * 49 + 56 : 0);
  canvas.width = width;
  canvas.height = footerY + 70 + sources.length * 30 + 64;
  ctx.fillStyle = '#f8f6f0'; ctx.fillRect(0, 0, width, canvas.height);
  const drawLines = (lines: string[], x: number, y: number, font: string, height: number, color = '#292820') => {
    ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'top';
    lines.forEach((line, i) => ctx.fillText(line, x, y + i * height));
  };
  drawLines(['tuppi'], margin, 36, 'italic 30px "Gentium Plus", Georgia, serif', 36, '#805036');
  drawLines(titles, margin, 94, titleFont, 60);
  const images = await Promise.all(content.actions.map(action => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('A ritual image could not be loaded. Please try again.'));
    image.src = action.image;
  })));
  content.actions.forEach((_, i) => {
    const x = margin + i * (cardWidth + gap);
    ctx.fillStyle = '#efede5'; ctx.fillRect(x, cardsY, cardWidth, cardHeight);
    const image = images[i];
    const scale = Math.min((cardWidth - 32) / image.naturalWidth, 224 / image.naturalHeight);
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    ctx.drawImage(image, x + (cardWidth - w) / 2, cardsY + 16 + (224 - h) / 2, w, h);
    drawLines(labels[i], x + 14, cardsY + 252, bodyFont, 32);
  });
  if (speech.length) {
    ctx.fillStyle = '#805036'; ctx.fillRect(margin, speechY, 3, speech.length * 49);
    drawLines(speech, margin + 24, speechY, speechFont, 49);
  }
  ctx.strokeStyle = '#cec5b5'; ctx.beginPath(); ctx.moveTo(margin, footerY); ctx.lineTo(width - margin, footerY); ctx.stroke();
  drawLines([content.adapted ? 'Modern adaptation · composed words' : 'Source sequence'], margin, footerY + 24, smallFont, 30, '#746b5e');
  drawLines(sources, margin, footerY + 62, smallFont, 30, '#746b5e');
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image export failed')), 'image/png'));
}
