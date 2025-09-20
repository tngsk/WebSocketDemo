// --- 1. 設定 (Configuration) ---
// アプリケーション全体で使用される定数と設定を定義します。
export const CONFIG = {
  EMOJIS: [
    "❤️",
    "🎉",
    "⭐",
    "💫",
    "🔥",
    "👍",
    "💯",
    "✨",
    "🚀",
    "💡",
    "🌈",
    "🥳",
    "🤩",
    "👏",
    "👋",
  ],
  NAME_REGEX: /^[a-zA-Z]{1,20}$/i, // 大文字小文字を区別しないように修正
  RECONNECT_DELAY: 3000,
  NOTIFICATION_DURATION: 3000,
  REACTION_DURATION: 2000,
  TAP_THRESHOLD: 10,
  CURSOR_THROTTLE: 33,
  CURSOR_HOVER_RADIUS: 20,
  FIREWORK_PARTICLE_COUNT: 9,
  FIREWORK_LIFESPAN: 60,
  FIREWORK_SIZE: 8,
  // 花火の出現確率に関する新しい設定
  BASE_FIREWORK_PROBABILITY: 0.05, // 基本出現確率 (5%)
  FIREWORK_PROBABILITY_PER_INTERACTION: 0.01, // インタラクション1回あたりに増加する確率 (1%)
  MAX_FIREWORK_PROBABILITY: 0.5, // 最大出現確率 (50%)
  INTERACTION_TRACKING_WINDOW_MS: 1000, // インタラクションを追跡する時間枠 (1秒)
  PRIVATE_MESSAGES: ["Hi from {name}", "Hello from {name}", "Hey from {name}"],
};

// WebSocketメッセージのタイプを定義します。
export const MESSAGE_TYPES = {
  WELCOME: "welcome",
  CURSOR: "cursor",
  REACTION: "reaction",
  FIREWORK: "firework",
  JOIN: "join",
  LEAVE: "leave",
  NAME: "name",
  PRIVATE_MESSAGE: "private_message",
};

