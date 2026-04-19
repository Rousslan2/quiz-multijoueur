/**
 * Stack Tower — logique adaptée de
 * https://github.com/TrinitroToluen0/stack-tower-game (MIT-style usage)
 * Bloc qui rebondit en haut, clic/Espace pour le faire tomber, découpe si mal aligné, game over si totalement à côté.
 */
(function () {
  var MODES = { FALL: 'FALL', BOUNCE: 'BOUNCE', GAME_OVER: 'GAME_OVER' };

  function SkylineStackGame(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.BOX_HEIGHT = opts.boxHeight || 44;
    this.INITIAL_BOX_WIDTH = opts.initialWidth || 0.72;
    this.INITIAL_X_SPEED = opts.initialSpeed || 1.15;
    this.FALL_SPEED = opts.fallSpeed || 6;
    this.onFinish = null;
    /** Appelé après chaque étage posé avec le nombre total d'étages (score courant). */
    this.onFloorCountChange = null;
    this.animationId = null;
    this._boundResize = null;
    this.resetState();
  }

  SkylineStackGame.prototype.resetState = function () {
    this.boxes = [];
    this.mode = MODES.BOUNCE;
    this.xSpeed = this.INITIAL_X_SPEED;
    this.currentBox = null;
    this.score = 0;
  };

  SkylineStackGame.prototype._resize = function () {
    var p = this.canvas.parentElement;
    var w = p ? p.clientWidth : 320;
    this.canvas.width = Math.max(280, Math.min(520, w));
    this.canvas.height = Math.min(380, Math.max(280, Math.floor(window.innerHeight * 0.38)));
  };

  SkylineStackGame.prototype.start = function (opts) {
    opts = opts || {};
    this.speedMul = typeof opts.speedMul === 'number' ? opts.speedMul : 1;
    var self = this;
    this.stop();
    this._resize();
    if (this._boundResize) window.removeEventListener('resize', this._boundResize);
    this._boundResize = function () {
      self._resize();
    };
    window.addEventListener('resize', this._boundResize);

    var cw = this.canvas.width;
    var ch = this.canvas.height;
    var bw = cw * this.INITIAL_BOX_WIDTH;
    this.boxes = [];
    this.boxes.push({
      x: cw / 2 - bw / 2,
      y: ch - this.BOX_HEIGHT,
      width: bw,
      color: randomColor()
    });
    this.xSpeed = this.INITIAL_X_SPEED * this.speedMul;
    this.currentBox = null;
    this.score = 0;
    this.mode = MODES.BOUNCE;
    this.canvas.style.backgroundColor = '';
    this._notifyFloors();
    this._loop();
  };

  SkylineStackGame.prototype.stop = function () {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this._boundResize) {
      window.removeEventListener('resize', this._boundResize);
      this._boundResize = null;
    }
    this.mode = MODES.GAME_OVER;
  };

  SkylineStackGame.prototype._loop = function () {
    var self = this;
    var ctx = this.ctx;
    var c = this.canvas;
    ctx.clearRect(0, 0, c.width, c.height);
    this._drawBoxes();

    if (this.mode === MODES.GAME_OVER) {
      this._drawGameOver();
    } else if (this.mode === MODES.BOUNCE) {
      this._bounce();
    } else if (this.mode === MODES.FALL) {
      this._fall();
    }

    this.animationId = requestAnimationFrame(function () {
      self._loop();
    });
  };

  SkylineStackGame.prototype._notifyFloors = function () {
    if (typeof this.onFloorCountChange !== 'function') return;
    this.onFloorCountChange(this.score | 0);
  };

  SkylineStackGame.prototype._drawBoxes = function () {
    var self = this;
    this.boxes.forEach(function (box) {
      self._drawBox(box);
    });
    this._drawBox(this.currentBox);
  };

  SkylineStackGame.prototype._drawBox = function (box) {
    if (!box) return;
    this.ctx.fillStyle = box.color;
    this.ctx.fillRect(box.x, box.y, box.width, this.BOX_HEIGHT);
  };

  SkylineStackGame.prototype._bounce = function () {
    var c = this.canvas;
    if (!this.currentBox) {
      var last = this.getLastBox();
      this.currentBox = {
        x: Math.random() * (c.width - last.width),
        y: 0,
        width: last.width,
        color: randomColor()
      };
    }
    this.currentBox.x += this.xSpeed;
    if (this.currentBox.width + this.currentBox.x > c.width || this.currentBox.x < 0) {
      this.xSpeed = -this.xSpeed;
    }
  };

  SkylineStackGame.prototype._fall = function () {
    var last = this.getLastBox();
    this.currentBox.y += this.FALL_SPEED;
    if (this.currentBox.y + this.BOX_HEIGHT >= last.y) {
      this._land();
    }
  };

  SkylineStackGame.prototype._land = function () {
    var last = this.getLastBox();
    var cur = this.currentBox;
    var diff = cur.x - last.x;

    if (cur.x > last.x + last.width || cur.x + cur.width < last.x) {
      this.mode = MODES.GAME_OVER;
      this._finish();
      return;
    }

    if (cur.x > last.x) {
      cur.width -= diff;
    } else {
      cur.width += diff;
      cur.x -= diff;
    }

    this.boxes.push(cur);
    var c = this.canvas;
    if (this.boxes.length > 6) {
      this.boxes.forEach(function (box) {
        box.y += this.BOX_HEIGHT;
      }, this);
      this.boxes = this.boxes.filter(function (box) {
        return box.y < c.height;
      });
    }

    this.currentBox = null;
    this.xSpeed > 0 ? (this.xSpeed += 0.12) : (this.xSpeed -= 0.12);
    this.score++;
    this._notifyFloors();
    this.mode = MODES.BOUNCE;
  };

  SkylineStackGame.prototype._drawGameOver = function () {
    this.canvas.style.backgroundColor = 'rgba(120, 20, 30, 0.85)';
    var ctx = this.ctx;
    ctx.font = 'bold 22px Exo 2, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('Partie terminée', this.canvas.width / 2, this.canvas.height / 2);
  };

  SkylineStackGame.prototype.getLastBox = function () {
    return this.boxes[this.boxes.length - 1];
  };

  SkylineStackGame.prototype._finish = function () {
    this.stop();
    if (typeof this.onFinish === 'function') {
      this.onFinish(this.score);
    }
  };

  SkylineStackGame.prototype.handleInput = function () {
    if (this.mode === MODES.GAME_OVER) return;
    if (this.mode === MODES.BOUNCE) {
      this.mode = MODES.FALL;
    }
  };

  function randomColor() {
    var r = 80 + Math.floor(Math.random() * 120);
    var g = 120 + Math.floor(Math.random() * 100);
    var b = 160 + Math.floor(Math.random() * 80);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  window.SkylineStackGame = SkylineStackGame;
})();
