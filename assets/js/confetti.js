/* Vanilla JS Confetti — no dependencies */
(function() {
  'use strict';

  const COLORS = ['#00b8d4','#ff8c42','#22c55e','#f59e0b','#a78bfa','#f472b6','#ffffff'];
  let canvas, ctx, particles = [], animId = null;

  function ensureCanvas() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'confetti-canvas';
      canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
      document.body.appendChild(canvas);
    }
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx = canvas.getContext('2d');
  }

  function Particle(x, y) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 8;
    this.vy = -Math.random() * 9 - 4;
    this.w  = Math.random() * 8 + 4;
    this.h  = Math.random() * 4 + 2;
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.rot = Math.random() * Math.PI * 2;
    this.rotV = (Math.random() - 0.5) * 0.3;
    this.gravity = 0.25;
    this.alpha = 1;
    this.decay  = Math.random() * 0.01 + 0.005;
  }

  Particle.prototype.update = function() {
    this.vy  += this.gravity;
    this.x   += this.vx;
    this.y   += this.vy;
    this.rot += this.rotV;
    this.alpha -= this.decay;
  };

  Particle.prototype.draw = function(c) {
    c.save();
    c.translate(this.x, this.y);
    c.rotate(this.rot);
    c.globalAlpha = Math.max(0, this.alpha);
    c.fillStyle = this.color;
    c.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    c.restore();
  };

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.alpha > 0 && p.y < canvas.height + 20);
    particles.forEach(p => { p.update(); p.draw(ctx); });
    if (particles.length > 0) {
      animId = requestAnimationFrame(loop);
    } else {
      if (canvas) canvas.style.display = 'none';
      animId = null;
    }
  }

  window.Confetti = {
    burst: function(x, y, count) {
      ensureCanvas();
      canvas.style.display = 'block';
      x = x || window.innerWidth  / 2;
      y = y || window.innerHeight / 3;
      count = count || 80;
      for (let i = 0; i < count; i++) {
        particles.push(new Particle(x + (Math.random() - 0.5) * 60, y));
      }
      if (!animId) loop();
    },
    stop: function() {
      particles = [];
      if (animId) { cancelAnimationFrame(animId); animId = null; }
      if (canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  window.addEventListener('resize', function() {
    if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  });
})();
