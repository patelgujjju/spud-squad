/** A short drawing-only burst survives the immediate transition to Results. */
export function exitConfetti(x: number, y: number): void {
  const layer = document.createElement('div');
  layer.className = 'exit-confetti';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  const colors = ['#FF4D4D', '#FFD23F', '#268BFF', '#00B89E', '#A45AEB'];
  for (let i = 0; i < 36; i++) {
    const piece = document.createElement('i');
    piece.style.backgroundColor = colors[i % colors.length]!;
    piece.style.left = x + 'px';
    piece.style.top = y + 'px';
    layer.append(piece);
    const angle = i * 2.39996;
    const distance = 100 + (i % 7) * 28;
    piece.animate(
      [
        { transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 },
        {
          transform:
            'translate(' +
            Math.cos(angle) * distance +
            'px,' +
            (Math.sin(angle) * distance - 80) +
            'px) rotate(' +
            i * 36 +
            'deg)',
          opacity: 1,
          offset: 0.4,
        },
        {
          transform:
            'translate(' +
            Math.cos(angle) * distance * 1.4 +
            'px,' +
            (230 + (i % 5) * 30) +
            'px) rotate(' +
            i * 88 +
            'deg)',
          opacity: 0,
        },
      ],
      { duration: 1400 + (i % 5) * 90, easing: 'ease-out', fill: 'forwards' },
    );
  }
  window.setTimeout(() => layer.remove(), 1900);
}