// --- 2. ユーティリティ (Utilities) ---
// アプリケーション全体で再利用されるヘルパー関数を提供します。
export const Utils = {
  getRandomEmoji: () =>
    CONFIG.EMOJIS[Math.floor(Math.random() * CONFIG.EMOJIS.length)],

  validateName: (name) => CONFIG.NAME_REGEX.test(name) || name === "",

  sanitizeName: (name) => name.replace(/[^a-zA-Z]/gi, ""), // 大文字小文字を区別しないように修正

  getWebSocketProtocol: () => (location.protocol === "https:" ? "wss:" : "ws:"),

  isWebSocketOpen: (ws) => ws?.readyState === WebSocket.OPEN,

  clamp: (value, min, max) => Math.max(min, Math.min(value, max)),

  distance: (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
};

// --- 3. DOM管理 (DOM Management) ---
// DOM要素の操作とUIの更新を担当します。
export class DOMManager {
  constructor() {
    this.el = {};
    [
      "nameInput",
      "nameStatus",
      "userCount",
      "connectionStatus",
      "notifications",
    ].forEach((id) => (this.el[id] = document.getElementById(id)));
  }

  // 通知メッセージを表示します。
  showNotification = (text, type) => {
    const div = document.createElement("div");
    div.className = `notification ${type}`;
    div.textContent = text;
    this.el.notifications.appendChild(div);
    setTimeout(() => div.remove(), CONFIG.NOTIFICATION_DURATION);
  };

  // オンラインユーザー数を更新します。
  updateUserCount = (count) => {
    this.el.userCount.textContent = `👥 ${count} user${count !== 1 ? "s" : ""}
 online`;
  };

  updateConnectionStatus = (connected) => {
    Object.assign(this.el.connectionStatus, {
      textContent: connected ? "🟢 Connected" : "🔴 Disconnected",
      className: connected ? "status-connected" : "status-disconnected",
    });
  };

  updateNameStatus = (valid) => {
    Object.assign(this.el.nameStatus, {
      textContent: valid ? "✓" : "✗",
      className: valid ? "valid" : "invalid",
    });
  };
}

// --- 4. WebSocket接続管理 (WebSocket Connection Management) ---
// WebSocket接続の確立、メッセージの送受信、再接続ロジックを管理します。
export class ConnectionManager {
  constructor(messageHandler, statusHandler) {
    this.ws = null;
    this.handleMessage = messageHandler;
    this.handleStatusChange = statusHandler;
  }

  // WebSocket接続を確立します。
  connect() {
    const protocol = Utils.getWebSocketProtocol();
    this.ws = new WebSocket(`${protocol}//${location.host}`);

    this.ws.onopen = () => this.handleStatusChange(true);
    this.ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
    this.ws.onclose = () => {
      this.handleStatusChange(false);
      setTimeout(() => this.connect(), CONFIG.RECONNECT_DELAY);
    };
    this.ws.onerror = () => this.handleStatusChange(false);
  }

  // WebSocket経由でメッセージを送信します。
  send(message) {
    if (Utils.isWebSocketOpen(this.ws)) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

// --- 5. 入力ハンドラ (Input Handler) ---
// ユーザーの名前入力に関連するイベントを処理します。
export class InputHandler {
  constructor(domManager, sendNameUpdate) {
    this.dom = domManager;
    this.sendNameUpdate = sendNameUpdate;
    this.setupEventListeners();
  }

  // 名前入力フィールドのイベントリスナーを設定します。
  setupEventListeners() {
    const nameInput = this.dom.el.nameInput;
    nameInput.addEventListener("input", (e) => this.handleNameInput(e));
    nameInput.addEventListener(
      "keypress",
      (e) => e.key === "Enter" && this.sendNameUpdate(),
    );
    nameInput.addEventListener("blur", () => this.sendNameUpdate());
  }

  // 名前入力時の処理を行います。
  handleNameInput(e) {
    const { value } = e.target;
    const isValid = Utils.validateName(value);
    this.dom.el.nameInput.classList.toggle("invalid", !isValid);
    this.dom.updateNameStatus(isValid);
    e.target.value = Utils.sanitizeName(value);
  }
}

// --- 6. メインアプリケーションロジック (RealtimeDemo Class) ---
// アプリケーションの主要な状態管理とビジネスロジックを担います。
export class RealtimeDemo {
  constructor(p) {
    this.p = p; // p5.jsインスタンス
    this.initializeState();
    this.initializeSystems();
    this.setupEventListeners();
    this.connect();
  }

  // --- 6.1. 状態初期化 (State Initialization) ---
  // アプリケーションの初期状態を設定します。
  initializeState() {
    this.userId = null;
    this.userColor = null;
    this.userName = null;
    this.lastCursorSend = 0;
    this.isDragging = false;
    this.lastTouchPosition = { x: 0, y: 0 };
    this.hueOffset = 0;

    // カーソルシステムの状態
    this.cursors = new Map(); // 他のユーザーのカーソルデータ
    this.ownCursor = { x: 0, y: 0, display: false }; // 自身のカーソルデータ
    this.hoveredCursorId = null; // ホバー中のカーソルID
    this.selectedCursorId = null; // 選択中のカーソルID

    // 花火システムの状態
    this.fireworks = []; // 現在表示中の花火パーティクル

    // リアクションシステムの状態
    this.reactions = []; // 現在表示中のリアクション

    // インタラクション追跡の状態
    this.recentInteractions = []; // 最近のインタラクションのタイムスタンプ
  }

  // --- 6.2. システム初期化 (System Initialization) ---
  // 外部システム（DOMManager, ConnectionManager, InputHandler）を初期化します。
  initializeSystems() {
    this.dom = new DOMManager();
    this.connection = new ConnectionManager(
      (msg) => this.handleMessage(msg),
      (connected) => this.handleConnectionStatusChange(connected),
    );

    this.inputHandler = new InputHandler(this.dom, () => this.sendNameUpdate());
  }

  // --- 6.3. イベントリスナー設定 (Event Listener Setup) ---
  // グローバルなイベントリスナーを設定します。
  setupEventListeners() {
    window.addEventListener("beforeunload", () => this.cleanup());
  }

  // --- 6.4. 接続開始 (Start Connection) ---
  // WebSocket接続を開始します。
  connect() {
    this.connection.connect();
  }

  // --- 6.5. カーソルシステムメソッド (Cursor System Methods) ---
  // カーソルデータの更新、削除、描画ロジックを管理します。
  updateCursor(userId, cursor) {
    this.cursors.set(userId, cursor);
  }

  removeCursor(userId) {
    this.cursors.delete(userId);
  }

  clearAllCursors() {
    this.cursors.clear();
    this.ownCursor.display = false;
  }

  findCursorAt(x, y, radius) {
    for (const [userId, cursor] of this.cursors.entries()) {
      if (this.p.dist(x, y, cursor.x, cursor.y) < radius) {
        return userId;
      }
    }
    return null;
  }

  updateHoveredCursor(mouseX, mouseY) {
    this.hoveredCursorId = this.findCursorAt(
      mouseX,
      mouseY,
      CONFIG.CURSOR_HOVER_RADIUS,
    );
  }

  toggleSelectedCursor(cursorId) {
    const prev = this.selectedCursorId;
    this.selectedCursorId =
      this.selectedCursorId === cursorId ? null : cursorId;
    if (cursorId && prev !== cursorId) this.sendPrivateMessage(cursorId);
  }

  drawCursor(x, y, color, name, isOwn, showName) {
    const p = this.p;
    p.push();
    p.translate(x, y);
    p.fill(p.color(color));
    p.stroke(255);
    p.strokeWeight(isOwn ? 3 : 2);
    p.ellipse(0, 0, isOwn ? 18 : 12);

    if (showName) {
      p.fill(
        p.color(
          isOwn ? 230 : 0,
          isOwn ? 50 : 0,
          isOwn ? 90 : 0,
          isOwn ? 0.9 : 0.8,
        ),
      );
      p.noStroke();
      p.textSize(isOwn ? 14 : 12);
      p.textStyle(p.NORMAL); // p.BOLDはp5.jsの描画部分に移動
      p.text(name, 0, isOwn ? 22 : 16);
    }
    p.pop();
  }

  drawAllCursors() {
    // 他のユーザーのカーソルを描画
    for (const [userId, cursor] of this.cursors.entries()) {
      const showName =
        userId === this.hoveredCursorId || userId === this.selectedCursorId;
      this.drawCursor(
        cursor.x,
        cursor.y,
        cursor.color,
        cursor.name,
        false,
        showName,
      );
    }

    // 自身のカーソルを描画
    if (this.ownCursor.display) {
      this.drawCursor(
        this.ownCursor.x,
        this.ownCursor.y,
        this.userColor,
        `${this.userName}`,
        true,
        true,
      );
    }
  }

  // --- 6.6. 花火システムメソッド (Firework System Methods) ---
  // 花火の生成と更新ロジックを管理します。
  // 個々の花火パーティクルを表すネストされたクラス
  FireworkParticle = class {
    constructor(p, x, y, vx, vy, hue) {
      this.p = p;
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.hue = hue;
      this.lifespan = CONFIG.FIREWORK_LIFESPAN;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 0.98;
      this.vy *= 0.98;
      this.lifespan -= 1;
    }

    draw() {
      this.p.noStroke();
      this.p.fill(this.hue, 90, 90, this.lifespan / CONFIG.FIREWORK_LIFESPAN);
      this.p.ellipse(this.x, this.y, CONFIG.FIREWORK_SIZE);
    }

    isDead() {
      return this.lifespan <= 0;
    }
  };

  // 新しい花火を生成します。
  createFirework(x, y) {
    const hue = this.p.random(360);
    for (let i = 0; i < CONFIG.FIREWORK_PARTICLE_COUNT; i++) {
      const angle = (this.p.TWO_PI / CONFIG.FIREWORK_PARTICLE_COUNT) * i;
      const speed = this.p.random(3, 6);
      this.fireworks.push(
        new this.FireworkParticle(
          this.p,
          x,
          y,
          this.p.cos(angle) * speed,
          this.p.sin(angle) * speed,
          hue,
        ),
      );
    }
  }

  // 全ての花火パーティクルを更新し、描画します。
  updateFireworks() {
    this.fireworks = this.fireworks.filter((particle) => {
      particle.update();
      particle.draw();
      return !particle.isDead();
    });
  }

  // --- 6.7. リアクションシステムメソッド (Reaction System Methods) ---
  // リアクションの追加と更新ロジックを管理します。
  addReaction(x, y, emoji) {
    this.reactions.push({ x, y, emoji, timestamp: this.p.millis() });
  }

  // 全てのリアクションを更新し、描画します。
  updateReactions() {
    this.reactions = this.reactions.filter((reaction) => {
      const progress =
        (this.p.millis() - reaction.timestamp) / CONFIG.REACTION_DURATION;
      if (progress > 1) return false;
      const yOffset = this.p.lerp(0, -150, this.p.easeOutQuad(progress));
      const opacity = this.p.lerp(1, 0, progress);
      const scale = this.p.lerp(0.5, 0.8, progress);
      this.p.push();
      this.p.translate(reaction.x, reaction.y + yOffset);
      this.p.scale(scale);
      this.p.fill(255, opacity * 255);
      this.p.textSize(24);
      this.p.text(reaction.emoji, 0, 0);
      this.p.pop();
      return true;
    });
  }

  // --- 6.8. メッセージハンドラ (Message Handlers) ---
  // WebSocketから受信したメッセージを処理します。
  handleMessage(message) {
    const { type, userId, color, name, count, oldName, x, y, emoji } = message;

    switch (type) {
      case MESSAGE_TYPES.WELCOME:
        this.handleWelcomeMessage(userId, color, name);
        break;
      case MESSAGE_TYPES.CURSOR:
        this.updateCursor(userId, { x, y, color, name });
        break;
      case MESSAGE_TYPES.REACTION:
        console.log("Received REACTION message:", message); // コンソール出力追加
        this.addReaction(x, y, emoji);
        this.recordInteraction(); // リモートのリアクションもインタラクションとして記録
        break;
      case MESSAGE_TYPES.FIREWORK:
        console.log("Received FIREWORK message:", message); // コンソール出力追加
        this.createFirework(x, y);
        this.recordInteraction(); // リモートの花火もインタラクションとして記録
        break;
      case MESSAGE_TYPES.JOIN:
        this.dom.updateUserCount(count);
        this.dom.showNotification(`${name} joined`, "join");
        break;
      case MESSAGE_TYPES.LEAVE:
        this.dom.updateUserCount(count);
        this.removeCursor(userId);
        this.dom.showNotification(`${name} left`, "leave");
        break;
      case MESSAGE_TYPES.NAME:
        console.log("Received NAME message:", message);
        console.log("Current cursors:", this.cursors);
        console.log("Looking for cursor with userId:", userId);
        this.dom.showNotification(`${oldName} → ${name}`, "name");
        const cursor = this.cursors.get(userId);
        if (cursor) {
          console.log(
            "Found cursor, updating name from",
            cursor.name,
            "to",
            name,
          );
          cursor.name = name;
          console.log("Cursor after update:", cursor);
        } else {
          console.log("No cursor found for userId:", userId);
        }
        break;
      case MESSAGE_TYPES.PRIVATE_MESSAGE:
        this.dom.showNotification(message.message, "private");
        break;
    }
  }

  // WELCOMEメッセージを処理し、自身のユーザー情報を設定します。
  handleWelcomeMessage(userId, color, name) {
    this.userId = userId;
    this.userColor = color;
    this.userName = name;
    this.dom.el.nameInput.value = name;
    this.dom.updateNameStatus(true);
    this.ownCursor.display = true;
  }

  // 接続ステータスの変更を処理します。
  handleConnectionStatusChange(connected) {
    this.dom.updateConnectionStatus(connected);
    if (!connected) {
      this.clearAllCursors();
    }
  }

  // --- 6.9. 接続・送信関連メソッド (Connection & Send Methods) ---
  // カーソル位置を更新し、サーバーに送信します。
  updateCursorPosition(x, y) {
    this.ownCursor.x = x;
    this.ownCursor.y = y;

    const now = this.p.millis();
    if (now - this.lastCursorSend < CONFIG.CURSOR_THROTTLE) return;

    this.connection.send({ type: MESSAGE_TYPES.CURSOR, x, y });
    this.lastCursorSend = now;
  }

  // リアクションをサーバーに送信し、ローカルで表示します。
  sendReaction(x, y, emoji) {
    this.connection.send({ type: MESSAGE_TYPES.REACTION, x, y, emoji });
    this.addReaction(x, y, emoji);
  }

  // 花火イベントをサーバーに送信します。
  sendFirework(x, y) {
    this.connection.send({ type: MESSAGE_TYPES.FIREWORK, x, y });
  }

  // 名前変更をサーバーに送信します。
  sendNameUpdate() {
    const newName = this.dom.el.nameInput.value.trim();
    console.log(`Attempting name change: "${this.userName}" → "${newName}"`);
    if (
      newName &&
      newName !== this.userName &&
      CONFIG.NAME_REGEX.test(newName)
    ) {
      const nameMessage = { type: MESSAGE_TYPES.NAME, name: newName };
      console.log("Sending name change message:", nameMessage);
      this.connection.send(nameMessage);
      this.userName = newName;
    } else {
      console.log("Name change rejected:", {
        newName,
        currentName: this.userName,
        isEmpty: !newName,
        isSame: newName === this.userName,
        isValid: CONFIG.NAME_REGEX.test(newName),
      });
    }
  }

  // --- 6.10. インタラクション追跡メソッド (Interaction Tracking Methods) ---
  // 最近のインタラクションを記録し、古いものを削除します。
  recordInteraction() {
    const now = this.p.millis();
    this.recentInteractions.push(now);
    // 古いインタラクションをクリーンアップ
    this.recentInteractions = this.recentInteractions.filter(
      (timestamp) => now - timestamp < CONFIG.INTERACTION_TRACKING_WINDOW_MS,
    );
  }

  // 現在のインタラクション頻度に基づいて花火の確率を動的に計算します。
  getDynamicFireworkProbability() {
    const now = this.p.millis();
    // 最新のインタラクションのみを考慮
    const activeInteractions = this.recentInteractions.filter(
      (timestamp) => now - timestamp < CONFIG.INTERACTION_TRACKING_WINDOW_MS,
    );
    const currentInteractionCount = activeInteractions.length;

    let calculatedProbability =
      CONFIG.BASE_FIREWORK_PROBABILITY +
      currentInteractionCount * CONFIG.FIREWORK_PROBABILITY_PER_INTERACTION;

    return Utils.clamp(
      calculatedProbability,
      CONFIG.BASE_FIREWORK_PROBABILITY,
      CONFIG.MAX_FIREWORK_PROBABILITY,
    );
  }

  sendPrivateMessage(targetUserId) {
    const templates = CONFIG.PRIVATE_MESSAGES;
    const message = templates[
      Math.floor(Math.random() * templates.length)
    ].replace("{name}", this.userName);
    this.dom.showNotification(message, "private"); // 送信者にも表示
    this.connection.send({
      type: MESSAGE_TYPES.PRIVATE_MESSAGE,
      targetUserId,
      message,
    });
  }

  // --- 9. クリーンアップ (Cleanup) ---
  // アプリケーション終了時のクリーンアップ処理を行います。
  cleanup() {
    this.connection.ws?.close();
  }
}

// --- 7. p5.jsグラフィック描画 (p5.js Graphics Drawing) ---

// --- 7.1. p5.jsプロトタイプ拡張 (p5.js Prototype Extension) ---
// p5.jsのプロトタイプにカスタムのイージング関数を追加します。
if (typeof p5 !== "undefined") {
  p5.prototype.easeOutQuad = (t) => t * (2 - t);
}

// --- 7.2. P5Drawingクラス (P5Drawing Class) ---
// p5.jsの描画とイベントハンドリングに特化したクラスです。
class P5Drawing {
  constructor(p, realtimeDemoInstance) {
    this.p = p; // p5.jsインスタンス
    this.app = realtimeDemoInstance; // RealtimeDemoインスタンスへの参照
    this.setupP5Events();
  }

  // p5.jsの主要なイベントハンドラを設定します。
  setupP5Events() {
    this.p.setup = () => this.setup();
    this.p.draw = () => this.draw();
    this.p.windowResized = () => this.windowResized();
    this.p.touchStarted = () => this.touchStarted();
    this.p.touchMoved = () => this.touchMoved();
    this.p.touchEnded = () => this.touchEnded();
  }

  // p5.jsのセットアップ関数 (キャンバス作成、描画設定など)
  setup() {
    const p = this.p;
    p.createCanvas(p.windowWidth, p.windowHeight).parent("canvasContainer");
    p.noStroke();
    p.textFont("sans-serif");
    p.textAlign(p.CENTER, p.CENTER);
    p.frameRate(60);
    p.colorMode(p.HSB, 360, 100, 100, 1);
  }

  // p5.jsの描画ループ関数 (毎フレーム実行)
  draw() {
    const p = this.p;
    this.app.hueOffset = (this.app.hueOffset + 0.1) % 360;

    // アニメーション背景を描画
    const ctx = p.drawingContext;
    const gradient = ctx.createLinearGradient(0, 0, 0, p.height);
    const hue1 = (240 + this.app.hueOffset) % 360;
    const hue2 = (270 + this.app.hueOffset) % 360;
    gradient.addColorStop(0, p.color(hue1, 70, 90).toString());
    gradient.addColorStop(1, p.color(hue2, 70, 90).toString());
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, p.width, p.height);

    // マウスが移動した場合、カーソル位置を更新
    if (p.mouseX !== p.pmouseX || p.mouseY !== p.pmouseY) {
      this.app.updateCursorPosition(p.mouseX, p.mouseY);
    }

    // 各システムの状態を更新し、描画します。
    this.app.updateHoveredCursor(p.mouseX, p.mouseY);
    this.app.drawAllCursors();
    this.app.updateReactions();
    this.app.updateFireworks();
  }

  // ウィンドウサイズ変更時の処理
  windowResized() {
    this.p.resizeCanvas(this.p.windowWidth, this.p.windowHeight);
  }

  // タッチ開始時の処理
  touchStarted() {
    // コントロール領域内のタッチは処理しない（nameInputなどのUI要素のため）
    const controlsElement = document.querySelector(".controls");
    if (controlsElement) {
      const rect = controlsElement.getBoundingClientRect();
      if (
        this.p.mouseX >= rect.left &&
        this.p.mouseX <= rect.right &&
        this.p.mouseY >= rect.top &&
        this.p.mouseY <= rect.bottom
      ) {
        return true; // デフォルトの動作を許可
      }
    }

    this.app.isDragging = false;
    this.app.lastTouchPosition = { x: this.p.mouseX, y: this.p.mouseY };
    return false; // ブラウザのデフォルトのタッチイベントを抑制
  }

  // タッチ移動時の処理
  touchMoved() {
    // コントロール領域内のタッチは処理しない
    const controlsElement = document.querySelector(".controls");
    if (controlsElement) {
      const rect = controlsElement.getBoundingClientRect();
      if (
        this.p.mouseX >= rect.left &&
        this.p.mouseX <= rect.right &&
        this.p.mouseY >= rect.top &&
        this.p.mouseY <= rect.bottom
      ) {
        return true; // デフォルトの動作を許可
      }
    }

    const p = this.p;
    const deltaX = p.abs(p.mouseX - this.app.lastTouchPosition.x);
    const deltaY = p.abs(p.mouseY - this.app.lastTouchPosition.y);

    // ドラッグとタップを区別
    if (deltaX > CONFIG.TAP_THRESHOLD || deltaY > CONFIG.TAP_THRESHOLD) {
      this.app.isDragging = true;
    }

    this.app.updateCursorPosition(p.mouseX, p.mouseY);
    return false; // ブラウザのデフォルトのタッチイベントを抑制
  }

  // タッチ終了時の処理
  touchEnded() {
    // コントロール領域内のタッチは処理しない
    const controlsElement = document.querySelector(".controls");
    if (controlsElement) {
      const rect = controlsElement.getBoundingClientRect();
      if (
        this.p.mouseX >= rect.left &&
        this.p.mouseX <= rect.right &&
        this.p.mouseY >= rect.top &&
        this.p.mouseY <= rect.bottom
      ) {
        return true; // デフォルトの動作を許可
      }
    }

    const p = this.p;

    // ドラッグでなければタップと判断し、リアクションと花火をランダムで送信
    if (!this.app.isDragging) {
      // タップ時に自身のカーソル位置を更新
      this.app.updateCursorPosition(p.mouseX, p.mouseY);
      this.app.recordInteraction(); // ローカルのインタラクションを記録

      const tappedCursorId = this.app.findCursorAt(
        p.mouseX,
        p.mouseY,
        CONFIG.CURSOR_HOVER_RADIUS,
      );

      this.app.toggleSelectedCursor(tappedCursorId);

      // 動的に計算された確率で花火か絵文字を決定
      if (p.random() < this.app.getDynamicFireworkProbability()) {
        // 花火をトリガー
        this.app.createFirework(p.mouseX, p.mouseY);
        this.app.sendFirework(p.mouseX, p.mouseY);
      } else {
        // リアクション（絵文字）をトリガー
        const emoji = Utils.getRandomEmoji();
        this.app.sendReaction(p.mouseX, p.mouseY, emoji);
      }
    }

    this.app.isDragging = false;
    return false; // ブラウザのデフォルトのタッチイベントを抑制
  }
}

// --- 7.3. アプリケーション初期化 (Application Initialization) ---
// p5.jsが準備できたときにアプリケーションを初期化します。
new p5((p) => {
  const app = new RealtimeDemo(p);
  new P5Drawing(p, app);
}, "canvasContainer");
