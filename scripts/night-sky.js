(function () {
  if (!document.body) return;

  const themeKey = 'tree-theme';
  const savedTheme = localStorage.getItem(themeKey);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldUseDark = savedTheme ? savedTheme === 'dark' : prefersDark;
  if (shouldUseDark && !document.body.classList.contains('theme-dark')) {
    document.body.classList.add('theme-dark');
  }

  const layers = [
    {
      className: 'night-sky__layer layer-1',
      depth: 0.08,
      density: 0.00018,
      size: [0.7, 1.8],
      alpha: [0.55, 0.92],
      glowChance: 0.12,
      sparkleChance: 0.07,
      colors: [
        [255, 255, 255],
        [189, 220, 255],
        [255, 234, 196]
      ],
      drawGalaxy: true
    },
    {
      className: 'night-sky__layer layer-2',
      depth: 0.2,
      density: 0.00011,
      size: [0.85, 1.95],
      alpha: [0.34, 0.72],
      glowChance: 0.08,
      sparkleChance: 0.04,
      colors: [
        [245, 248, 255],
        [160, 205, 255],
        [215, 187, 255]
      ]
    },
    {
      className: 'night-sky__layer layer-3',
      depth: 0.34,
      density: 0.00008,
      size: [1.0, 2.4],
      alpha: [0.24, 0.58],
      glowChance: 0.05,
      sparkleChance: 0.02,
      colors: [
        [255, 255, 255],
        [170, 214, 255],
        [255, 242, 214]
      ]
    }
  ];

  function randomBetween(random, min, max) {
    return min + random() * (max - min);
  }

  function colorWithAlpha(rgb, alpha) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`;
  }

  function drawNebulaGlow(ctx, width, height, options) {
    const gradient = ctx.createRadialGradient(
      width * options.x,
      height * options.y,
      0,
      width * options.x,
      height * options.y,
      Math.max(width, height) * options.radius
    );
    gradient.addColorStop(0, options.inner);
    gradient.addColorStop(0.45, options.middle);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawGalaxyBackdrop(ctx, width, height) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    drawNebulaGlow(ctx, width, height, {
      x: 0.18,
      y: 0.18,
      radius: 0.24,
      inner: 'rgba(140, 182, 255, 0.18)',
      middle: 'rgba(88, 132, 255, 0.08)'
    });

    drawNebulaGlow(ctx, width, height, {
      x: 0.78,
      y: 0.16,
      radius: 0.2,
      inner: 'rgba(196, 132, 255, 0.14)',
      middle: 'rgba(119, 76, 255, 0.08)'
    });

    drawNebulaGlow(ctx, width, height, {
      x: 0.54,
      y: 0.66,
      radius: 0.28,
      inner: 'rgba(104, 182, 255, 0.12)',
      middle: 'rgba(55, 118, 216, 0.06)'
    });

    ctx.translate(width * 0.54, height * 0.48);
    ctx.rotate(-0.42);
    ctx.scale(1.34, 0.34);
    ctx.filter = 'blur(22px)';

    const band = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.34);
    band.addColorStop(0, 'rgba(255, 255, 255, 0.24)');
    band.addColorStop(0.18, 'rgba(194, 220, 255, 0.2)');
    band.addColorStop(0.42, 'rgba(126, 142, 255, 0.12)');
    band.addColorStop(0.68, 'rgba(172, 110, 255, 0.08)');
    band.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = band;
    ctx.beginPath();
    ctx.arc(0, 0, width * 0.34, 0, Math.PI * 2);
    ctx.fill();

    ctx.filter = 'none';
    ctx.restore();
  }

  function drawStars(canvas, config, width, height, random) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (config.drawGalaxy) {
      drawGalaxyBackdrop(ctx, width, height);
    }

    const area = width * height;
    const count = Math.max(80, Math.round(area * config.density));
    for (let i = 0; i < count; i += 1) {
      const x = randomBetween(random, 0, width);
      const y = randomBetween(random, 0, height);
      const r = randomBetween(random, config.size[0], config.size[1]);
      const alpha = randomBetween(random, config.alpha[0], config.alpha[1]);
      const color = config.colors[Math.floor(random() * config.colors.length)];
      const isGlowing = random() < config.glowChance;
      const isSparkling = r > 1.3 && random() < config.sparkleChance;

      if (isGlowing) {
        ctx.beginPath();
        ctx.fillStyle = colorWithAlpha(color, alpha * 0.16);
        ctx.arc(x, y, r * 3.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.fillStyle = colorWithAlpha(color, alpha);
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      if (isSparkling) {
        ctx.strokeStyle = colorWithAlpha(color, alpha * 0.5);
        ctx.lineWidth = 0.65;
        ctx.beginPath();
        ctx.moveTo(x - r * 2.4, y);
        ctx.lineTo(x + r * 2.4, y);
        ctx.moveTo(x, y - r * 2.4);
        ctx.lineTo(x, y + r * 2.4);
        ctx.stroke();
      }
    }
  }

  function initSky() {
    if (document.body.querySelector('.night-sky')) return;

    const skyEl = document.createElement('div');
    skyEl.className = 'night-sky';
    skyEl.setAttribute('aria-hidden', 'true');

    const layerEls = layers.map((layer) => {
      const canvas = document.createElement('canvas');
      canvas.className = layer.className;
      canvas.dataset.depth = String(layer.depth);
      skyEl.appendChild(canvas);
      return canvas;
    });

    document.body.prepend(skyEl);

    function applySkyVisibility() {
      const isDark = document.body.classList.contains('theme-dark');
      skyEl.style.opacity = isDark ? '1' : '0';
    }

    applySkyVisibility();

    if (window.MutationObserver) {
      const observer = new MutationObserver((entries) => {
        for (const entry of entries) {
          if (entry.attributeName === 'class') {
            applySkyVisibility();
            break;
          }
        }
      });
      observer.observe(document.body, { attributes: true });
    }

    function getCanvasSize() {
      const doc = document.documentElement;
      const width = Math.max(doc.scrollWidth, doc.clientWidth, window.innerWidth || 0, document.body.scrollWidth || 0);
      const height = Math.max(doc.scrollHeight, doc.clientHeight, window.innerHeight || 0, document.body.scrollHeight || 0);
      return { width: Math.max(1, width), height: Math.max(1, height) };
    }

    function resizeCanvases() {
      const ratio = window.devicePixelRatio || 1;
      const { width, height } = getCanvasSize();
      layerEls.forEach((canvas, index) => {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        const layerRandom = Math.random;
        drawStars(canvas, layers[index], width, height, layerRandom);
      });
    }

    resizeCanvases();

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    function onMouseMove(e) {
      const rect = { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 };
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Normalize to -1 to 1 range
      targetX = (e.clientX - rect.left - centerX) / centerX;
      targetY = (e.clientY - rect.top - centerY) / centerY;
      
      // Clamp values
      targetX = Math.max(-1, Math.min(1, targetX));
      targetY = Math.max(-1, Math.min(1, targetY));
    }

    function animate() {
      // Smooth easing (lerp with factor 0.08 for smooth movement)
      const ease = 0.08;
      currentX += (targetX - currentX) * ease;
      currentY += (targetY - currentY) * ease;

      layerEls.forEach((canvas, index) => {
        const depth = layers[index].depth;
        // Subtle movement - max 20 pixels
        const maxMove = 20;
        const moveX = currentX * depth * maxMove;
        const moveY = currentY * depth * maxMove;
        canvas.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
      });

      requestAnimationFrame(animate);
    }

    animate();

    window.addEventListener('mousemove', onMouseMove);

    window.addEventListener('resize', resizeCanvases);
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => resizeCanvases());
      resizeObserver.observe(document.documentElement);
    }
  }

  initSky();
})();
