const DEFAULT_PLAYER_STATS = { maxHp: 100, atk: 10, def: 5, int: 15, spd: 12 };

const FACE_IMAGES = {
    NORMAL: 'Fairy_face1.png', // 通常
    PINCH:  'Fairy_face2.png', // ピンチ（小ダメージ）
    DYING:  'Fairy_face3.png'  // 瀕死（大ダメージ）
};

const SHRINK_STATS = {
    LV1: { atk: 0.70, damageRate: 1.5, evasionAdd: 15, spdMult: 1.2 },
    LV2: { atk: 0.40, damageRate: 2.0, evasionAdd: 30, spdMult: 1.5 },
    LV3: { atk: 0.15, damageRate: 4.0, evasionAdd: 60, spdMult: 2.5 }
};

const SHRINK_VISUALS = {
    LV0: { scale: 1.0, yOffset: 0 },
    LV1: { scale: 0.7, yOffset: -7 },
    LV2: { scale: 0.4, yOffset: -14 },
    LV3: { scale: 0.2, yOffset: -21 }
};

const SAVE_KEY = 'fairy_rogue_save_v1';

/**
 * ゲーム全体の進行管理クラス
 */
class BattleSystem {
    constructor() {
        // プレイヤー初期ステータス (HP, ATK, DEF, INT, SPD)
        this.player = new Unit("妖精", 100, 10, 5, 15, 12, false, true);
        this.playerBaseStats = { ...DEFAULT_PLAYER_STATS }; // 装備なしの基礎ステータス
        this.activeBonuses = { unique: false, heavy: false }; // デッキボーナス状態
        // 敵初期ステータス
        this.enemy = null; // 戦闘開始時に生成
        
        this.deck = new DeckManager();
        this.turn = 0;
        this.depth = 0; // 現在の階層
        this.isPlayerTurn = true;
        this.enemyNextAction = null; // 敵の行動予定
        this.isHome = true; // 拠点にいるかどうかのフラグ
        this.mode = 'normal'; // 'normal' | 'rogue'
        this.backupData = null; // ローグライクモード用バックアップ
        this.isSaveEnabled = false; // セーブ許可フラグ (初期化中の上書き防止)
        this.rogueHighScore = 0; // ローグライク最高記録
        this.canReceiveWisdom = false; // 10階層到達ボーナスフラグ

        this.tempInventory = []; // 探索中の仮取得アイテム
        this.permInventory = []; // 持ち帰り確定アイテム（未装備）
        
        // データ管理
        // ▼ 追加: コレクションデータの初期化
        this.collection = {
            accessories: [],   // 取得済みの装飾品IDリスト
            magicCircles: [],  // 取得済みの魔法陣IDリスト
            statuses: []       // かかったことのある状態異常IDリスト
        };

        this.masterDeck = []; // 現在のデッキ構成
        this.cardPool = [];   // 所持しているがデッキに入っていないカード
        this.equipment = { weapon: null, armor: null, accessory: null, magic_circle: null }; // 装備スロット

        // 妖精の独り言システム用
        this.messageTimer = null;
        this.returnState = null; // 'victory' | 'defeat' | null
        this.specialResultKey = null; // 特殊リザルトセリフのキー
        this.lastLootCount = 0;
        this.lastActionTime = Date.now();
        this.restCount = 3; // 休憩回数
        this.clickStreak = 0; // 連打カウンター
        this.isClickLocked = false; // クリック連打イベントのリセット演出用ロック

        // ▼ 追加: ログ管理用変数
        this.logQueue = [];         // ログの待ち行列
        this.isProcessingLog = false; // 現在ログを出力中かどうかのフラグ


        // AFK監視
        ['mousemove', 'click', 'keydown', 'touchstart'].forEach(evt => {
            window.addEventListener(evt, () => {
                this.lastActionTime = Date.now();
            });
        });

        // UI要素のキャッシュ
        this.ui = {
            hpVal: document.getElementById('hp-val'),
            maxHpVal: document.getElementById('max-hp-val'),
            hpBar: document.getElementById('hp-bar'),
            playerImg: document.getElementById('player-img'),
            deckCount: document.getElementById('deck-count'),
            discardCount: document.getElementById('discard-count'),
            log: document.getElementById('battle-log'),
            enemyIntentIcon: document.getElementById('intent-icon'),
            enemyIntentText: document.getElementById('intent-text'),
            enemyGraphic: document.getElementById('enemy-graphic'),
            cardList: document.getElementById('card-list'),
            cardOverlay: document.getElementById('card-selection-overlay'),
            btns: document.querySelectorAll('.btn'), // 全ボタン（操作ロック用）
            battleCommands: document.getElementById('battle-commands'),
            systemCommands: document.getElementById('system-commands'),
            statAtk: document.getElementById('stat-atk'),
            statDef: document.getElementById('stat-def'),
            statInt: document.getElementById('stat-int'),
            statSpd: document.getElementById('stat-spd')
        };

        // メニューUI
        this.menuUi = {
            overlay: document.getElementById('game-menu-overlay'),
            title: document.getElementById('menu-title'),
            content: document.getElementById('menu-content'),
            loot: document.getElementById('loot-display'),
            buttons: document.getElementById('menu-buttons')
        };

        // 編成画面UI
        this.mgmtUi = {
            overlay: document.getElementById('management-overlay'),
            content: document.getElementById('mgmt-content'),
            tabEquip: document.getElementById('tab-equip'),
            tabDeck: document.getElementById('tab-deck'),
            // tabSynthesis は動的に追加するか、HTMLに追加が必要だが、ここではJSで制御
            bonusUnique: document.getElementById('mgmt-bonus-unique'),
            bonusHeavy: document.getElementById('mgmt-bonus-heavy'),
            saveBtn: document.getElementById('mgmt-save-btn'),
            errorMsg: document.getElementById('mgmt-error-msg')
        };
        this.currentTab = 'equip';

        // 合成用データ
        this.synthesisMode = 'equip'; // 'equip' or 'card'
        this.selectedSynthesisItems = []; // 選択されたインデックスのリスト

        // ゲーム初期化
        this.init();
    }

    init() {
        // 初期デッキとカードプールの設定
        const initialIds = [
            'fire', 'fire', 'fire',
            'thunder', 'thunder', 'thunder',
            'heal', 'heal', 'heal',
            'reload', 'stone', 'enchant'
        ];
        this.masterDeck = initialIds.map(id => CARD_DATABASE.find(c => c.id === id));
        
        // テスト用にカードプールにも少し入れておく
        this.cardPool = ['fire', 'thunder', 'heal', 'barrier'].map(id => CARD_DATABASE.find(c => c.id === id));

        this.recalcStats(); // 初期ステータス計算
        // 初期状態はHOME
        this.showHome();

        // 立ち絵エリアのクリックイベント設定
        const playerArea = document.getElementById('player-area');
        if (playerArea) {
            playerArea.addEventListener('click', () => {
                this.updateFairyMessage(true); // 手動モード
                this.startMessageTimer(); // タイマーリセット
            });
        }
    }

    // --- セーブ・ロード機能 ---

    saveGame() {
        if (!this.isSaveEnabled) {
            console.log("saveGame: 初期化中のためセーブをスキップしました");
            return;
        }

        if (!this.player) return;

        // ▼ 追加: 保存前に現在の所持品を図鑑登録
        this.registerCurrentItems();

        const saveData = {
            player: {
                                // ... (既存のhp, maxHpなどの保存) ...
                baseStats: this.playerBaseStats, 
                hp: this.player.hp,
                maxHp: this.player.maxHp,
                atk: this.player.atk,
                def: this.player.def,
                int: this.player.int,
                spd: this.player.spd,
                runStats: this.player.runStats,
                flags: this.player.flags,
                shrinkLevel: this.player.shrinkLevel,
                minShrinkLevel: this.player.minShrinkLevel,
                expansionLevel: this.player.expansionLevel,
                currentStatus: this.player.currentStatus ? { id: this.player.currentStatus.id, turns: this.player.statusTurn } : null,
                buffs: this.player.buffs,
                battleStatsMod: this.player.battleStatsMod || { atk: 0, def: 0, int: 0, spd: 0 },
                barrier: this.player.barrier,
                dropQualityBonus: this.player.dropQualityBonus
            },
            inventory: this.permInventory,
            equipment: this.equipment,
            masterDeck: this.masterDeck.map(c => c.id),
            cardPool: this.cardPool.map(c => c.id),
            
            game: {
                depth: this.depth,
                mode: this.mode,
                backupData: this.backupData,
                isHome: this.isHome,
                restCount: this.restCount,
                turn: this.turn,
                tempInventory: this.tempInventory,
                canReceiveWisdom: this.canReceiveWisdom,
                state: this.isHome ? 'home' : (this.enemy ? 'battle' : 'exploration'),
                rogueHighScore: this.rogueHighScore,
                collection: this.collection // ▼ 追加
            },
            
            battle: null
        };

        // 戦闘中の場合、敵とデッキの状態も保存
        if (!this.isHome && this.enemy) {
            saveData.battle = {
                enemy: {
                    name: this.enemy.name,
                    maxHp: this.enemy.maxHp,
                    hp: this.enemy.hp,
                    atk: this.enemy.atk,
                    def: this.enemy.def,
                    int: this.enemy.int,
                    spd: this.enemy.spd,
                    isBoss: this.enemy.isBoss,
                    routineId: this.enemy.routineId,
                    uniqueStatus: this.enemy.uniqueStatus,
                    skipTurn: this.enemy.skipTurn,
                    isDefending: this.enemy.isDefending
                },
                deck: {
                    drawPile: this.deck.drawPile.map(c => c.id),
                    hand: this.deck.hand.map(c => c.id),
                    discardPile: this.deck.discardPile.map(c => c.id)
                },
                isPlayerTurn: this.isPlayerTurn,
                enemyNextAction: this.enemyNextAction
            };
        }

        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
            console.log("Game Saved");
            // 頻繁に出るため通知を非表示にする
            // this.showToast("💾 データを保存しました", "system");
        } catch (e) {
            console.error("Save failed", e);
            this.showToast("⚠️ セーブに失敗しました", "warning");
        }
    }

    loadGame() {
        const json = localStorage.getItem(SAVE_KEY);
        if (!json) return false;

        try {
            const data = JSON.parse(json);
            
            // ▼▼▼ 追加: 基礎ステータスの復元 (なければデフォルト) ▼▼▼
            this.playerBaseStats = data.player.baseStats || { ...DEFAULT_PLAYER_STATS };

            // プレイヤー復元
            Object.assign(this.player, data.player);
            if (data.player.currentStatus) {
                this.applyStatus(data.player.currentStatus.id, data.player.currentStatus.turns);
            } else {
                this.player.currentStatus = null;
            }
            this.player.buffs = data.player.buffs || [];
            this.player.battleStatsMod = data.player.battleStatsMod || { atk: 0, def: 0, int: 0, spd: 0 };

            // インベントリ・装備復元
            // IDベースで復元し、plusValue等の補正を再適用する
            const restoreItem = (itemData) => {
                if (!itemData) return null;

                // ▼ 追加: ID欠落時の自動修復 (Auto-Repair) ▼
                if (!itemData.id && itemData.name) {
                    console.warn(`修復: ID欠落アイテムを検出 -> ${itemData.name}`);
                    
                    // 1. 名前から「ベース名」を取得 ( (+1) などの強化値を除去)
                    const baseName = itemData.name.replace(/\(\+\d+\)$/, '');
                    
                    // 2. データベースから検索
                    // A. アクセサリー効果
                    let master = ACCESSORY_EFFECTS.find(e => e.name === baseName);
                    // B. 伝説級装備
                    if (!master) master = ENDGAME_ITEMS.find(e => e.name === baseName);
                    // C. カードデータベース (アイテムとして保持している場合)
                    if (!master) master = CARD_DATABASE.find(c => c.name === baseName);
                    
                    // 3. IDを補完
                    if (master) {
                        itemData.id = master.id;
                        console.log(`-> ID復元成功: ${itemData.id}`);
                    } else {
                        // 生成装備(武器/防具)の場合、ID復元は困難だが、
                        // 少なくとも消滅させないために一時的なIDを付与して維持を試みる
                        console.warn(`-> マスタデータが見つかりません。仮IDを発行して維持します。`);
                        itemData.id = `restored_${Date.now()}_${Math.floor(Math.random()*1000)}`;
                    }
                }

                // それでもIDがなければ復元不可
                if (!itemData.id) return null;

                let item = getItemById(itemData.id);
                const isFresh = !!item;

                // getItemById で取れなかった場合 (生成装備のIDなど)、
                // セーブデータ内の情報をそのまま採用してオブジェクト化する
                if (!item) {
                    // ベースとして itemData を使う
                    item = JSON.parse(JSON.stringify(itemData));
                }

                // 強化値の適用とステータス加算
                if (itemData.plusValue > 0) {
                    item.plusValue = itemData.plusValue;
                    // 名前が重複して (+1) (+1) にならないようにリセットしてから付与
                    const baseName = item.name.replace(/\(\+\d+\)$/, '');
                    item.name = `${baseName}(+${item.plusValue})`;

                    // 新規生成(isFresh)の場合のみステータスを加算する（itemDataベースの場合は保存値を信頼）
                    if (isFresh) {
                        if (item.type === 'weapon') {
                            if (item.atk > 0) item.atk += item.plusValue;
                            if (item.int > 0) item.int += item.plusValue;
                        } else if (item.type === 'armor') {
                            if (item.def > 0) item.def += item.plusValue;
                            if (item.atk > 0) item.atk += item.plusValue;
                            if (item.int > 0) item.int += item.plusValue;
                            if (item.spd > 0) item.spd += item.plusValue;
                        }
                    }
                }
                return item;
            };

            this.permInventory = (data.inventory || []).map(restoreItem).filter(i => i !== null);
            
            this.equipment = { weapon: null, armor: null, accessory: null, magic_circle: null };
            if (data.equipment) {
                if (data.equipment.weapon) this.equipment.weapon = restoreItem(data.equipment.weapon);
                if (data.equipment.armor) this.equipment.armor = restoreItem(data.equipment.armor);
                if (data.equipment.accessory) this.equipment.accessory = restoreItem(data.equipment.accessory);
                if (data.equipment.magic_circle) this.equipment.magic_circle = restoreItem(data.equipment.magic_circle);
            }
            
            // デッキ復元
            this.masterDeck = (data.masterDeck || []).map(id => CARD_DATABASE.find(c => c.id === id)).filter(c => c);
            this.cardPool = (data.cardPool || []).map(id => CARD_DATABASE.find(c => c.id === id)).filter(c => c);
            
            // ゲーム状態復元
            this.depth = data.game.depth;
            this.mode = data.game.mode || 'normal';
            this.backupData = data.game.backupData || null;
            this.isHome = data.game.isHome;
            this.restCount = data.game.restCount;
            this.turn = data.game.turn;
            this.tempInventory = data.game.tempInventory || [];
            this.canReceiveWisdom = data.game.canReceiveWisdom || false; // ロード
            this.rogueHighScore = data.game.rogueHighScore || 0;
            
            // ▼ 追加: コレクションの復元
            if (data.game.collection) {
                this.collection = data.game.collection;
            }
            
            // 後方互換性: 現在の所持品・装備品を即座に図鑑登録する
            this.registerCurrentItems();

            const state = data.game.state || (this.isHome ? 'home' : 'exploration');

            // 戦闘復元
            if (data.battle && !this.isHome) {
                const e = data.battle.enemy;
                this.enemy = new Unit(e.name, e.maxHp, e.atk, e.def, e.int, e.spd, e.isBoss);
                Object.assign(this.enemy, e);
                
                this.deck.drawPile = data.battle.deck.drawPile.map(id => CARD_DATABASE.find(c => c.id === id));
                this.deck.hand = data.battle.deck.hand.map(id => CARD_DATABASE.find(c => c.id === id));
                this.deck.discardPile = data.battle.deck.discardPile.map(id => CARD_DATABASE.find(c => c.id === id));
                
                this.isPlayerTurn = data.battle.isPlayerTurn;
                this.enemyNextAction = data.battle.enemyNextAction;

                this.ui.systemCommands.style.display = 'none';
                this.ui.battleCommands.style.display = 'flex';
                this.menuUi.overlay.style.display = 'none';
                
                this.updateStatsUI();
                this.updateDeckUI();
                this.renderHandCards();
                
                if (this.isPlayerTurn) {
                    this.setControlsEnabled(true);
                } else {
                    this.processEnemyTurn();
                }
                this.log("戦闘を再開します");
            } else {
                if (this.isHome) {
                    this.showHome();
                } else {
                    // ダンジョン探索中（選択肢画面）
                    this.ui.battleCommands.style.display = 'none';
                    this.renderDungeonButtons();
                    this.log("探索を再開します");
                }
            }
            
            this.recalcStats();
            this.updateStatsUI();
            this.showToast("ゲームを再開しました");
            return true;
        } catch (e) {
            console.error("Load failed", e);
            return false;
        }
    }

    // --- 冒険譚 (Adventure Log) 関連 ---

    // 図鑑登録 (汎用)
    registerCollection(type, id) {
        if (!id) return;
        if (!this.collection[type]) this.collection[type] = [];
        
        if (!this.collection[type].includes(id)) {
            this.collection[type].push(id);
        }
    }

    // 手持ちアイテムを登録
    registerCurrentItems() {
        // 装備中の装飾品・魔法陣
        if (this.equipment.accessory) this.registerCollection('accessories', this.equipment.accessory.id);
        if (this.equipment.magic_circle) this.registerCollection('magicCircles', this.equipment.magic_circle.id);
        
        // インベントリ(永続・一時)内の装飾品・魔法陣
        const allItems = [...this.permInventory, ...this.tempInventory];
        allItems.forEach(item => {
            if (item.type === 'accessory' || (item.id && (item.id.startsWith('acc_') || item.id.startsWith('pin_')))) {
                this.registerCollection('accessories', item.id);
            }
            if (item.type === 'magic_circle' || (item.id && item.id.startsWith('mc_'))) {
                this.registerCollection('magicCircles', item.id);
            }
        });
    }

    // --- シーン管理 ---

    // Homeシーン表示
showHome() {
        this.isHome = true;
        this.setControlsEnabled(true);
        this.resetPlayerBaseStats();

        // ▼▼▼ 修正: 帰還時に必ず全ボタンのロックを解除する（これが原因でした） ▼▼▼
        this.setControlsEnabled(true);

        // 安全策: インライン戦利品エリアを隠す
        const lootArea = document.getElementById('battle-loot-area');
        if (lootArea) lootArea.style.display = 'none';
        if (this.ui.enemyGraphic) {
            this.ui.enemyGraphic.style.display = 'flex';
        }
        const enemyIntent = document.getElementById('enemy-intent');
        if (enemyIntent) enemyIntent.style.display = 'flex';

        // 念のため泉のオーバーレイを強制的に閉じる
        const springOverlay = document.getElementById('spring-overlay');
        if (springOverlay) springOverlay.style.display = 'none';

        this.depth = this.depth || 0; // 現在の深度

        // 10階層以上なら知恵フラグON
        if (this.depth >= 10) {
            this.canReceiveWisdom = true;
            this.showToast("深い階層からの生還により、妖精の泉が輝いている！", "info");
        }

        // 100階層深部到達ボーナス (色欲の上位装備)
        if (this.depth >= 100 && this.equipment.magic_circle && this.equipment.magic_circle.id === 'mc_lust') {
            if (!this.player.isLiberated) {
                const itemId = 'acc_lust_pendant';
                const hasItem = this.permInventory.some(i => i.id === itemId) || (this.equipment.accessory && this.equipment.accessory.id === itemId);
                if (!hasItem) {
                    const item = getItemById(itemId);
                    if (item) {
                        this.permInventory.push(item);
                        this.showFairyMessage("このペンダント……迷宮の奥底で拾ったんですが、なんだか熱いんです。");
                        this.showToast("条件達成！『色欲のペンダント』を獲得！", "success");
                    }
                }
            }
            else if (this.player.isLiberated) {
                const itemId = 'acc_lust_liberation';
                const hasItem = this.permInventory.some(i => i.id === itemId) || (this.equipment.accessory && this.equipment.accessory.id === itemId);
                if (!hasItem) {
                    const item = getItemById(itemId);
                    if (item) {
                        this.permInventory.push(item);
                        this.showFairyMessage("解放の証が……変質してしまいました。禍々しいけど、すごい魔力を感じます……！");
                        this.showToast("条件達成！『【色欲】解放の証』を獲得！", "success");
                    }
                }
            }
        }
        
        this.depth = 0; // リセット

        document.getElementById('player-area').classList.add('interactive');

        // タイマーリセット
        this.stopMessageTimer();

        const bubble = document.getElementById('speech-bubble');
        if (bubble) bubble.style.display = 'block';

        this.ui.battleCommands.style.display = 'none';

        this.player.hp = this.player.maxHp; // 全回復
        this.player.barrier = 0;
        this.player.currentStatus = null;
        this.player.buffs = [];

        this.updateStatsUI();
        this.updateDeckUI();
        
        this.menuUi.overlay.style.display = 'flex';
        this.menuUi.loot.style.display = 'none'; 

        let contentHtml = '';
        let titleText = '';

        if (this.tempInventory.length > 0) {
            titleText = "探索から帰還しました！今回の戦利品です";
            this.returnState = 'victory';

            contentHtml += `<div class="loot-list" style="display:block; max-height:250px; margin-bottom:10px;">`;
            contentHtml += this.tempInventory.map(item => 
                (item.cost !== undefined) 
                ? `<div class="loot-item">🃏 ${item.name} <small>${item.desc}</small></div>`
                : `<div class="loot-item">✨ ${item.name} <small>${this.getItemStatsString(item)}</small></div>`
            ).join('');
            contentHtml += `</div>`;
            contentHtml += `<div style="font-size:14px; color:#f1c40f;">アイテムは倉庫に移動されました。</div>`;

            this.tempInventory.forEach(item => {
                if (item.cost !== undefined) {
                    this.cardPool.push(item);
                } else {
                    this.permInventory.push(item);
                }
            });
            this.tempInventory = [];
        } else {
            titleText = "妖精の森（拠点）";
            contentHtml += `<div style="font-size:14px; color:#ccc; margin-top:10px;">準備を整えて、ダンジョンへ出発しましょう。</div>`;
        }

        this.menuUi.title.textContent = titleText;
        this.menuUi.content.innerHTML = contentHtml;
        
        this.menuUi.buttons.innerHTML = '';

        this.ui.systemCommands.style.display = 'flex';
        this.ui.systemCommands.innerHTML = '';

        const actions = [
            { text: "探索開始", onClick: () => this.startDungeon() }
        ];

        actions.push({ text: "試練の洞窟へ", onClick: () => this.confirmStartRogueMode() });
        actions.push({ text: "編成", onClick: () => this.openManagement() });
        actions.push({ text: "妖精の泉", onClick: () => this.showFairySpring(), style: "border-color:#4a90e2; color:#aaddff;" });
        actions.push({ text: "冒険譚", onClick: () => this.showAdventureLog() });

        this.renderSystemButtons(actions);

        this.updateFairyMessage();
        this.startMessageTimer();
        this.saveGame();
    }

    // 冒険譚画面の表示
    showAdventureLog() {
        // オーバーレイ作成
        const overlay = document.createElement('div');
        overlay.className = 'synthesis-view-container'; // 既存の全画面クラスを流用
        overlay.style.zIndex = "10000";

        // HTML構築
        overlay.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #fff; padding-bottom:10px;">
                <h2 style="margin:0; color:#fff;">冒険譚 (Adventure Log)</h2>
                <button class="btn close-btn" onclick="this.closest('.synthesis-view-container').remove()">閉じる</button>
            </div>
            
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <button class="btn" onclick="game.renderLogTab('accessory', this)">装飾品</button>
                <button class="btn" onclick="game.renderLogTab('magic_circle', this)">魔法陣</button>
                <button class="btn" onclick="game.renderLogTab('status', this)">状態異常</button>
            </div>

            <div id="log-content-area" style="flex:1; overflow-y:auto; background:rgba(0,0,0,0.3); padding:10px; border-radius:4px;">
                <div style="color:#aaa; text-align:center; margin-top:50px;">カテゴリを選択してください</div>
            </div>
        `;

        document.body.appendChild(overlay);
        
        // デフォルトで装飾品タブを開く
        setTimeout(() => this.renderLogTab('accessory', overlay.querySelectorAll('.btn')[1]), 0);
    }

    // タブ描画
    renderLogTab(category, btnElement) {
        const area = document.getElementById('log-content-area');
        if (!area) return;

        // ボタンのアクティブ化演出
        const btns = btnElement.parentNode.querySelectorAll('.btn');
        btns.forEach(b => b.style.filter = 'brightness(1.0)');
        btnElement.style.filter = 'brightness(1.3) drop-shadow(0 0 5px #fff)';

        area.innerHTML = '';

        let listHtml = '';
        
        // A. 装飾品タブ
        if (category === 'accessory') {
            // 1. 通常のアクセサリー (ACCESSORY_EFFECTS)
            ACCESSORY_EFFECTS.forEach(item => {
                const isUnlocked = this.collection.accessories.includes(item.id);
                listHtml += this.createLogItemHtml(item.name, item.desc, isUnlocked, "💍");
            });

            // 2. 解放の証 (ACCESSORY_PROOF_OF_LIBERATION)
            if (typeof ACCESSORY_PROOF_OF_LIBERATION !== 'undefined') {
                const item = ACCESSORY_PROOF_OF_LIBERATION;
                const isUnlocked = this.collection.accessories.includes(item.id);
                listHtml += this.createLogItemHtml(item.name, item.desc, isUnlocked, "👑");
            }

            // 3. エンドコンテンツ装備 (ENDGAME_ITEMS)
            if (typeof ENDGAME_ITEMS !== 'undefined') {
                ENDGAME_ITEMS.forEach(item => {
                    if (item.type === 'accessory') {
                        const isUnlocked = this.collection.accessories.includes(item.id);
                        listHtml += this.createLogItemHtml(item.name, item.desc, isUnlocked, "👑");
                    }
                });
            }
        }
        // B. 魔法陣タブ
        else if (category === 'magic_circle') {
            if (typeof MAGIC_CIRCLE_DATABASE !== 'undefined') {
                MAGIC_CIRCLE_DATABASE.forEach(item => {
                    const isUnlocked = this.collection.magicCircles.includes(item.id);
                    listHtml += this.createLogItemHtml(item.name, item.desc, isUnlocked, "🔯");
                });
            }
        }
        // C. 状態異常タブ
        else if (category === 'status') {
            Object.values(STATUS_TYPES).forEach(status => {
                const isUnlocked = this.collection.statuses.includes(status.id);
                listHtml += this.createLogItemHtml(status.name, status.desc || "詳細不明", isUnlocked, "💀");
            });
        }

        area.innerHTML = listHtml;
    }

    // HTML生成ヘルパー
    createLogItemHtml(name, desc, isUnlocked, icon) {
        const color = isUnlocked ? '#fff' : '#777';
        const bg = isUnlocked ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.2)';
        const nameText = isUnlocked ? name : '？？？？？';
        const descText = isUnlocked ? desc : '（未発見）';

        return `
            <div style="background:${bg}; border:1px solid ${isUnlocked ? '#aaa' : '#444'}; padding:10px; margin-bottom:8px; border-radius:4px; display:flex; align-items:center;">
                <div style="font-size:24px; margin-right:15px; opacity:${isUnlocked ? 1 : 0.3};">${icon}</div>
                <div>
                    <div style="font-weight:bold; color:${color}; font-size:16px;">${nameText}</div>
                    <div style="font-size:12px; color:#aaa; margin-top:4px;">${descText}</div>
                </div>
            </div>
        `;
    }

    // ローグライク用初期デッキ定義を取得
    getRogueDeckTemplates() {
        return [
            {
                id: 'magic', name: 'マジックデッキ', desc: '基本魔法と回復で安定して戦う構成',
                cards: { 'thunder': 3, 'drain': 3, 'cure_all': 2, 'heal': 2, 'reload': 2 }
            },
            {
                id: 'attack', name: 'アタックデッキ', desc: '物理スキルと重力魔法で攻める構成',
                cards: { 'magic_gravity': 2, 'skill_triple_pre': 3, 'charge_weapon': 3, 'vampire_form': 2, 'reload': 2 }
            },
            {
                id: 'defense', name: 'ディフェンスデッキ', desc: '防御を固めてカウンターを狙う構成',
                cards: { 'protection': 3, 'body_press': 3, 'skill_stone_form': 2, 'regen': 2, 'reload': 2 }
            },
            {
                id: 'minimum', name: 'ミニマムデッキ', desc: '縮小化状態を活用するテクニカルな構成',
                cards: { 'shrink_surge': 2, 'needle_rush': 4, 'magic_shrink_deep_dodge': 2, 'magic_shrink_heal': 2, 'reload': 2 }
            },
            {
                id: 'strip', name: 'ストリップデッキ', desc: '脱衣状態で真価を発揮するハイリスク構成',
                cards: { 'skill_cast_off': 2, 'magic_nature_heal': 2, 'skill_blushing_hammer': 2, 'skill_through_wind': 2, 'magic_paper_knife': 2, 'reload': 2 }
            },
            {
                id: 'chaos', name: 'カオスデッキ', desc: '自傷とランダム効果で戦場を撹乱する構成',
                cards: { 'chaos_gate': 1, 'trinity_burst': 1, 'reload': 2, 'magic_chaos_2': 4, 'magic_chaos_3': 4 }
            },
            {
                id: 'poison', name: 'ポイズンデッキ', desc: '状態異常を利用し、逆境を力に変える構成',
                cards: { 'magic_purge': 4, 'magic_turnaround': 4, 'passive_cursed_ring': 1, 'cure_size': 1, 'reload': 2 }
            },
            {
                id: 'random', name: 'ランダマイザー', desc: 'ランダムな6種のカード(x2)で開始する運試し',
                isRandom: true
            }
        ];
    }

    // --- ローグライクモード管理 ---

    confirmStartRogueMode() {
        if (confirm("【試練の洞窟】\n資産を持ち込めない「ローグライクモード」を開始します。\n現在の装備・デッキは一時的に預かり、終了時に返却されます。\nよろしいですか？")) {
            this.startRogueMode();
        }
    }

    showRogueDeckSelection() {
        // 1. デッキ候補の抽選 (全8種からランダム3種)
        const allDecks = this.getRogueDeckTemplates();
        // シャッフル
        for (let i = allDecks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allDecks[i], allDecks[j]] = [allDecks[j], allDecks[i]];
        }
        const candidates = allDecks.slice(0, 3); // 先頭3つを取得

        // 2. UI表示 (game-menu-overlayを利用)
        this.menuUi.overlay.style.display = 'flex';
        this.menuUi.title.textContent = "初期デッキ選択";
        this.menuUi.title.style.color = "#f1c40f";
        this.menuUi.loot.style.display = 'none';
        this.ui.battleCommands.style.display = 'none';
        this.ui.systemCommands.style.display = 'none';

        // デッキ選択肢のHTML生成
        let html = `<div style="margin-bottom:15px;">今回の運命を決めるデッキを選んでください。</div>`;
        html += `<div style="display:flex; flex-direction:column; gap:10px; width:100%;">`;
        
        candidates.forEach((deck, index) => {
            // 内容リスト作成
            let contents = "";
            if (deck.isRandom) {
                contents = "ランダムな魔法 x12";
            } else {
                const parts = [];
                for (const [id, count] of Object.entries(deck.cards)) {
                    const card = CARD_DATABASE.find(c => c.id === id);
                    const name = card ? card.name : id;
                    parts.push(`${name} x${count}`);
                }
                contents = parts.join(', ');
            }

            html += `
                <button class="btn" id="rogue-deck-btn-${index}" style="text-align:left; padding:15px; border:1px solid #777;">
                    <div style="font-weight:bold; color:#f1c40f; margin-bottom:5px;">${deck.name}</div>
                    <div style="font-size:12px; color:#ccc; margin-bottom:5px;">${deck.desc}</div>
                    <div style="font-size:11px; color:#aaa;">${contents}</div>
                </button>
            `;
        });
        html += `</div>`;

        this.menuUi.content.innerHTML = html;
        this.menuUi.buttons.innerHTML = ''; // 下部ボタンは不要（戻るボタンを置くならここ）

        // ボタンイベント設定 (innerHTMLで生成したため後付け)
        candidates.forEach((deck, index) => {
            document.getElementById(`rogue-deck-btn-${index}`).onclick = () => {
                this.confirmRogueDeck(deck);
            };
        });
    }

    confirmRogueDeck(deckDef) {
        let deckIds = [];

        if (deckDef.isRandom) {
            const candidates = CARD_DATABASE.filter(c => !c.isSynthesisOnly && c.type !== 'passive' && c.type !== 'none' && c.type !== 'misc');
            const selectedTypes = [];
            for (let i = 0; i < 6; i++) {
                if (candidates.length === 0) break;
                const idx = Math.floor(Math.random() * candidates.length);
                selectedTypes.push(candidates.splice(idx, 1)[0]); 
            }
            selectedTypes.forEach(card => deckIds.push(card.id, card.id));
        } else {
            for (const [id, count] of Object.entries(deckDef.cards)) {
                for (let i = 0; i < count; i++) deckIds.push(id);
            }
        }

        this.masterDeck = deckIds.map(id => CARD_DATABASE.find(c => c.id === id)).filter(c => c);
        this.cardPool = [];

        this.log(`デッキ『${deckDef.name}』で挑戦開始！`);
        this.startDungeon();
        this.showToast("【試練開始】装備とデッキは一時的に預かりました。", "warning");
    }

    startRogueMode() {
        // 1. 資産バックアップ
        this.backupData = JSON.parse(JSON.stringify({
            player: {
                hp: this.player.hp,
                maxHp: this.player.maxHp,
                atk: this.player.atk,
                def: this.player.def,
                int: this.player.int,
                spd: this.player.spd,
                runStats: this.player.runStats,
                flags: this.player.flags
            },
            inventory: this.permInventory,
            equipment: this.equipment,
            masterDeck: this.masterDeck.map(c => c.id),
            cardPool: this.cardPool.map(c => c.id)
        }));

        // 2. プレイヤー初期化 (Lv1相当, 初期デッキ, 装備なし)
        this.player = new Unit("妖精", 100, 10, 5, 15, 12, false, true);
        this.playerBaseStats = { maxHp: 100, atk: 10, def: 5, int: 15, spd: 12 };
        this.permInventory = [];
        this.equipment = { weapon: null, armor: null, accessory: null };
        this.tempInventory = [];

        // 3. モード設定
        this.mode = 'rogue';
        this.depth = 0;

        // ▼ 変更: デッキを決め打ちせず、選択画面へ遷移する
        this.showRogueDeckSelection();
    }

    endRogueMode() {
        if (!this.backupData) return;

        // 報酬判定 (復元前に生成する必要がある)
        // 条件: 10階層以上到達で、現在の階層に応じた装備を1つ獲得
        let rewardItem = null;
        if (this.depth >= 10) {
            // generateLootは現在のthis.depthを参照してアイテムを作るため、ここで呼べば適正レベルの報酬になる
            rewardItem = this.generateLoot();
            // ローグライク補正でプラス値が付きやすいが、持ち帰り用としてそのまま採用
        }

        // 1. 資産復元 (loadGameの一部ロジックを流用するか、ここで簡易復元)
        // ここでは簡易復元を行う（loadGameはlocalStorageから読むため）
        // 実際にはバックアップデータ構造に合わせて復元が必要
        // 今回はバックアップデータ構造が loadGame のデータ構造と似ているため、
        // 必要な部分を手動で戻す
        const data = this.backupData;
        
        Object.assign(this.player, data.player);
        // ステータス等は再計算されるので基礎値だけ戻せば良いが、
        // Unit生成時の初期値に戻してから装備等を適用するのが安全
        // ここでは playerBaseStats も戻すべきだが、backupに含まれていないため
        // 初期値に戻す
        this.playerBaseStats = { maxHp: 100, atk: 10, def: 5, int: 15, spd: 12 };

        this.permInventory = data.inventory;
        this.equipment = data.equipment;
        this.masterDeck = data.masterDeck.map(id => CARD_DATABASE.find(c => c.id === id)).filter(c => c);
        this.cardPool = data.cardPool.map(id => CARD_DATABASE.find(c => c.id === id)).filter(c => c);

        this.backupData = null;

        // 2. モード戻し
        this.mode = 'normal';
        
        // 報酬の付与 (復元後のインベントリに追加)
        if (rewardItem) {
            if (rewardItem.cost !== undefined) {
                this.cardPool.push(rewardItem);
            } else {
                this.permInventory.push(rewardItem);
            }
            // トーストで通知（少し遅らせて表示すると分かりやすい）
            setTimeout(() => {
                this.showToast(`✨ ローグライク報酬: ${rewardItem.name} を獲得！`, "success");
            }, 500);
        } else {
            // 10階未満だった場合
            if (this.depth < 10 && this.depth > 1) {
                this.showToast("報酬獲得には 地下10階 への到達が必要です", "warning");
            }
        }

        this.recalcStats();
        this.showToast("【試練終了】預かっていた装備とデッキを返却しました。", "success");
    }

    // 最強装備に変更（スロット対応版）
    equipBestGear() {
        // 1. 全て外す
        this.unequipAll();

        // 2. 各スロットの最強アイテムを探して装備
        const types = ['weapon', 'armor', 'accessory', 'magic_circle'];
        types.forEach(type => {
            // そのタイプのアイテムを抽出
            const items = this.permInventory.filter(i => i.type === type);
            if (items.length === 0) return;

            // 評価値（ATK + DEF）でソート (魔法陣は簡易スコア)
            items.sort((a, b) => {
                const getScore = (i) => {
                    if (i.type === 'magic_circle' && i.passive) {
                        // 簡易スコア: 倍率系なら (value - 1) * 1000
                        if (i.passive.type === 'stat_mult') return (i.passive.value - 1) * 1000;
                        if (i.passive.type === 'shrink_int') return (i.passive.intMult - 1) * 1000;
                        return 10;
                    }
                    return (i.atk||0) + (i.def||0) + (i.int||0);
                };
                return getScore(b) - getScore(a);
            });
            
            // 最強を装備
            const bestItem = items[0];
            this.equipItem(type, this.permInventory.indexOf(bestItem));
        });

        this.showToast("最強装備に変更しました！", 'success');
        this.showHome(); // UI更新
    }

    // 全装備解除ヘルパー
    unequipAll() {
        ['weapon', 'armor', 'accessory', 'magic_circle'].forEach(slot => {
            if (this.equipment[slot]) {
                this.permInventory.push(this.equipment[slot]);
                this.equipment[slot] = null;
            }
        });
        this.recalcStats();
    }

    // 膨張レベルの操作 (amount: 増加量または減少量)
    // return: 実際に変化したか
    processExpansion(amount) {
        // 1. 増加の場合の防止チェック
        if (amount > 0) {
            // 魔法陣: 脱衣時回避+20% & 膨張無効 (mc_prevent_expansion)
            if (this.equipment.magic_circle && this.equipment.magic_circle.passive && this.equipment.magic_circle.passive.type === 'prevent_expansion') {
                this.log("魔法陣が肉体の変質を抑制した！(膨張無効)");
                return false;
            }
        }

        const oldLv = this.player.expansionLevel;
        this.player.expansionLevel = Math.max(0, Math.min(3, this.player.expansionLevel + amount));

        if (this.player.expansionLevel !== oldLv) {
            if (this.player.expansionLevel > oldLv) {
                this.log(`肉体が膨張した！ (Lv${this.player.expansionLevel})`);
                
                // ▼ 追加: 冒険譚への登録 (初めて膨張した時に記録)
                this.registerCollection('statuses', 'expansion');
            } else {
                this.log(`膨張が収まった…… (Lv${this.player.expansionLevel})`);
            }
            this.updateCharacterSprite(); // 立ち絵更新
            this.updateStatsUI();
            return true;
        }
        return false;
    }

    // アイテム装備処理
    equipItem(slot, inventoryIndex) {
        const item = this.permInventory[inventoryIndex];
        
        // 既に装備しているものがあれば外す
        if (this.equipment[slot]) {
            this.permInventory.push(this.equipment[slot]);
        }

        // 装備セット
        this.equipment[slot] = item;
        // インベントリから削除
        this.permInventory.splice(inventoryIndex, 1);

        // [Stats] 装備変更フラグ
        this.player.runStats.everEquipped = true;

        this.recalcStats();
        this.saveGame(); // 装備変更セーブ
    }

// BattleSystem.js - recalcStats メソッドの修正
    // 基礎ステータスを初期値にリセットする
    resetPlayerBaseStats() {
        this.playerBaseStats = { ...DEFAULT_PLAYER_STATS };
        this.recalcStats();    // 装備の下限Lvなどを再適用
        this.updateStatsUI();  
        this.updateSpringUI(); // 泉のUI（ボタンの活性化状態）も同期
    }
// --- ヘルパーメソッド: 変性レベルの下限チェック ---

// 現在の装備などによる「縮小レベルの下限」を取得
    getMinShrinkLevel() {
        let maxMin = (this.player && this.player.minShrinkLevel) ? this.player.minShrinkLevel : 0;
        
        Object.values(this.equipment).forEach(item => {
            if (!item) return;

            // 1. IDを直接チェック
            if (item.id) {
                // 小人の留め針 (pin_small_1 ~ 3)
                if (item.id.startsWith('pin_small_')) {
                    const level = parseInt(item.id.split('_').pop());
                    if (!isNaN(level)) maxMin = Math.max(maxMin, level);
                }
                // 小人の魔法陣 (mc_shrink_int_1 ~ 3)
                if (item.id.startsWith('mc_shrink_int_')) {
                    const level = parseInt(item.id.split('_').pop());
                    if (!isNaN(level)) maxMin = Math.max(maxMin, level);
                }
            }

            // 2. プロパティによる判定 (minShrinkLevel または minLevel)
            const p = item.passive || item;
            const val = p.minShrinkLevel || p.minLevel;
            if (val) maxMin = Math.max(maxMin, val);
        });
        return maxMin;
    }
    // 現在の装備などによる「膨張レベルの下限」を取得
    getMinExpansionLevel() {
        let minLv = 0;
        
        // 色欲の魔法陣は強制的にレベルを固定するため、実質的な下限となる
        if (this.equipment.magic_circle && this.equipment.magic_circle.id === 'mc_lust') {
            const hasComboItem = this.equipment.accessory && 
                                 (this.equipment.accessory.id === 'acc_lust_pendant' || 
                                  this.equipment.accessory.id === 'acc_lust_liberation');
            // コンボ時はLv4固定、単体でもLv3固定 -> これが下限になる
            minLv = hasComboItem ? 4 : 3;
        }
        return minLv;
    }
// BattleSystem.js

// ステータス再計算
    recalcStats() {
        if (!this.player) return;

        // --- 1. 下限の強制適用 ---
        let minShrink = this.getMinShrinkLevel();
        let minExp = this.getMinExpansionLevel();
        
        // ▼ 追加: 固定の魔法陣判定
        const mc = this.equipment.magic_circle;
        const isFixedMc = (mc && mc.id === 'mc_click_fixed');
        if (isFixedMc) {
            minShrink = 3;
            minExp = 3;
        }

        if ((this.player.shrinkLevel || 0) < minShrink) this.player.shrinkLevel = minShrink;
        if ((this.player.expansionLevel || 0) < minExp) this.player.expansionLevel = minExp;

        // --- 2. フラグ確定 ---
        this.player.isLiberated = !!Object.values(this.equipment).find(item => 
            item && (item.isLiberationProof || (item.passive && item.passive.isLiberationProof))
        );

        let addAtk = 0, addDef = 0, addInt = 0, addSpd = 0, addMaxHp = 0;
        let statMultipliers = { atk: 1.0, def: 1.0, int: 1.0, spd: 1.0, hp: 1.0 };
        let ignoreStripPenalty = false;

        // --- 3. 装備ループ ---
        Object.values(this.equipment).forEach(item => {
            if (!item) return;

            // 基礎値加算
            addAtk += (item.atk || 0);
            addDef += (item.def || 0);
            addInt += (item.int || 0);
            addSpd += (item.spd || 0);
            addMaxHp += (item.hp || 0);

            const p = item.passive || item; 

            // 脱衣ペナルティ無効化
            if (p.ignoreStripPenalty) ignoreStripPenalty = true;

            // --- パッシブ倍率の適用 ---
            
            // A. 汎用倍率 (HP+20%などの mc_hp_up 系)
            if (p.type === 'stat_mult' && p.stat && p.value) {
                if (statMultipliers[p.stat]) statMultipliers[p.stat] *= p.value;
            }

            // B. 小人の魔法陣 (shrink_int)
            if (p.type === 'shrink_int' && p.intMult) {
                statMultipliers.int *= p.intMult;
            }

            // C. 複合ステータス補正 (ENDGAME_ITEMS や一部の魔法陣用)
            if (p.stats) {
                if (p.stats.atkMult) statMultipliers.atk *= p.stats.atkMult;
                if (p.stats.defMult) statMultipliers.def *= p.stats.defMult;
                if (p.stats.intMult) statMultipliers.int *= p.stats.intMult;
                if (p.stats.spdMult) statMultipliers.spd *= p.stats.spdMult;
                if (p.stats.hpMult)  statMultipliers.hp  *= p.stats.hpMult;
            }

            // D. 個別ID補正 (色欲など)
            if (item.id === 'acc_lust_pendant') statMultipliers.def *= 1.2;
            if (item.id === 'acc_lust_liberation') {
                statMultipliers.int *= 1.5;
                statMultipliers.spd *= 1.5;
            }
        });

        // --- 4. 状態異常と変性計算 ---
        // ▼ 修正: 固定の魔法陣ならペナルティを無効化
        if (!isFixedMc) {
            if (this.player.hasStatus('undressing') && !ignoreStripPenalty) {
                statMultipliers.def = 0; 
            }
        }

        // 色欲コンボ
        if (mc && mc.id === 'mc_lust') {
            const hasCombo = !!Object.values(this.equipment).find(item => 
                item && (item.id === 'acc_lust_pendant' || item.id === 'acc_lust_liberation')
            );
            this.player.expansionLevel = hasCombo ? 4 : 3;
            if (!this.player.hasStatus('undressing')) this.player.addStatus('undressing', 99);
        }

        // 膨張/縮小による最終補正
        const expLv = this.player.expansionLevel || 0;
        if (expLv > 0) {
            statMultipliers.atk *= (1.0 + 0.3 * expLv);
            if (expLv === 4) statMultipliers.atk *= 1.1;
            
            if (!isFixedMc) { // デメリット無効化
                if (expLv === 4) statMultipliers.spd *= 0.1;
                else statMultipliers.spd *= Math.max(0.1, 1.0 - 0.3 * expLv);
            }
        }

        const shrinkLv = this.player.shrinkLevel || 0;
        if (shrinkLv > 0) {
            const s = SHRINK_STATS[`LV${shrinkLv}`];
            if (s) {
                if (!isFixedMc) { // デメリット無効化
                    statMultipliers.atk *= s.atk;
                }
                statMultipliers.spd *= s.spdMult;
            }
        }

        // --- 5. 最終値確定 ---
        this.player.maxHp = Math.floor((this.playerBaseStats.maxHp + addMaxHp) * statMultipliers.hp);
        this.player.atk = Math.floor((this.playerBaseStats.atk + addAtk) * statMultipliers.atk);
        this.player.def = Math.floor((this.playerBaseStats.def + addDef) * statMultipliers.def);
        this.player.int = Math.floor((this.playerBaseStats.int + addInt) * statMultipliers.int);
        this.player.spd = Math.floor((this.playerBaseStats.spd + addSpd) * statMultipliers.spd);

        if (this.player.hp > this.player.maxHp) this.player.hp = this.player.maxHp;

        // --- 最終: 反転の魔法陣 (ATK/INT入替) ---
        if (mc && mc.id === 'mc_click_swap') {
            const temp = this.player.atk;
            this.player.atk = this.player.int;
            this.player.int = temp;
        }
    }

    // --- 編成画面ロジック ---

    openManagement() {
        // 吹き出しを隠す＆タイマー停止
        this.stopMessageTimer();
        const bubble = document.getElementById('speech-bubble');
        if (bubble) {
            bubble.style.display = 'none';
            bubble.classList.remove('visible');
        }

        this.mgmtUi.overlay.style.display = 'flex';
        this.updateMgmtBonusUI(); // ボーナス表示更新
        this.validateDeck(); // 初期状態チェック
        this.switchTab('equip'); // デフォルトは装備タブ

        // 合成タブボタンの追加（存在しなければ）
        if (!document.getElementById('tab-synthesis')) {
            const tabContainer = document.querySelector('.mgmt-header');
            const synthTab = document.createElement('button');
            synthTab.id = 'tab-synthesis';
            synthTab.className = 'mgmt-tab';
            synthTab.textContent = '合成';
            synthTab.onclick = () => this.switchTab('synthesis');
            tabContainer.appendChild(synthTab);
        }
    }

    closeManagement() {
        // ボタンが無効化されている場合は処理しない（念のため）
        if (this.mgmtUi.saveBtn.disabled) return;
        
        this.mgmtUi.overlay.style.display = 'none';
        this.recalcStats(); // 構成変更を反映
        this.saveGame(); // 編成終了セーブ

        // [修正] 戻り先の分岐
        if (this.mode === 'rogue' && !this.isHome) {
            // ダンジョン探索中の場合、ダンジョン選択肢を再描画
            this.renderDungeonButtons();
        } else {
            this.showHome(); // Home画面更新
        }
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // タブスタイル更新
        this.mgmtUi.tabEquip.className = tabName === 'equip' ? 'mgmt-tab active' : 'mgmt-tab';
        this.mgmtUi.tabDeck.className = tabName === 'deck' ? 'mgmt-tab active' : 'mgmt-tab';
        const synthTab = document.getElementById('tab-synthesis');
        if (synthTab) synthTab.className = tabName === 'synthesis' ? 'mgmt-tab active' : 'mgmt-tab';

        // --- UI改修：合成画面のレイアウト拡張 ---
        const footer = this.mgmtUi.overlay.querySelector('.mgmt-footer');
        const content = this.mgmtUi.content;

        if (tabName === 'synthesis') {
            if (footer) footer.style.display = 'none'; // フッターを隠して高さを確保
            content.style.padding = '0'; // コンテナが全域を覆うため親のパディングを削除
            this.selectedSynthesisItems = []; // 選択リセット
            this.renderSynthesisTab();
            
            // 【奥の手】ボタン群を隠す
            this.toggleHomeButtons(false);
        } else {
            if (footer) footer.style.display = 'flex'; // 他タブではフッターを再表示
            content.style.padding = '10px';
            content.innerHTML = ''; // 合成画面が残らないようにクリア
            
            // 【奥の手】ボタン群を戻す
            this.toggleHomeButtons(true);

            if (tabName === 'equip') {
                this.renderEquipTab();
            } else if (tabName === 'deck') {
                this.renderDeckTab();
            }
        }
    }

    // ボタン群の表示切り替え（テキスト検索による強制非表示）
    toggleHomeButtons(isVisible) {
        const allButtons = document.querySelectorAll('button');
        let targetContainer = null;

        // "探索開始" という文字を含むボタンを探す
        for (const btn of allButtons) {
            if (btn.textContent && btn.textContent.includes('探索開始')) {
                // そのボタンの親要素（コンテナ）を特定する
                targetContainer = btn.parentElement; 
                break;
            }
        }

        // コンテナが見つかったら表示/非表示を切り替え
        if (targetContainer) {
            targetContainer.style.display = isVisible ? 'flex' : 'none';
        }
    }

    // 装備解除
    unequipItem(slotId) {
        if (this.equipment[slotId]) {
            this.permInventory.push(this.equipment[slotId]);
            this.equipment[slotId] = null;
            this.recalcStats();
            this.renderEquipTab();
            this.showToast("装備を外しました");
            this.saveGame(); // 装備解除セーブ
        }
    }

    renderEquipTab() {
        // 1. 書き換え前に現在のスクロール位置を保存
        const currentScroll = this.mgmtUi.content ? this.mgmtUi.content.scrollTop : 0;

        const slots = [
            { id: 'weapon', label: '武器 (Weapon)' },
            { id: 'armor', label: '防具 (Armor)' },
            { id: 'accessory', label: '装飾 (Accessory)' },
            { id: 'magic_circle', label: '魔法陣 (Circle)' }
        ];

        let leftHtml = `<h3>現在の装備</h3>`;
        leftHtml += `
            <div style="text-align:center; margin-bottom:10px;">
                <button class="btn" onclick="game.equipBestGear()" style="font-size:12px; padding:5px 10px; background:#e67e22;">最強装備をセット</button>
            </div>
        `;
        
        slots.forEach(slot => {
            const item = this.equipment[slot.id];
            const itemName = item ? item.name : "なし";
            const itemStats = item ? `(${this.getItemStatsString(item)})` : "";
            leftHtml += `
                <div class="equip-slot" onclick="game.unequipItem('${slot.id}')" style="cursor: pointer;" title="クリックで解除">
                    <label>${slot.label}</label>
                    <div>${itemName} <small>${itemStats}</small></div>
                </div>`;
        });

        let rightHtml = `<h3>所持品リスト (最強のみ表示)</h3>`;
        if (this.permInventory.length === 0) {
            rightHtml += `<div style="color:#ccc; padding:10px;">装備品を所持していません (No Equipment)</div>`;
        } else {
            // フィルタリング: 同名アイテムは補正値が最も高いものだけを表示
            const bestItems = {};
            this.permInventory.forEach((item, index) => {
                const baseName = item.name.replace(/\(\+\d+\)$/, '');
                if (!bestItems[baseName] || (item.plusValue || 0) > (bestItems[baseName].item.plusValue || 0)) {
                    bestItems[baseName] = { item, index };
                }
            });

            // 元のインデックス順（に近い形）で表示
            const displayList = Object.values(bestItems).sort((a, b) => a.index - b.index);

            displayList.forEach(({ item, index }) => {
                rightHtml += `
                    <div class="list-item" onclick="game.handleEquipClick(${index})">
                        <div>${item.name} <span style="font-size:11px; background:#555; padding:2px; border-radius:3px;">${item.type}</span></div>
                        <small>${this.getItemStatsString(item)}</small>
                    </div>`;
            });
        }

        this.mgmtUi.content.innerHTML = `
            <div class="mgmt-col">${leftHtml}</div>
            <div class="mgmt-col">${rightHtml}</div>
        `;

        
        // 2. 描画完了後、次の描画タイミングでスクロール位置を復元
        if (this.mgmtUi.content) {
            requestAnimationFrame(() => {
                this.mgmtUi.content.scrollTop = currentScroll;
            });
        }
    }

    getItemStatsString(item) {
        const parts = [];
        if (item.cost !== undefined) return item.desc; // カードの場合
        if (item.atk && item.atk !== 0) parts.push(`ATK:${item.atk}`);
        if (item.def && item.def !== 0) parts.push(`DEF:${item.def}`);
        if (item.int && item.int !== 0) parts.push(`INT:${item.int}`);
        if (item.hp && item.hp !== 0) parts.push(`HP:${item.hp}`);
        if (item.spd && item.spd !== 0) parts.push(`SPD:${item.spd}`);
        if (item.passive) parts.push(`★${item.passive.name}`);
        return parts.join(' ') || '効果なし';
    }

    handleEquipClick(index) {
        const item = this.permInventory[index];
        if (!item) return;
        this.equipItem(item.type, index);
        this.renderEquipTab(); // 再描画
    }

    renderDeckTab() {
                // 1. 書き換え前に現在のスクロール位置を保存
        const currentScroll = this.mgmtUi.content ? this.mgmtUi.content.scrollTop : 0;

        // デッキをID順にソート
        this.masterDeck.sort((a, b) => a.id.localeCompare(b.id));

        // 左：現在のデッキ
        let leftHtml = `<h3>現在のデッキ (${this.masterDeck.length}/20)</h3>`;
        this.masterDeck.forEach((card, index) => {
            leftHtml += `
                <div class="list-item" onclick="game.removeCardFromDeck(${index})">
                    <div>${card.name}</div>
                    <small>${card.desc}</small>
                </div>`;
        });

        // 右：カードプール
        let rightHtml = `<h3>カードプール (所持カード)</h3>`;
        if (this.cardPool.length === 0) {
            rightHtml += `<div style="color:#ccc; padding:10px;">予備カードはありません</div>`;
        } else {
            this.cardPool.forEach((card, index) => {
                rightHtml += `
                    <div class="list-item" onclick="game.addCardToDeck(${index})">
                        <div>${card.name}</div>
                        <small>${card.desc}</small>
                    </div>`;
            });
        }

        this.mgmtUi.content.innerHTML = `
            <div class="mgmt-col">${leftHtml}</div>
            <div class="mgmt-col">${rightHtml}</div>
        `;

        // 2. 描画完了後、次の描画タイミングでスクロール位置を復元
        if (this.mgmtUi.content) {
            requestAnimationFrame(() => {
                this.mgmtUi.content.scrollTop = currentScroll;
            });
        }
    }

    addCardToDeck(poolIndex) {
        if (this.masterDeck.length >= 40) {
            this.showToast("デッキの上限枚数です", 'warning');
            return;
        }
        const card = this.cardPool.splice(poolIndex, 1)[0];
        this.masterDeck.push(card);
        
        this.updateMgmtBonusUI(); // ボーナス表示更新
        this.validateDeck(); // バリデーション更新
        this.renderDeckTab();
        this.saveGame(); // デッキ変更セーブ
    }

    removeCardFromDeck(deckIndex) {
        const card = this.masterDeck.splice(deckIndex, 1)[0];
        this.cardPool.push(card);
        this.renderDeckTab();
        this.updateMgmtBonusUI(); // ボーナス表示更新
        this.validateDeck(); // バリデーション更新
        this.saveGame(); // デッキ変更セーブ
    }

    // --- 合成画面ロジック ---

    renderSynthesisTab() {
        // モード切替ボタン
        const modeHtml = `
            <div style="display:flex; gap:10px; margin-bottom:10px; justify-content:center;">
                <button class="btn" style="padding:5px 15px; font-size:14px; ${this.synthesisMode === 'equip' ? 'background:#f1c40f; color:#333;' : ''}" onclick="game.switchSynthesisMode('equip')">装備合成</button>
                <button class="btn" style="padding:5px 15px; font-size:14px; ${this.synthesisMode === 'card' ? 'background:#9b59b6; color:#fff;' : ''}" onclick="game.switchSynthesisMode('card')">カード合成</button>
            </div>
        `;

        if (this.synthesisMode === 'equip') {
            this.renderEquipSynthesis(modeHtml);
        } else {
            this.renderCardSynthesis(modeHtml);
        }
    }

    switchSynthesisMode(mode) {
        this.synthesisMode = mode;
        this.selectedSynthesisItems = []; // 選択リセット
        this.renderSynthesisTab();
    }

    // 装備合成画面
    renderEquipSynthesis(headerHtml) {
        let gridHtml = `<h3>素材を選択 (3つ)</h3><div class="synthesis-item-list">`;
        if (this.permInventory.length < 3) {
            gridHtml += `<div style="color:#ccc; padding:10px; grid-column: 1 / -1;">合成できる装備が3つ未満です</div>`;
        } else {
            this.permInventory.forEach((item, index) => {
                const isSelected = this.selectedSynthesisItems.includes(index);
                const selectedClass = isSelected ? 'selected' : '';
                const plusValue = item.plusValue ? `+${item.plusValue}` : '';
                const baseName = item.name.replace(/\(\+\d+\)$/, '');

                gridHtml += `
                    <div class="synthesis-item-card ${selectedClass}" onclick="game.toggleSynthesisSelection(${index})">
                        <div style="font-weight:bold; font-size:12px;">${baseName}</div>
                        <div style="color:#f1c40f; font-weight:bold;">${plusValue}</div>
                        <small>${item.type}</small>
                    </div>`;
            });
        }
        gridHtml += `</div>`;

        const canSynthesize = this.selectedSynthesisItems.length === 3;
        const actionHtml = `
            <div style="text-align:center; margin-top:auto; padding-top: 10px;">
                <div style="margin-bottom:5px; font-size:14px;">選択中: ${this.selectedSynthesisItems.length} / 3</div>
                <button class="btn" style="width:100%; max-width: 300px;" ${canSynthesize ? '' : 'disabled'} onclick="game.executeEquipSynthesis()">合成！</button>
                <button class="btn" style="width:100%; max-width: 300px; margin-top: 5px; background-color: #7f8c8d; color: white;" onclick="game.switchTab('equip')">戻る</button>
            </div>
        `;

        this.mgmtUi.content.innerHTML = `
            <div class="synthesis-view-container">
                ${headerHtml}
                ${gridHtml}
                ${actionHtml}
            </div>
        `;
    }

    // カード合成画面
    renderCardSynthesis(headerHtml) {
        let gridHtml = `<h3>素材を選択 (3枚)</h3><div class="synthesis-item-list">`;
        if (this.cardPool.length < 3) {
            gridHtml += `<div style="color:#ccc; padding:10px; grid-column: 1 / -1;">合成できるカードが3枚未満です</div>`;
        } else {
            // 所持数カウント
            const counts = {};
            this.cardPool.forEach(c => counts[c.id] = (counts[c.id] || 0) + 1);
            // デッキに入っている分も考慮すべきだが、ここではプールのみ対象

            this.cardPool.forEach((card, index) => {
                const isSelected = this.selectedSynthesisItems.includes(index);
                const selectedClass = isSelected ? 'selected' : '';
                const countInfo = counts[card.id] >= 5 ? `<span style="color:#e74c3c; font-weight:bold;">(余剰)</span>` : '';
                
                gridHtml += `
                    <div class="synthesis-item-card ${selectedClass}" onclick="game.toggleSynthesisSelection(${index})">
                        <div style="font-weight:bold;">${card.name}</div>
                        <small>${countInfo}</small>
                    </div>`;
            });
        }
        gridHtml += `</div>`;

        const canSynthesize = this.selectedSynthesisItems.length === 3;
        const actionHtml = `
            <div style="text-align:center; margin-top:auto; padding-top: 10px;">
                <div style="margin-bottom:5px; font-size:14px;">選択中: ${this.selectedSynthesisItems.length} / 3</div>
                <button class="btn" style="width:100%; max-width: 300px;" ${canSynthesize ? '' : 'disabled'} onclick="game.executeCardSynthesis()">合成！</button>
                <button class="btn" style="width:100%; max-width: 300px; margin-top: 5px; background-color: #7f8c8d; color: white;" onclick="game.switchTab('equip')">戻る</button>
            </div>
        `;

        this.mgmtUi.content.innerHTML = `
            <div class="synthesis-view-container">
                ${headerHtml}
                ${gridHtml}
                ${actionHtml}
            </div>
        `;
    }

    toggleSynthesisSelection(index) {
        const pos = this.selectedSynthesisItems.indexOf(index);
        if (pos >= 0) {
            this.selectedSynthesisItems.splice(pos, 1);
        } else {
            if (this.selectedSynthesisItems.length < 3) {
                this.selectedSynthesisItems.push(index);
            } else {
                this.showToast("3つまでしか選択できません", "warning");
            }
        }
        this.renderSynthesisTab();
    }

    executeEquipSynthesis() {
        if (this.selectedSynthesisItems.length !== 3) return;

        // 素材取得
        const materials = this.selectedSynthesisItems.map(idx => this.permInventory[idx]);
        
        // 平均レベルと強化値計算
        let totalLevel = 0;
        let totalPlus = 0;
        materials.forEach(m => {
            totalLevel += (m.level || 1);
            totalPlus += (m.plusValue || 0);
        });
        const avgLevel = Math.floor(totalLevel / 3);
        const avgPlus = Math.floor(totalPlus / 3);

        // 素材削除 (インデックスが大きい順に削除しないとずれる)
        this.selectedSynthesisItems.sort((a, b) => b - a);
        this.selectedSynthesisItems.forEach(idx => {
            this.permInventory.splice(idx, 1);
        });

        // 新アイテム生成
        // ボーナス: 20%でレベル+5
        const bonusLevel = (Math.random() < 0.2) ? 5 : 0;
        const newDepth = avgLevel + bonusLevel;
        
        // generateLootを再利用したいが、depth依存なので一時的にdepthを偽装するか、専用ロジックを作る
        // ここでは generateSynthesizedItem を実装
        const newItem = this.generateSynthesizedItem(newDepth, avgPlus);

        if (newItem.cost !== undefined) {
            this.cardPool.push(newItem);
            this.showToast(`合成変異！ 魔法カード ${newItem.name} になった！`, "success");
        } else {
            this.permInventory.push(newItem);
            this.showToast(`合成成功！ ${newItem.name} を獲得！`, "success");
        }

        this.permInventory.push(newItem);
        this.selectedSynthesisItems = [];
        
        // 演出
        const msg = this.getRandomDialogue(FAIRY_DIALOGUE_DATA.synthesis_equip);
        this.showToast(msg, "success");
        this.showToast(`合成成功！ ${newItem.name} を獲得！`, "success");
        
        this.renderSynthesisTab();
        this.saveGame(); // 合成セーブ
    }

    executeCardSynthesis() {
        if (this.selectedSynthesisItems.length !== 3) return;

        // [拡張] レシピ合成チェック (神秘の欠片 x3)
        const selectedCards = this.selectedSynthesisItems.map(idx => this.cardPool[idx]);
        if (selectedCards.every(c => c.id === 'misc_mystery_fragment')) {
            this.performFixedSynthesis('magic_miracle_light');
            return;
        }

        this.performRandomCardSynthesis();
    }

    performRandomCardSynthesis() {
        // 素材として使用したカードのIDを記録
        const materialIds = this.selectedSynthesisItems.map(idx => this.cardPool[idx].id);

        // 素材削除
        this.selectedSynthesisItems.sort((a, b) => b - a);
        this.selectedSynthesisItems.forEach(idx => {
            this.cardPool.splice(idx, 1);
        });

        // 新カード生成 (フィルタリング適用)
        const candidates = CARD_DATABASE.filter(c => 
            !c.isSynthesisOnly && // 合成専用は除外
            !materialIds.includes(c.id) // 素材と同じカードは除外
        );

        // 候補がない場合のフォールバック (石など)
        const pool = candidates.length > 0 ? candidates : [CARD_DATABASE.find(c => c.id === 'stone')];

        const newCard = pool[Math.floor(Math.random() * pool.length)];
        this.cardPool.push(newCard);
        
        this.selectedSynthesisItems = [];

        // 演出
        const msg = this.getRandomDialogue(FAIRY_DIALOGUE_DATA.synthesis_card);
        this.showToast(msg, "success");
        this.showToast(`合成成功！ ${newCard.name} を獲得！`, "success");

        this.renderSynthesisTab();
        this.saveGame(); // 合成セーブ
    }

    performFixedSynthesis(resultId) {
        // 素材削除
        this.selectedSynthesisItems.sort((a, b) => b - a);
        this.selectedSynthesisItems.forEach(idx => {
            this.cardPool.splice(idx, 1);
        });

        const newCard = CARD_DATABASE.find(c => c.id === resultId);
        this.cardPool.push(newCard);
        this.selectedSynthesisItems = [];

        const msg = "不思議な光が溢れ出す……！";
        this.showToast(msg, "success");
        this.showToast(`合成大成功！ ${newCard.name} を獲得！`, "success");
        this.renderSynthesisTab();
        this.saveGame(); // 合成セーブ
    }

    generateSynthesizedItem(level, basePlus) {
        // generateLoot のロジックを流用・調整
        // ドロップ率調整: 武器40%, 防具40%, 装飾20%
        const rand = Math.random();
        let type = 'weapon';
        if (rand < 0.4) type = 'weapon';
        else if (rand < 0.8) type = 'armor';
        else type = 'accessory';

        // 一時的にdepthを書き換えて生成
        const originalDepth = this.depth;
        this.depth = level;
        
        // generateLootは内部で this.depth を参照する
        // また、plusValueは depth/3 で計算されるため、basePlusを加算したい
        // ここでは generateLoot を呼んだ後、plusValueを上書き・再計算する
        const item = this.generateLoot();
        
        this.depth = originalDepth; // 戻す

        return item;
    }

    // 編成画面用のボーナス表示更新
    updateMgmtBonusUI() {
        const cardIds = this.masterDeck.map(c => c.id);
        const isUnique = cardIds.length > 0 && new Set(cardIds).size === cardIds.length;
        const isHeavy = this.masterDeck.length >= 24;

        this.mgmtUi.bonusUnique.style.opacity = isUnique ? '1' : '0.3';
        this.mgmtUi.bonusUnique.style.color = isUnique ? '#3498db' : '#ecf0f1';
        this.mgmtUi.bonusUnique.style.fontWeight = isUnique ? 'bold' : 'normal';
        this.mgmtUi.bonusUnique.textContent = isUnique ? '★ Technician (INT+20%)' : '★ Technician (INT+20%)';

        this.mgmtUi.bonusHeavy.style.opacity = isHeavy ? '1' : '0.3';
        this.mgmtUi.bonusHeavy.style.color = isHeavy ? '#2ecc71' : '#ecf0f1';
        this.mgmtUi.bonusHeavy.style.fontWeight = isHeavy ? 'bold' : 'normal';
        this.mgmtUi.bonusHeavy.textContent = isHeavy ? '★ Heavy (DEF+20%)' : '★ Heavy (DEF+20%)';
    }

    // デッキのバリデーションチェック
    validateDeck() {
        const deckCount = this.masterDeck.length;
        const errors = [];

        // 枚数制限
        if (deckCount < 12) errors.push(`あと ${12 - deckCount} 枚足りません`);
        if (deckCount > 40) errors.push(`枚数が多すぎます (Max 40)`);

        // 同名カード制限
        const counts = {};
        this.masterDeck.forEach(c => {
            counts[c.id] = (counts[c.id] || 0) + 1;
            if (counts[c.id] > 4) {
                 // 重複エラーは1回だけ追加
                 if (!errors.some(e => e.includes(c.name))) {
                     errors.push(`${c.name}は4枚までです`);
                 }
            }
        });

        const saveButton = this.mgmtUi.saveBtn;
        const errorText = this.mgmtUi.errorMsg;
        
        if (errors.length > 0) {
            saveButton.disabled = true;
            saveButton.style.opacity = 0.5;
            errorText.innerText = errors.join('\n');
            errorText.style.color = '#e74c3c'; // Red
        } else {
            saveButton.disabled = false;
            saveButton.style.opacity = 1;
            errorText.innerText = '保存可能';
            errorText.style.color = '#2ecc71'; // Green
        }
    }

    // ダンジョン開始（Depth 1）
    startDungeon() {
        this.isHome = false;
                
        // ▼▼▼ 追加: 基礎ステータスをリセットして開始 ▼▼▼
        this.resetPlayerBaseStats();
        document.getElementById('player-area').classList.remove('interactive');

        this.stopMessageTimer(); // 独り言停止
        // デッキ初期化（現在の構成を使用）
        // 吹き出しを非表示
        const bubble = document.getElementById('speech-bubble');
        if (bubble) bubble.style.display = 'none';

        this.restCount = 3; // 休憩回数リセット
        this.deck.initializeDeck(this.masterDeck);

        this.depth = 0;
        // ▼ 追加: 防壁リセット
        this.player.barrier = 0;

        // [Stats] 統計リセット
        this.player.runStats = {
            magicUse: 0,
            attackUse: 0,
            selfStripCount: 0,
            escapeCount: 0,
            maxFloor: 0,
            everEquipped: false
        };
        this.tempInventory = []; // 仮インベントリリセット
        this.goNextFloor();
    }

    // 次の階層へ
// 次のフロアへ進む（探索処理）
    async goNextFloor() {
        // 安全策: 戦利品画面を閉じる
        const lootArea = document.getElementById('battle-loot-area');
        if (lootArea) lootArea.style.display = 'none';

        this.depth++;
        this.turnCount = 0; // ターンリセット
        this.log(`地下 ${this.depth} 階に到達した。`);

        // 10階層ごとにボス
        if (this.depth % 10 === 0) {
            this.encounterEnemy(true); // ボス戦
            return;
        }

        // --- ランダム判定の重み付け ---
        const eventRoll = Math.random();

        // 1. 特殊状態イベント (15%)：脱衣 or 膨張Lv3以上
        if (eventRoll < 0.15) {
            if ((this.player.hasStatus('undressing') || this.player.isLiberated) && Math.random() < 0.5) {
                await this.eventMagicMist(); // 魔力霧
                return;
            }
            if (this.player.expansionLevel >= 3 && Math.random() < 0.5) {
                await this.eventFleshWall(); // 肉壁
                return;
            }
        }
        
        // 2. 汎用フレーバーイベント (25%)：何も起きない代わりにセリフが発生
        // ※以前の「何もなさそうだ……」というログだけの処理を、セリフ付きイベントに差し替え
        if (eventRoll < 0.40) { // 0.15 ～ 0.40 の範囲
            this.processFlavorOnlyEvent(); 
            return;
        }

        // 3. 残りの確率 (60%) で敵と遭遇
        this.encounterEnemy();
    }

    // 新規追加: フレーバーのみのイベント（何も起きないが妖精が喋る）
    processFlavorOnlyEvent() {
        // 現在の状態に合わせたセリフ候補を取得
        const candidates = this.getDungeonFlavorCandidates();
        
        if (candidates && candidates.length > 0) {
            const event = candidates[Math.floor(Math.random() * candidates.length)];
            
            // ログにナレーションを表示
            this.log(event.text);
            // 吹き出しで妖精のセリフを表示
            this.showFairyMessage(event.dialogue);
        } else {
            this.log("静かな通路が続いている……。");
        }

        // 探索ボタンを再描画して進行可能にする
        this.renderDungeonButtons();
    }

    encounterEnemy(isBoss = false) {
        // ▼ 追加: 戦利品エリアを隠し、敵グラフィックを復帰させる
        const lootArea = document.getElementById('battle-loot-area');
        if (lootArea) lootArea.style.display = 'none';
        
        if (this.ui.enemyGraphic) {
            this.ui.enemyGraphic.style.display = 'flex'; // または block (CSSに合わせて)
            this.ui.enemyGraphic.textContent = ""; // 以前のテキスト消去
        }
        const enemyIntent = document.getElementById('enemy-intent');
        if (enemyIntent) enemyIntent.style.display = 'flex';
        // ▲ 追加ここまで

        this.player.runStats.maxFloor = this.depth; // [Stats] 到達階層更新
        
        // ローグライクモードならハイスコア更新
        if (this.mode === 'rogue' && this.depth > this.rogueHighScore) {
            this.rogueHighScore = this.depth;
        }
        
        // UIリセット（戦闘モードへ）
        this.ui.systemCommands.style.display = 'none';
        this.ui.battleCommands.style.display = 'flex';
        this.menuUi.overlay.style.display = 'none'; // メニューを閉じる

        // ★★★ 修正: ここでデッキを再初期化する ★★★
        this.deck.initializeDeck(this.masterDeck);

        // 敵生成（階層に応じて強化）
        const scale = 1 + (this.depth * 0.1); // 1階層ごとに10%強化
        const name = isBoss ? `フロアボス (Lv.${this.depth})` : `モンスター (Lv.${this.depth})`;
        
        this.enemy = new Unit(
            name,
            Math.floor(50 * scale),  // HP
            Math.floor(8 * scale),   // ATK
            Math.floor(3 * scale),   // DEF
            5,
            8 + this.depth,          // SPD
            isBoss
        );

        // 敵のルーチンと個性を適用
        this.applyEnemyRoutine(this.enemy, this.depth);

        this.log(`${this.enemy.name} が現れた！`);
        
        // 開幕効果 (アクセサリ)
        if (this.equipment.accessory && this.equipment.accessory.passive) {
            const p = this.equipment.accessory.passive;

            // 1. 達人の鞘 (開幕チャージ)
            if (p.type === 'start_charge') {
                this.player.weaponCharge = true;
                this.log("達人の鞘により、必殺技の準備が完了している！");
            }

            // 2. 守護者の紋章 (盾装備時、3ターンDEF+50%)
            if (p.type === 'weapon_syn_shield' && this.equipment.weapon && this.equipment.weapon.name.includes('大盾')) {
                this.player.addBuff({
                    buffStats: { def: Math.floor(this.player.def * 0.5) },
                    duration: 3,
                    name: '守護者の加護'
                });
                this.log("守護者の紋章が輝き、防御力が大幅に向上した！");
                this.recalcStats();
            }
        }

        // 戦闘開始時効果 (魔法陣)
        if (this.equipment.magic_circle) {
            const mc = this.equipment.magic_circle.passive;
            // 状態異常付与
            if (mc.type === 'battle_start_status') {
                // 孤高の魔法陣なら無効化チェックが必要だが、自身がかけるものなので適用してよいか、
                // あるいは applyStatus 側で弾く
                this.applyStatus(mc.status, 99); 
            }
            // 縮小操作
            if (mc.type === 'battle_start_shrink') {
                this.player.shrinkLevel = Math.max(0, Math.min(3, this.player.shrinkLevel + mc.value));
            }
            // 防壁
            if (mc.type === 'start_barrier_atk') {
                this.player.barrier = (this.player.barrier||0) + Math.floor(this.player.atk * mc.value);
                this.log(`${mc.name}で防壁展開！`);
            }
            // 回復
            if (mc.type === 'start_heal') {
                this.player.heal(Math.floor(this.player.maxHp * mc.value));
            }
        }
        // ▼ 追加: 1ターン目開始直前の完全リフレッシュ
        // 前の戦闘のゴミを確実に消し、開幕効果(recalcStats内で処理されるもの)を適用する
        this.player.battleStatsMod = { atk: 0, def: 0, int: 0, spd: 0 }; // 一時補正リセット
        this.recalcStats();   // 現在の状態(装備・変性)で再計算
        this.updateStatsUI(); // UIに即反映
        
        // 立ち絵も念のため更新
        this.updateCharacterSprite();

        // 戦闘開始
        this.turn = 1;

        // アクセサリーによる戦闘開始時バフ（バリアなど）
        if (this.equipment.accessory && this.equipment.accessory.passive) {
            const p = this.equipment.accessory.passive;
            if (p.type === 'battle_start_buff' && p.buffId === 'barrier') {
                this.player.barrier = 1; // 1回無効
                this.log(`${this.equipment.accessory.name} の効果でバリアを展開！`);
            }
        }

        this.planEnemyTurn(); // 初手敵の行動決定
        this.startPlayerTurn();
        this.saveGame(); // 階層移動セーブ
    }

    // --- 新規追加: 状態依存イベント ---

    // イベント: 淫靡な魔力霧 (脱衣ボーナス)
    async eventMagicMist() {
        this.log("前方に、妖しく光るピンク色の霧が漂っている……");
        await wait(800);

        // 判定: 脱衣状態かどうか
        // (解放の証を持っている場合も脱衣判定とみなす)
        if (this.player.hasStatus('undressing') || this.player.isLiberated) {
            this.log("遮る衣服がない肌が、霧の魔力を貪欲に吸収していく！");
            this.ui.playerImg.classList.add('anim-speak'); // 喜びのアニメーション
            await wait(1000);

            // ボーナス: 最大HPアップ + 回復
            const hpBonus = 10;
            this.playerBaseStats.maxHp += hpBonus; // 基礎ステータスを強化
            this.player.hp = this.player.maxHp;    // 全回復
            
            this.recalcStats();
            this.updateStatsUI();
            this.showToast(`魔力吸収！ 最大HP+${hpBonus} & 全回復！`, "success");
            this.showFairyMessage("わぁ……！ すごい魔力です。体が熱くて、力が溢れてきます……！");
        } else {
            this.log("衣服を溶かす霧のようだ。危険を感じて引き返した。");
            this.showFairyMessage("きゃっ、服が溶けちゃいそうです！ ここは通りたくないですね……。");
        }

        await wait(1000);
        this.renderDungeonButtons();
    }

    // イベント: 肉塊のバリケード (膨張ボーナス)
    async eventFleshWall() {
        this.log("ブヨブヨとした肉塊が通路を塞いでいる……");
        await wait(800);

        // 判定: 膨張レベル3以上 (Lv3:ボール状, Lv4:限界)
        if (this.player.expansionLevel >= 3) {
            this.log("その巨体と重量で、肉の壁を押し潰して進んだ！");
            // 画面を揺らす演出（既存のshakeクラスなどを利用）
            document.body.classList.add('shake'); 
            await wait(500);
            document.body.classList.remove('shake');

            this.log("壁の中からアイテムを発見した！");
            
            // 報酬: ランダムな装備品生成
            const loot = this.generateLoot(); 
            if (loot) {
                // 戦利品画面を表示（以前作った汎用メソッドを使用）
                // ※アイテムはインベントリに追加
                if (loot.cost !== undefined) {
                    this.cardPool.push(loot); // カードならプールへ
                } else {
                    this.tempInventory.push(loot); // 装備なら一時インベントリへ
                }
                this.showInlineResult([loot], "BREAK THROUGH!", 'normal');
            }
            
            this.showFairyMessage("私のわがままボディなら、こんな壁なんてイチコロですよ～！ ……ふふん♪");
            
            // リザルト画面を出した場合は、ボタン表示は「閉じる」操作に含まれるためここでは呼ばない
            // (showInlineResult後にボタンを出す仕様にしている場合は以下を実行)
            if (typeof this.renderDungeonButtons === 'function') {
                this.renderDungeonButtons();
            }
        } else {
            this.log("今の体格では押し通れそうにない……。");
            this.showFairyMessage("むぅ……通れませんね。もっと体が大きければ、押し潰して通れるんですけど。");
            await wait(800);
            this.renderDungeonButtons();
        }
    }

    // 敵のルーチン適用ロジック
    applyEnemyRoutine(enemy, depth) {
        // 1. ランク決定
        let rank = 'weak';
        const rand = Math.random();
        
        if (depth <= 10) {
            rank = 'weak';
        } else if (depth <= 20) {
            rank = (rand < 0.5) ? 'weak' : 'normal';
        } else if (depth <= 40) {
            rank = 'normal';
        } else if (depth <= 60) {
            rank = (rand < 0.5) ? 'normal' : 'strong';
        } else {
            rank = 'strong';
        }

        // 2. ルーチン抽選
        const candidates = Object.values(ENEMY_ROUTINES).filter(r => r.type === rank);
        const routine = candidates[Math.floor(Math.random() * candidates.length)];
        
        // 3. 敵オブジェクトに情報をセット
        enemy.routineId = routine.id;
        
        // 4. ステータス補正
        if (routine.statMod) {
            if (routine.statMod.hp) enemy.maxHp = Math.floor(enemy.maxHp * routine.statMod.hp);
            if (routine.statMod.atk) enemy.atk = Math.floor(enemy.atk * routine.statMod.atk);
            enemy.hp = enemy.maxHp; // HP全快
        }

        // 5. 固有状態異常の決定
        const statuses = ['poison', 'confusion', 'fear', 'distraction'];
        enemy.uniqueStatus = statuses[Math.floor(Math.random() * statuses.length)];
    }

    // イベント処理（宝箱）
    processEvent() {
        // 50%の確率で宝箱イベント、そうでなければ他のランダムイベント
        if (Math.random() < 0.5) {
            this.processTreasureEvent();
            return;
        }

        // --- フレーバーイベントを含むランダムイベントの抽選 ---
        const candidatePool = [
            ...DUNGEON_EVENT_DATA.event_trap,
            //古いイベント
            //...DUNGEON_EVENT_DATA.flavor_normal
        ];

        if (this.player.shrinkLevel >= 1) {
            candidatePool.push(...DUNGEON_EVENT_DATA.event_small_hole);
            //古いイベント
            //candidatePool.push(...DUNGEON_EVENT_DATA.flavor_shrink);
        }
        if (this.player.shrinkLevel >= 2) {
            candidatePool.push(...DUNGEON_EVENT_DATA.event_shrink_penalty);
        }
        if (this.player.hasStatus('undressing') || (this.equipment.accessory && this.equipment.accessory.isLiberationProof)) {
            candidatePool.push(...DUNGEON_EVENT_DATA.event_stripped_penalty);
            //古いイベント
            //candidatePool.push(...DUNGEON_EVENT_DATA.flavor_stripped);
        }

        if (candidatePool.length === 0) {
            this.processTreasureEvent(); // フォールバック
            return;
        }

        const eventData = candidatePool[Math.floor(Math.random() * candidatePool.length)];
        
        this.log(`=== 地下 ${this.depth} 階 ===`);
        this.showToast(eventData.text);
        this.showFairyMessage(eventData.dialogue);

        // 効果適用
        let resultMsg = "";
        if (eventData.id) { // フレーバーイベントにはIDがない
            resultMsg = this.applyEventEffect(eventData.id);
            if (resultMsg) this.log(resultMsg);
        } else {
            this.log("しかし、特に何も起こらなかった。");
        }

        this.updateStatsUI();

        // イベント後は次の階層へ進むか、戦闘へ移行するかなどの処理が必要だが、
        // ここではシンプルに「何も起きず次へ進む」ボタンを表示するか、
        // 自動的に次の処理（敵出現など）にはせず、システムメニューを表示して選択させる
        
        // 戦闘コマンドを隠してシステムコマンドを表示
        this.ui.battleCommands.style.display = 'none';
        this.ui.systemCommands.style.display = 'flex';
        this.renderDungeonButtons();
    }

    applyEventEffect(eventId) {
        let resultMsg = "";
        const player = this.player;

        switch (eventId) {
            // --- A. 罠 ---
            case 'trap_thorns':
            case 'trap_rock':
            case 'trap_trip':
                // 共通: 最大HPの5%ダメージ
                const dmg = Math.max(1, Math.floor(player.maxHp * 0.05));
                player.takeDamage(dmg, true);
                resultMsg = `痛い！ ${dmg} のダメージを受けた。`;
                break;

            // --- C. 小さな抜け道 (報酬) ---
            case 'hole_crack':
            case 'hole_mouse':
                player.heal(999); // 全回復
                resultMsg = "隠れ家で一休みして、HPが全回復した！";
                break;

            // --- D. 脱衣ペナルティ ---
            case 'stripped_cold':
                // 風邪(SPDダウン) + ダメージ
                const coldDmg = Math.max(1, Math.floor(player.maxHp * 0.1));
                player.takeDamage(coldDmg, true);
                player.battleStatsMod.spd = (player.battleStatsMod.spd || 0) - 5;
                resultMsg = `寒さで体が強張る…… ${coldDmg}ダメ & SPD低下。`;
                break;
                
            case 'stripped_slime':
                // 精神的ダメージ + ダメージ
                const slimeDmg = Math.max(1, Math.floor(player.maxHp * 0.15)); 
                player.takeDamage(slimeDmg, true);
                resultMsg = `ヌルヌルの液体が肌に張り付く！ ${slimeDmg} のダメージを受けた。`;
                break;
                
            case 'stripped_gaze':
                 // 精神ダメージ + INT低下
                const gazeDmg = Math.max(1, Math.floor(player.maxHp * 0.05));
                player.takeDamage(gazeDmg, true);
                player.battleStatsMod.int = (player.battleStatsMod.int || 0) - 5;
                resultMsg = `恥ずかしさで集中できない！ ${gazeDmg}ダメ & INT低下。`;
                break;

            // --- E. 縮小ペナルティ ---
            case 'shrink_wind':
                // 階層が1つ戻る
                if (this.depth > 1) this.depth--;
                const windDmg = Math.max(1, Math.floor(player.maxHp * 0.1));
                player.takeDamage(windDmg, true);
                resultMsg = `強風で吹き飛ばされた！ 1階層戻されてしまった…… (${windDmg}ダメ)`;
                break;
                
            case 'shrink_water':
            case 'shrink_step':
                // 圧死級の大ダメージ
                const crushDmg = Math.floor(player.hp * 0.5);
                player.takeDamage(crushDmg, true);
                resultMsg = `小さな体には致命的だ！ ${crushDmg} の大ダメージ！`;
                break;
        }
        return resultMsg;
    }

    processTreasureEvent() {
        this.log(`=== 地下 ${this.depth} 階 ===`);
        
        // [修正] 合成専用カードを除外して抽選
        const candidates = CARD_DATABASE.filter(c => !c.isSynthesisOnly);
        const loot = candidates[Math.floor(Math.random() * candidates.length)];
        
        // [修正] ローグライクモードなら即時入手
        if (this.mode === 'rogue') {
            if (loot.cost !== undefined) {
                this.cardPool.push(loot);
            } else {
                this.permInventory.push(loot);
            }
        } else {
            this.tempInventory.push(loot);
        }

        this.log(`宝箱から ${loot.name} を見つけた！`);

        
        // 戦闘コマンドを隠してシステムコマンドを表示
        this.ui.battleCommands.style.display = 'none';
        this.ui.systemCommands.style.display = 'flex';
        
        // 戦闘画面のUIを使ってリザルト表示
        this.showInlineResult([loot], "TREASURE");
        
        // その後、探索ボタンを表示
        this.renderDungeonButtons();
    }

    // 帰還処理（生還）
    returnHome() {
        this.returnState = 'victory';

        // ローグライクモード終了処理
        if (this.mode === 'rogue') {
            this.endRogueMode();
        }

        // [Event] 露出覚醒イベント判定 (優先度高)
        if (this.checkExposureEvent()) {
            return; // イベント処理へ移行（showHomeはイベント後に呼ばれる）
        }

        // [Event] 伝説級装備イベント判定
        if (this.checkEndgameEvents()) {
            return;
        } 

        // [Result] 特殊セリフの判定
        this.specialResultKey = this.checkResultDialogue(this.player, this.tempInventory);
        
        this.lastLootCount = this.tempInventory.length;
        this.showHome();
        this.player.minShrinkLevel = 0;
        this.player.dungeonBonus = { atk: 0, int: 0, dmgRate: 1.0 };
    }

    // 露出覚醒イベント判定・実行
    checkExposureEvent() {
        // 条件: 脱衣使用回数 >= 10 かつ 未イベント
        const count = this.player.runStats.selfStripCount || 0;
        if (count >= 10 && !this.player.flags.sawExposureEvent) {
            this.playExposureEvent();
            return true;
        }
        return false;
    }

    // イベント再生
    playExposureEvent() {
        this.menuUi.overlay.style.display = 'flex';
        this.menuUi.title.textContent = "覚醒";
        this.menuUi.title.style.color = "#e74c3c"; // 赤系
        this.menuUi.loot.style.display = 'none';
        this.ui.battleCommands.style.display = 'none';
        this.ui.systemCommands.style.display = 'none';

        const lines = FAIRY_DIALOGUE_DATA.event_awakening_exposure;
        let currentLine = 0;

        const showNextLine = () => {
            if (currentLine < lines.length) {
                this.menuUi.content.innerHTML = `<div style="text-align:left; padding:10px; line-height:1.6;">${lines[currentLine]}</div>`;
                this.renderMenuButtons([{ text: "▼ 次へ", onClick: () => {
                    currentLine++;
                    showNextLine();
                }}]);
            } else {
                // イベント終了
                this.player.flags.sawExposureEvent = true;
                // アイテム付与
                this.permInventory.push(ACCESSORY_PROOF_OF_LIBERATION);
                this.showToast("特別な装飾品『解放の証』を手に入れた！", "success");
                
                // 通常のホーム画面へ
                this.showHome();
            }
        };
        showNextLine();
    }

    // 伝説級イベント判定
    checkEndgameEvents() {
        const player = this.player;
        const depth = this.player.runStats.maxFloor; // 今回の到達階層
        const deckSize = this.masterDeck.length;

        // 6. 無双の妖精譚 (Depth 999 + 大妖精イベント既読)
        if (depth >= 999 && player.flags.seen_grand_proof && !player.flags.seen_peerless_tale) {
            this.playLegendEvent('event_get_peerless_tale', 'wpn_peerless_tale', 'seen_peerless_tale');
            return true;
        }

        // 5. 大妖精の証 (Depth 500 + 勇者イベント既読)
        if (depth >= 500 && player.flags.seen_hero_emblem && !player.flags.seen_grand_proof) {
            this.playLegendEvent('event_get_grand_proof', 'acc_grand_fairy_proof', 'seen_grand_proof');
            return true;
        }

        // 4. 勇者の紋章 (Depth 300 + 魔王イベント既読)
        if (depth >= 300 && player.flags.seen_demon_axe && !player.flags.seen_hero_emblem) {
            this.playLegendEvent('event_get_hero_emblem', 'arm_hero_emblem', 'seen_hero_emblem');
            return true;
        }

        // 3. 魔王の大斧 (Depth 150)
        if (depth >= 150 && !player.flags.seen_demon_axe) {
            this.playLegendEvent('event_get_demon_axe', 'wpn_demon_axe', 'seen_demon_axe');
            return true;
        }

        // 2. 聖女の御旗 (Depth 100 + Deck >= 24)
        if (depth >= 100 && deckSize >= 24 && !player.flags.seen_saint_flag) {
            this.playLegendEvent('event_get_saint_flag', 'acc_saint_flag', 'seen_saint_flag');
            return true;
        }

        // 1. 妖精の加護 (Depth 100 + 小人の留め針装備)
        const hasPin = (this.equipment.accessory && this.equipment.accessory.id.startsWith('pin_small'));
        if (depth >= 100 && hasPin && !player.flags.seen_fairy_blessing) {
            this.playLegendEvent('event_get_blessing', 'acc_fairy_blessing', 'seen_fairy_blessing');
            return true;
        }

        return false;
    }

    // 伝説級イベント再生
    playLegendEvent(dialogueKey, itemId, flagName) {
        this.menuUi.overlay.style.display = 'flex';
        this.menuUi.title.textContent = "伝説の到達";
        this.menuUi.title.style.color = "#f1c40f"; // Gold
        this.menuUi.loot.style.display = 'none';
        this.ui.battleCommands.style.display = 'none';
        this.ui.systemCommands.style.display = 'none';

        const lines = FAIRY_DIALOGUE_DATA[dialogueKey];
        let currentLine = 0;

        const showNextLine = () => {
            if (currentLine < lines.length) {
                this.menuUi.content.innerHTML = `<div style="text-align:left; padding:10px; line-height:1.6;">${lines[currentLine]}</div>`;
                this.renderMenuButtons([{ text: "▼ 次へ", onClick: () => {
                    currentLine++;
                    showNextLine();
                }}]);
            } else {
                // イベント終了
                this.player.flags[flagName] = true;
                const item = ENDGAME_ITEMS.find(i => i.id === itemId);
                if (item) this.permInventory.push(item);
                this.showToast(`【伝説】${item ? item.name : '秘宝'} を手に入れた！`, "success");
                this.showHome();
            }
        };
        showNextLine();
    }

    // 敗北処理（ロスト）
    processDefeat() {
        this.cleanupBattle(); // デッキ等のリセット
        this.tempInventory = []; // 全ロスト

        // ローグライクモード終了処理 (敗北時も復元)
        if (this.mode === 'rogue') {
            this.endRogueMode();
        }
        this.saveGame(); // 敗北時セーブ
        
        this.ui.battleCommands.style.display = 'none'; // 戦闘ボタンを隠す
        this.menuUi.overlay.style.display = 'flex';
        this.menuUi.title.textContent = "GAME OVER";
        this.menuUi.title.style.color = "#e74c3c";
        this.menuUi.content.textContent = "力尽きました...\n今回獲得したアイテムは全て失われました。";
        this.menuUi.loot.style.display = 'none';
        
        this.renderMenuButtons([
            { text: "拠点に戻る", onClick: () => {
                this.returnState = 'defeat';
                this.showHome();
            }}
        ]);
    }

    // 変更: ログをキューに追加し、処理を開始するだけのメソッドにする
    log(text) {
        this.logQueue.push(text);
        this.processLogQueue();
    }

    // 新規追加: キューにあるログを順番に表示する非同期メソッド
    async processLogQueue() {
        // すでに処理中なら二重に実行しない
        if (this.isProcessingLog) return;
        
        this.isProcessingLog = true;

        const logContainer = this.ui.log;

        while (this.logQueue.length > 0) {
            const text = this.logQueue.shift(); // 先頭から取り出す

            if (logContainer) {
                const entry = document.createElement('div');
                entry.className = 'log-entry';
                entry.innerHTML = text; // innerHTMLにして色付けタグ等を有効化
                
                logContainer.appendChild(entry);
                
                // 最新の行へスクロール
                logContainer.scrollTop = logContainer.scrollHeight;
            }

            await new Promise(resolve => setTimeout(resolve, 50));
        }

        this.isProcessingLog = false;
    }

// UI更新 (ステータス表示)
    updateStatsUI() {
        const hpEl = this.ui.hpVal;
        const maxHpEl = this.ui.maxHpVal;

        if (hpEl) hpEl.textContent = this.player.hp;
        if (maxHpEl) {
            let maxHpText = `${this.player.maxHp}`;
            if (this.player.barrier > 0) {
                maxHpText += ` <span style="color:#64b5f6; font-weight:bold; font-size:0.9em;">(Shield: ${this.player.barrier})</span>`;
            }
            maxHpEl.innerHTML = maxHpText;
        }

        const pct = (this.player.hp / this.player.maxHp) * 100;
        this.ui.hpBar.style.width = `${pct}%`;
        if (pct < 30) this.ui.hpBar.style.backgroundColor = '#e74c3c';
        else this.ui.hpBar.style.backgroundColor = '#2ecc71';

        // 立ち絵の表情差分更新
        this.updatePlayerExpression(pct);

        // ヘッダーのステータス数値更新
        if (this.ui.statAtk) this.ui.statAtk.textContent = this.player.atk;
        if (this.ui.statDef) this.ui.statDef.textContent = this.player.def;
        if (this.ui.statInt) this.ui.statInt.textContent = this.player.int;
        if (this.ui.statSpd) this.ui.statSpd.textContent = this.player.spd;
        
        // フロア表示の更新
        const floorEl = document.getElementById('floor-display');
        if (floorEl) {
            if (this.isHome) floorEl.textContent = "Home";
            else {
                let text = `Floor: ${this.depth}`;
                if (this.mode === 'rogue') text += ` (Best: ${this.rogueHighScore})`;
                floorEl.textContent = text;
            }
        }

        // ▼ 変更: 状態異常バッジの更新 (ロジックは前回と同じだが、場所が変わったため再確認)
        const statusEl = document.getElementById('status-icon');
        if (statusEl) {
            let badgesHtml = '';

            // 1. 通常の状態異常
            if (this.player.currentStatus) {
                const s = this.player.currentStatus;
                badgesHtml += `<span class="status-badge status-${s.id}">${s.name}</span>`;
            }

            // 2. 縮小化
            if (this.player.shrinkLevel > 0) {
                badgesHtml += `<span class="status-badge status-shrink">縮小 Lv${this.player.shrinkLevel}</span>`;
            }

            // 3. 膨張
            if (this.player.expansionLevel > 0) {
                badgesHtml += `<span class="status-badge status-undressing">膨張 Lv${this.player.expansionLevel}</span>`;
            }

            // 4. 解放 (Liberation)
            if (this.player.isLiberated) {
                badgesHtml += `<span class="status-badge status-undressing">解放</span>`;
            }

            statusEl.innerHTML = badgesHtml;
            // 右寄せレイアウトに対応したスタイルはHTML側で指定済み
        }
    }
// HP残量に応じて立ち絵の見た目を変える
    updatePlayerExpression(hpPct) {
        if (!this.ui.playerImg) return; // 要素が存在しない場合は中断

        // ▼▼▼ 修正: スケール計算を先に実行するように移動 ▼▼▼
        // 3. 縮小化によるスケール変更
        let scale = 1.0;
        let yOffset = SHRINK_VISUALS.LV0.yOffset;

        if (this.player.shrinkLevel === 1) {
            scale = SHRINK_VISUALS.LV1.scale;
            yOffset = SHRINK_VISUALS.LV1.yOffset;
        }
        if (this.player.shrinkLevel === 2) {
            scale = SHRINK_VISUALS.LV2.scale;
            yOffset = SHRINK_VISUALS.LV2.yOffset;
        }
        if (this.player.shrinkLevel === 3) {
            scale = SHRINK_VISUALS.LV3.scale;
            yOffset = SHRINK_VISUALS.LV3.yOffset;
        }

        // 変形基準点を足元（底辺中央）に設定
        this.ui.playerImg.style.transformOrigin = 'bottom center';

        // CSS変数をセットしてアニメーションに反映させる
        this.ui.playerImg.style.setProperty('--fairy-scale', scale);
        this.ui.playerImg.style.setProperty('--fairy-y', `${yOffset}px`);

        // 重要: CSSのセンタリング(translateX(-50%))を維持しつつ scale を適用
        // Y座標補正を追加
        this.ui.playerImg.style.transform = `translateX(-50%) translateY(${yOffset}px) scale(${scale})`;

        // CSSフィルタ（ドロップシャドウのみ適用）
        this.ui.playerImg.style.filter = 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.8))';
        // ▲▲▲ 移動ここまで ▲▲▲


        let imageName = "";
        const isLiberated= this.equipment.accessory && 
                            (this.equipment.accessory.id === 'acc_liberation_proof' || 
                             this.equipment.accessory.id === 'acc_lust_liberation');
        const safePct = (typeof hpPct === 'number') ? hpPct : 100;

        // 0. 膨張状態 (最優先)
        if (this.player.expansionLevel > 0) {
            // updateCharacterSprite で設定された画像を維持するため、ここでは何もしないか、
            // あるいは updateCharacterSprite を呼び出す
            this.updateCharacterSprite();
            return; // 膨張時は表情差分なし（または専用画像に含まれる）としてリターン
        }
        
        // 1. 解放の証（覚醒）モード
        if (isLiberated) {
            if (safePct < 25) {
                imageName = "fairy_liberation_low.png";
            } else if (safePct < 50) {
                imageName = "fairy_liberation_mid.png";
            } else {
                imageName = "fairy_liberation_high.png";
            }
        }
        // 2. その他の状態異常
        else if (this.player.currentStatus && this.player.currentStatus.img) {
            imageName = this.player.currentStatus.img;
        }
        // 3. 通常モード
        else {
            if (safePct < 20) imageName = FACE_IMAGES.DYING;
            else if (safePct < 50) imageName = FACE_IMAGES.PINCH;
            else imageName = FACE_IMAGES.NORMAL;
        }

        // フォールバック: 画像名が取得できない場合はデフォルトに戻す
        if (!imageName) imageName = FACE_IMAGES.NORMAL;

        // 画像更新
        if (!this.ui.playerImg.src.includes(imageName)) {
            this.ui.playerImg.src = imageName;
        }
        
        // 表示強制 (万が一 hidden になっていた場合)
        this.ui.playerImg.style.display = 'block';
    }
    
    updateDeckUI() {
    }

    // 敵の行動をあらかじめ決定する
    planEnemyTurn() {
        // ルーチンに基づいて行動を決定
        const rawAction = this.decideEnemyAction(this.enemy, this.turn);
        
        // UI用オブジェクトに変換
        if (typeof rawAction === 'string') {
            switch (rawAction) {
                case 'attack':
                    this.enemyNextAction = { type: 'attack', label: '攻撃', icon: '⚔️', damageScale: 1.0 };
                    break;
                case 'heavy_attack':
                    this.enemyNextAction = { type: 'strong_attack', label: '強撃', icon: '🔥', damageScale: 1.5 };
                    break;
                case 'wait':
                    this.enemyNextAction = { type: 'wait', label: '様子見', icon: '👀', damageScale: 0 };
                    break;
                case 'defend':
                    this.enemyNextAction = { type: 'defend', label: '防御', icon: '🛡️', damageScale: 0 };
                    break;
                case 'skill_cure_shrink':
                    this.enemyNextAction = { type: 'skill_cure_shrink', label: '慈悲', icon: '✨', damageScale: 0 };
                    break;
                default:
                    this.enemyNextAction = { type: 'wait', label: '...', icon: '?', damageScale: 0 };
            }
        } else {
            // オブジェクト型のアクション (スキル等)
            if (rawAction.type === 'skill_status') {
                const sName = STATUS_TYPES[rawAction.status.toUpperCase()]?.name || '呪い';
                this.enemyNextAction = { type: 'skill_status', label: sName, icon: '💀', status: rawAction.status };
            } else if (rawAction.type === 'skill_shrink') {
                this.enemyNextAction = { type: 'skill_shrink', label: '縮小魔法', icon: '✨', chance: rawAction.chance };
            } else {
                this.enemyNextAction = { type: 'wait', label: '...', icon: '?', damageScale: 0 };
            }
        }

        // 画面に表示
        if (this.player.currentStatus && this.player.currentStatus.id === 'confusion') {
            this.ui.enemyIntentIcon.textContent = '❓';
            this.ui.enemyIntentText.textContent = '？？？';
        } else {
            this.ui.enemyIntentIcon.textContent = this.enemyNextAction.icon;
            this.ui.enemyIntentText.textContent = `${this.enemyNextAction.label} の予感`;
        }
    }

    // 敵の行動決定ロジック (AI)
    decideEnemyAction(enemy, turnCount) {
        const id = enemy.routineId || 'w_basic';
        
        switch (id) {
            // --- Weak ---
            case 'w_basic':
                return Math.random() < 0.5 ? 'attack' : 'wait';
            case 'w_aggressive':
                return 'attack';
            case 'w_cycle':
                return (turnCount % 2 === 1) ? 'wait' : 'heavy_attack';
            case 'w_guard':
                return Math.random() < 0.5 ? 'attack' : 'defend';

            // --- Normal ---
            case 'n_random':
                const r = Math.random();
                if (r < 0.33) return 'attack';
                if (r < 0.66) return 'wait';
                return 'heavy_attack';
            case 'n_tough':
                return 'attack';
            case 'n_status':
                if (turnCount >= 2 && Math.random() < 0.3) return { type: 'skill_status', status: enemy.uniqueStatus };
                return Math.random() < 0.5 ? 'attack' : 'wait';
            case 'n_shrink_low':
                if (turnCount === 4) return { type: 'skill_shrink', chance: 0.3 };
                return Math.random() < 0.5 ? 'attack' : 'wait';

            // --- Strong ---
            case 's_heavy':
                return Math.random() < 0.7 ? 'heavy_attack' : 'wait';
            case 's_first_status':
                if (turnCount === 1) return { type: 'skill_status', status: enemy.uniqueStatus };
                return Math.random() < 0.5 ? 'attack' : 'heavy_attack';
            case 's_elite':
                return 'attack';
            case 's_shrink_mid':
                if (turnCount === 3) return { type: 'skill_shrink', chance: 0.6 };
                return Math.random() < 0.5 ? 'attack' : 'defend';
            case 's_guard_heavy':
                return (turnCount % 2 === 1) ? 'defend' : 'heavy_attack';
            
            // --- Fixed Routine (Combo) ---
            case 's_fixed_combo':
                const pattern = [
                    'attack',
                    { type: 'skill_shrink', chance: 9.9 }, // 必中
                    'heavy_attack',
                    'skill_cure_shrink',
                    'attack'
                ];
                // turnCountは1から始まるので -1
                return pattern[(turnCount - 1) % pattern.length];
                
            default:
                return 'attack';
        }
    }

    // --- プレイヤーのターン開始処理 ---
    startPlayerTurn() {
        // ▼ 追加: 淫魔のチョーカー効果
        const acc = this.equipment.accessory;
        if (acc && acc.id === 'acc_click_start') {
            if (this.player.hasStatus('undressing') || this.player.isLiberated || this.player.expansionLevel > 0) {
                if (this.player.expansionLevel < 4) {
                    this.player.expansionLevel++;
                    this.log("淫魔のチョーカーが反応し、体が膨らんだ！");
                }
            } else {
                this.processForceStrip();
                this.log("淫魔のチョーカーにより、服が弾け飛んだ！");
            }
            this.updateCharacterSprite();
            this.recalcStats();
            this.updateStatsUI();
        }

        this.isPlayerTurn = true;
        this.player.isDefending = false; // 防御解除
        this.saveGame(); // ターン開始時セーブ
        
        // 手札補充
        const handLimit = 4 + (this.handLimitBonus || 0);
        // 最低保証
        if (handLimit < 1) handLimit = 1;
        this.deck.fillHand(handLimit);

        this.updateDeckUI();
        this.renderHandCards();

        this.log(`--- ターン ${this.turn} ---`);
        this.log("あなたの番です。行動を選択してください。");
        this.setControlsEnabled(true);

        // 状態異常・アクセサリーによるコマンド制限
        const status = this.player.currentStatus ? this.player.currentStatus.id : null;
        const accessoryPassive = (this.equipment.accessory && this.equipment.accessory.passive) ? this.equipment.accessory.passive : null;

        // 攻撃封印 (恐怖 or アクセサリー)
        if (status === 'fear' || (accessoryPassive && accessoryPassive.restrict === 'attack')) {
            document.querySelector('.btn-attack').disabled = true;
            document.querySelector('.btn-attack').style.opacity = 0.5;
        }

        // 魔法封印 (放心 or アクセサリー)
        if (status === 'distraction' || (accessoryPassive && accessoryPassive.restrict === 'magic')) {
            document.querySelector('.btn-magic').disabled = true;
            document.querySelector('.btn-magic').style.opacity = 0.5;
        }

        // 逃走封印 (石化)
        if (status === 'petrification') {
            document.querySelector('.btn-run').disabled = true;
            document.querySelector('.btn-run').style.opacity = 0.5;
        }

        // (旧) アクセサリーによるコマンド制限ロジックを統合したため削除または維持
        // ここでは上記で統合済み
        if (this.equipment.accessory && this.equipment.accessory.passive) {
            // 既存ロジックは上の統合ブロックでカバーされています
        }

        // カード使用条件チェック (縮小専用カードなど)
        const handCards = document.querySelectorAll('.card-item');
        this.deck.hand.forEach((card, index) => {
            let usable = true;
            if (card.type === 'special_shrink') {
                if (this.player.shrinkLevel === 0) usable = false;
            }
            
            // UI反映
            if (handCards[index]) {
                if (!usable) {
                    handCards[index].style.opacity = '0.5';
                    handCards[index].style.pointerEvents = 'none';
                }
            }
        });
    }

    // カードメニューの表示切り替え
    toggleMagicMenu(show) {
        if (!this.isPlayerTurn) return;
        this.ui.cardOverlay.style.display = show ? 'flex' : 'none';
    }

    // 手札リストの描画
    renderHandCards() {
        // 1. スクロール位置を保存
        const currentScroll = this.ui.cardList ? this.ui.cardList.scrollTop : 0;

        this.ui.cardList.innerHTML = '';
        this.deck.hand.forEach((card, index) => {
            const el = document.createElement('div');
            el.className = 'card-item';
            el.innerHTML = `<span>${card.name}</span> <small>${card.desc}</small>`;
            el.onclick = () => this.playerUseCard(index);
            this.ui.cardList.appendChild(el);
        });

        // 2. スクロール位置を復元
        if (this.ui.cardList) {
            requestAnimationFrame(() => {
                this.ui.cardList.scrollTop = currentScroll;
            });
        }
    }

    // プレイヤーのアクション実行
    async playerAction(actionType) {
        if (!this.isPlayerTurn) return;

        // 行動スキップ判定
        if (this.player.skipTurn) {
            this.log("動けない！");
            
            // スタン解除
            this.player.skipTurn = false;
            
            // ターン終了処理へ
            await wait(1000);
            this.endPlayerTurn();
            return;
        }

        this.setControlsEnabled(false); // 連打防止
        this.ui.cardOverlay.style.display = 'none'; // カード画面が開いていたら閉じる

        let dmg = 0;
        let executed = true;

        switch (actionType) {
            case 'attack':
                // [Stats] 攻撃回数
                this.player.runStats.attackUse++;

                // 必殺技チャージ判定
                if (this.player.weaponCharge) {
                    this.player.weaponCharge = false; // 消費

                    // ▼ 追加: 剣シナジー (必殺技2倍)
                    let specMult = 1.0;
                    if (this.equipment.accessory && this.equipment.accessory.passive &&
                        this.equipment.accessory.passive.type === 'weapon_syn_spec' && 
                        this.equipment.weapon && this.equipment.weapon.name.includes('剣')) {
                        specMult = 2.0;
                        this.log("剣士の腕輪が輝き、必殺技が強化された！");
                    }
                    
                    // 武器種別判定
                    let wType = 'NONE';
                    if (this.equipment.weapon) {
                        const name = this.equipment.weapon.name;
                        if (name.includes('剣')) wType = 'SWORD';
                        else if (name.includes('斧')) wType = 'AXE';
                        else if (name.includes('刀')) wType = 'KATANA';
                        else if (name.includes('杖')) wType = 'WAND';
                        else if (name.includes('書')) wType = 'BOOK';
                        else if (name.includes('魔導砲')) wType = 'CANNON';
                        else if (name.includes('大盾')) wType = 'SHIELD';
                    }

                    const artFunc = WEAPON_ARTS_LOGIC[wType] || WEAPON_ARTS_LOGIC['NONE'];
                    const art = artFunc(this.player, this.enemy);
                    art.val *= specMult;
                    this.log(`必殺技！ ${art.msg}`);

                    if (art.type === 'damage') {
                        dmg = Math.floor(art.val);
                        // [拡張] バリア処理
                        const bRes = this.enemy.applyBarrier(dmg);
                        dmg = bRes.damage;
                        if (bRes.absorbed > 0) this.log(`(敵のバリアが ${bRes.absorbed} 軽減)`);
                        
                        dmg = this.enemy.takeDamage(dmg);
                        this.log(`敵に ${dmg} の大ダメージ！`);
                    } else if (art.type === 'multi_hit') {
                        for (let i = 0; i < art.count; i++) {
                            let d = Math.floor(art.val);
                            // [拡張] バリア処理 (多段ヒットそれぞれに適用)
                            const bRes = this.enemy.applyBarrier(d);
                            d = bRes.damage;
                            d = this.enemy.takeDamage(d);
                            this.log(`${i+1}撃目: ${d} ダメージ！`);
                            await wait(200);
                        }
                    } else if (art.type === 'magic_burst') {
                        dmg = Math.floor(art.val);
                        // 魔法はバリア貫通等の設定も可能だが、ここでは適用
                        const bRes = this.enemy.applyBarrier(dmg);
                        dmg = bRes.damage;
                        dmg = this.enemy.takeDamage(dmg);
                        this.log(`敵に ${dmg} の魔法ダメージ！`);
                        // 追加効果: デッキからランダム発動
                        await this.executeCardEffect({ type: 'special', id: 'chaos_gate' });
                    }
                    if (this.equipment.magic_circle && this.equipment.magic_circle.curseOnArts) {
    const artsCurse = Math.floor(dmg * this.equipment.magic_circle.curseOnArts);
    this.applyCurseToEnemy(artsCurse);
}

                    // [拡張] 被弾カウンター (Damage Counter)
                    if (this.enemy.counterStance && this.enemy.counterStance.type === 'damage') {
                        const counterDmg = this.player.takeDamage(this.enemy.counterStance.dmg);
                        this.log(`敵の反撃！ ${counterDmg} のダメージを受けた！`);
                    }
                    
                    // ドレインバフ判定
                    const drainBuff = this.player.buffs.find(b => b.buffId === 'drain_attack');
                    if (drainBuff) {
                        const healAmt = Math.floor(dmg * 0.5);
                        if (healAmt > 0) {
                            this.player.heal(healAmt);
                            this.log(`吸血！HPを ${healAmt} 回復した。`);
                        }
                    }
                    this.animateEnemyDamage();
                } else {
                    // ▼▼▼ 修正: 多段攻撃(トリプルアタック)の判定 ▼▼▼
                    let hitCount = 1;
                    let dmgRate = 1.0;
                    const multiHitBuffIndex = this.player.buffs.findIndex(b => b.type === 'multi_hit');
                    
                    if (multiHitBuffIndex !== -1) {
                        hitCount = this.player.buffs[multiHitBuffIndex].count || 3;
                        // バフを消費(削除)
                        this.player.buffs.splice(multiHitBuffIndex, 1);
                        this.log(`連撃！ ${hitCount}回攻撃！`);
                    }

                    if (this.equipment.accessory && this.equipment.accessory.passive &&
                        this.equipment.accessory.passive.type === 'weapon_syn_cannon' &&
                        this.equipment.weapon && this.equipment.weapon.name.includes('魔導砲')) {
                        
                        hitCount += 2;
                        dmgRate = 0.7; // -30%
                        this.log("連射モード！");
                    }

                    // 攻撃回数増加 (状態異常時) - 魔法陣
                    if (this.equipment.magic_circle && this.equipment.magic_circle.passive.type === 'status_attack_plus') {
                        if (this.player.currentStatus) {
                            // multi_hitバフを付与するか、直接 hitCount を増やす
                            // ここでは簡易的に hitCount を操作するロジックに追加
                            hitCount++;
                            this.log("逆境の力で攻撃回数増加！");
                        }
                    }

                    // 膨張: 攻撃回数増加 (千手観音)
                    if (this.equipment.magic_circle && this.equipment.magic_circle.passive && this.equipment.magic_circle.passive.type === 'expansion_multi_hit') {
                        hitCount += this.player.expansionLevel;
                    }
                    
                    // 攻撃回数分ループ
                    for (let i = 0; i < hitCount; i++) {
                        // 2回目以降は少しウェイトを入れる（演出用）
                        if (i > 0) await wait(200);

                        let dmg = Math.floor(this.player.atk * (randomInt(90, 110) / 100)); // 乱数幅あり
                        dmg = Math.floor(dmg * dmgRate);

                        // 魔法陣効果
                        if (this.equipment.magic_circle) {
                            const mc = this.equipment.magic_circle.passive;
                            
                            // 賭博
                            if (mc.type === 'attack_gamble') {
                                if (Math.random() < 0.5) {
                                    dmg = 0;
                                    this.log("賭けに負けた……ダメージ0！");
                                } else {
                                    dmg *= 2;
                                    this.log("賭けに勝った！ダメージ2倍！");
                                }
                            }
                            // 斧クリティカル
                            if (mc.type === 'weapon_synergy' && mc.effect === 'critical' && this.equipment.weapon && this.equipment.weapon.name.includes('斧')) {
                                if (Math.random() < 0.3) { // 30%くらい
                                    dmg = Math.floor(dmg * 1.5);
                                    this.log("クリティカルヒット！");
                                }
                            }
                        }

                        // 膨張: クリティカル (巨人の指輪)
                        if (this.equipment.accessory && this.equipment.accessory.passive && this.equipment.accessory.passive.type === 'expansion_crit') {
                            const chance = this.player.expansionLevel * 0.25;
                            if (Math.random() < chance) {
                                dmg = Math.floor(dmg * 1.5);
                                this.log("巨人の力でクリティカル！");
                            }
                        }

                        // 研磨 (atk_bonus) の補正
                        const atkBonus = this.player.buffs.find(b => b.buffId === 'atk_bonus');
                        if (atkBonus) {
                            dmg = Math.floor(dmg * 1.5);
                            if (i === 0) this.log("(研磨の効果でダメージ1.5倍！)");
                        }

                        // [拡張] バリア処理
                        const bRes = this.enemy.applyBarrier(dmg);
                        dmg = bRes.damage;
                        if (bRes.absorbed > 0 && i === 0) this.log(`(敵のバリアが軽減)`);

                        // ダメージ適用
                        dmg = this.enemy.takeDamage(dmg);
                        if (this.equipment.accessory && (this.equipment.accessory.curseAtk || (this.equipment.accessory.passive && this.equipment.accessory.passive.curseAtk))) {
    this.applyCurseToEnemy(this.player.atk);
}
                        if (hitCount > 1) {
                            this.log(`${i + 1}撃目: 敵に ${dmg} のダメージ！`);
                        } else {
                            this.log(`通常攻撃！敵に ${dmg} のダメージ！`);
                        }
                        this.animateEnemyDamage();

                        // ドレインバフ判定 (各攻撃で判定)
                        const drainBuff = this.player.buffs.find(b => b.buffId === 'drain_attack');
                        if (drainBuff) {
                            const healAmt = Math.floor(dmg * 0.5);
                            if (healAmt > 0) {
                                this.player.heal(healAmt);
                                // ログが流れすぎるので初回のみ表示
                                if (i === 0) this.log(`吸血！HPを回復した。`); 
                                this.updateStatsUI();
                            }
                        }

                        // [拡張] 被弾カウンター (Damage Counter) - 反撃も各攻撃ごとに受けるリスクあり
                        if (this.enemy.counterStance && this.enemy.counterStance.type === 'damage') {
                            const counterDmg = this.player.takeDamage(this.enemy.counterStance.dmg);
                            this.log(`敵の反撃！ ${counterDmg} のダメージ！`);
                            this.updateStatsUI();
                            if (this.player.isDead()) break; // 死亡したら中断
                        }

                        // 敵が死んだらループを抜ける
                        if (this.enemy.isDead()) break;
                    }
                }
                break;
            
            case 'defend':
                this.player.isDefending = true;
                this.log("防御態勢をとった！ダメージ軽減。");
                break;

            case 'run':
                // ボス戦判定
                if (this.enemy.isBoss) {
                    this.log("ボスからは逃げられない！");
                    this.setControlsEnabled(true); // 操作を戻す
                    return; // ターン消費なしで戻る
                }
                // 逃走判定 (SPD比較 + ランダム)
                const runChance = (this.player.spd / this.enemy.spd) * 0.5;
                if (Math.random() < runChance) {
                    // [Stats] 逃走回数
                    this.player.runStats.escapeCount++;
                    this.log("逃走成功！");
                    this.cleanupBattle(); // デッキ等のリセット
                    this.processEscape()
                    return;
                } else {
                    this.log("逃走失敗...！隙を見せてしまった。");
                }
                break;
            default:
                executed = false;
                break;
        }

        // 敵死亡判定
        if (this.enemy.isDead()) {
            await wait(500);
            this.processWin();
            return;
        }

        // ターン終了へ
        if (executed) {
            await wait(1000);
            this.endPlayerTurn();
        }
    }

    // カード魔法の使用処理
    async playerUseCard(index) {
        const card = this.deck.hand[index];

        // [拡張] 使用不可カードのチェック
        if (card.unplayable) {
            this.showToast("このカードは使用できません", 'warning');
            return;
        }

        // コスト確認 (HP消費型)
        if (card.costType === 'hp') {
            if (this.player.hp <= card.costValue) {
                this.showToast("HPが足りません！", 'warning');
                return;
            }
        }

        this.toggleMagicMenu(false);
        this.setControlsEnabled(false);

        // コスト支払い
        if (card.costType === 'hp') {
            this.player.hp -= card.costValue;
            this.updateStatsUI();
            this.log(`HPを ${card.costValue} 消費した。`);
        }

        this.deck.useCard(index); // カード使用・捨て札へ
        this.updateDeckUI();

        // [Stats] 魔法・スキル使用カウント
        // 魔法使用判定 (物理スキル以外を魔法とみなす)
        // typeが 'magic', 'attack'(魔法攻撃), 'heal', 'buff' など
        // IDが 'skill_' で始まらない、かつ 'item_' で始まらないものを魔法とする
        if (!card.id.startsWith('skill_') && !card.id.startsWith('item_') && card.type !== 'none') {
            this.player.runStats.magicUse++;
        }

        this.log(`${card.name} を発動！`);

        // カード効果実行
        await this.executeCardEffect(card);

        if (this.enemy.isDead()) {
            await wait(500);
            this.processWin();
            return;
        }

        await wait(1000);
        this.endPlayerTurn();
    }

    // カード効果の実装
    async executeCardEffect(card) {
        // [拡張] 関数定義された効果を実行 (New Cards)
        if (card.effect && typeof card.effect === 'function') {
            const result = card.effect(this.player, this.enemy, this);
            if (result && result.msg) {
                this.log(result.msg);
            }
            this.updateStatsUI();
            
            // 強制離脱フラグのチェック
            if (this.forceEscape) {
                this.forceEscape = false;
                await wait(500);
                this.cleanupBattle();
                this.showHome();
                return;
            }
        } else if (card.type === 'attack') {
            const rawDmg = Math.floor(this.player.int * card.power);
            // [拡張] バリア処理
            const bRes = this.enemy.applyBarrier(rawDmg);
            // ignoreDefフラグは takeDamage に渡すため、ここではバリア減算のみ行う
            const dmg = this.enemy.takeDamage(rawDmg, card.ignoreDef);
            const msg = card.ignoreDef ? "防御無視ダメージ！" : "魔法が炸裂！";
            this.log(`${msg} 敵に ${dmg} のダメージ！`);
            this.animateEnemyDamage();

            // [拡張] 与ダメ増加バフ (dmg_boost)
            const boost = this.player.buffs.find(b => b.type === 'dmg_boost');
            if (boost) {
                // 既にダメージ計算後だが、簡易的に追加ダメージとして処理するか、takeDamage前に乗算すべき
                // ここではログだけ出して追加ダメージを与える形にする
            }
        } else if (card.type === 'attack_heal') {
            const rawDmg = Math.floor(this.player.int * card.power);
            const dmg = this.enemy.takeDamage(rawDmg);
            this.log(`ドレイン！敵に ${dmg} のダメージ！`);
            this.animateEnemyDamage();
            const healAmt = Math.floor(dmg * card.healRatio);
            if (healAmt > 0) {
                this.player.heal(healAmt);
                this.log(`HPを ${healAmt} 吸収した！`);
                this.updateStatsUI();
            }
        } else if (card.type === 'heal') {
            this.player.heal(card.power);
            this.log(`HPが ${card.power} 回復した！`);
            if (this.equipment.magic_circle && this.equipment.magic_circle.curseOnHeal) {
        this.applyCurseToEnemy(amount);
    }
            this.updateStatsUI();
        } else if (card.type === 'buff' || card.type === 'buff_turn' || card.type === 'buff_special') {
            if (card.type === 'buff') {
                // 既存のバリアなど（1ターン）
            this.player.isDefending = true; // 簡易的に防御扱い
            this.log(`魔法の壁が展開された！`);
            } else {
                // 継続バフ
                this.player.buffs.push({ ...card, remaining: card.duration });
                this.log(`${card.name} の効果が付与された！(${card.duration}ターン)`);
                this.recalcStats(); // ステータスバフの反映
            }
        } else if (card.type === 'utility') {
            if (card.id === 'reload') {
                this.deck.reloadHand();
                this.updateDeckUI();
                this.renderHandCards();
                this.log("手札をリロードした！");
            }
        } else if (card.type === 'special') {
            if (card.id === 'disrupt') {
                this.enemy.skipTurn = true;
                this.log("敵の体勢を崩した！次の行動をキャンセルさせる。");
            } else if (card.id === 'chaos_gate') {
                // 自分以外からランダム
                const candidates = this.masterDeck.filter(c => c.id !== 'chaos_gate');
                if (candidates.length > 0) {
                    const randomCard = candidates[randomInt(0, candidates.length - 1)];
                    this.log(`＞ ${randomCard.name} が発動！`);
                    await this.executeCardEffect(randomCard);
                } else {
                    this.log("しかし何も起こらなかった...");
                }
            }
        } else if (card.type === 'attack_risk') {
            const rawDmg = Math.floor(this.player.int * card.power);
            const dmg = this.enemy.takeDamage(rawDmg);
            this.log(`捨て身の一撃！敵に ${dmg} のダメージ！`);
            this.animateEnemyDamage();
            
            // リスク判定
            if (Math.random() < card.riskChance) {
                this.applyStatus(card.riskType, 3);
                this.showToast(`反動で ${STATUS_TYPES[card.riskType.toUpperCase()].name} になった！`, 'warning');
            }
        } else if (card.type === 'special_shrink') {
            // 縮小レベルに応じたダメージ
            const mult = [1.0, 1.5, 2.5, 4.0][this.player.shrinkLevel] || 1.0;
            const rawDmg = Math.floor(this.player.int * mult);
            const dmg = this.enemy.takeDamage(rawDmg);
            this.log(`ニードルラッシュ(Lv${this.player.shrinkLevel})！敵に ${dmg} のダメージ！`);
            this.animateEnemyDamage();
        } else if (card.type === 'attack_revenge') {
            let mult = 1.0;
            if (this.player.currentStatus || this.player.shrinkLevel > 0) mult = 2.5;
            const rawDmg = Math.floor(this.player.int * card.power * mult);
            const dmg = this.enemy.takeDamage(rawDmg);
            const msg = mult > 1.0 ? "怒りの一撃！" : "攻撃！";
            this.log(`${msg} 敵に ${dmg} のダメージ！`);
            this.animateEnemyDamage();
        } else if (card.type === 'heal_status') {
            if (card.target === 'status' || card.target === 'all') {
                if (this.player.currentStatus) {
                    this.log(`${this.player.currentStatus.name} が治った！`);
                    this.player.currentStatus = null;
                } else {
                    this.log("状態異常はなかった。");
                }
            }
            if (card.target === 'shrink' || card.target === 'all') {
                if (this.player.shrinkLevel > 0) {
                    this.log("体が元の大きさに戻った！");
                    this.player.shrinkLevel = 0;
                } else if (card.target === 'shrink') {
                    this.log("縮小していなかった。");
                }
            }
            this.updateStatsUI();
        } else if (card.type === 'heal_int') {
            const healAmt = Math.floor(this.player.int * card.power);
            this.player.heal(healAmt);
            this.log(`祈りが届いた... HPが ${healAmt} 回復！`);
            this.updateStatsUI();
        } else if (card.type === 'special_poker') {
            // 手札集計
            const counts = {};
            this.deck.hand.forEach(c => {
                if (c.id !== 'trinity_burst') counts[c.id] = (counts[c.id] || 0) + 1;
            });
            const hasThreeCard = Object.values(counts).some(cnt => cnt >= 3);

            if (hasThreeCard) {
                const dmg = this.enemy.takeDamage(this.player.int * 5);
                this.log(`スリーカード成立！超極大魔法！敵に ${dmg} のダメージ！`);
                this.animateEnemyDamage();
            } else {
                this.log("条件が揃っていない... (手札に同名カード3枚が必要)");
            }
        } else if (card.type === 'attack_warp') {
            const rawDmg = Math.floor(this.player.int * card.power);
            const dmg = this.enemy.takeDamage(rawDmg);
            this.log(`次元斬！敵に ${dmg} のダメージ！`);
            this.animateEnemyDamage();
            if (this.enemy.isDead()) {
                this.log("空間を切り裂き、階層をスキップ！");
                this.depth += 3;
            }
        } else if (card.type === 'buff_drop') {
            this.player.dropQualityBonus = 10;
            this.log("幸運の星が輝く... ドロップ品質アップ！");
        } else if (card.type === 'utility_extend') {
            let count = 0;
            this.player.buffs.forEach(b => {
                b.remaining += 3;
                count++;
            });
            this.log(`${count}個のバフ効果時間を延長した！`);
        } else if (card.type === 'charge') {
            this.player.weaponCharge = true;
            this.log("武器に気が満ちていく！次の攻撃が変化する！");
        } else if (card.type === 'attack_stun') {
            const rawDmg = Math.floor(this.player.int * card.power);
            const dmg = this.enemy.takeDamage(rawDmg);
            this.log(`フルバースト！敵に ${dmg} の超絶ダメージ！`);
            this.animateEnemyDamage();
            this.player.skipTurn = true;
            this.log("反動で動けなくなった...");
        } else if (card.type === 'utility_mana_shrink') {
            this.player.battleStatsMod.int += 50;
            this.log("マナを圧縮し、INTが大幅上昇！");
            this.applyStatus('shrink', 99);
        } else if (card.type === 'attack_discard') {
            if (this.deck.hand.length > 0) {
                const randIdx = randomInt(0, this.deck.hand.length - 1);
                const discarded = this.deck.hand.splice(randIdx, 1)[0];
                this.deck.discardPile.push(discarded);
                this.log(`${discarded.name} を犠牲にして攻撃！`);
                
                const dmg = this.enemy.takeDamage(Math.floor(this.player.int * card.power));
                this.log(`敵に ${dmg} のダメージ！`);
                this.animateEnemyDamage();
            }
        } else if (card.type === 'buff_lust') {
            this.log("妖艶な魔力が体を包み込む！");
            this.player.addBuff({
                type: 'buff_special',
                buffId: 'dmg_cut',
                value: 0.5,
                duration: 3,
                name: '魔性の防壁'
            });
            
            const expLv = this.player.expansionLevel || 0;
            if (this.player.hasStatus('undressing') || this.player.isLiberated || expLv > 0) {
                this.processExpansion(1);
            } else {
                this.processForceStrip();
            }
        } else if (card.type === 'attack_lust_atk') {
            const expLv = this.player.expansionLevel || 0;
            const rawDmg = Math.floor(this.player.atk * (expLv + 1));
            const dmg = this.enemy.takeDamage(rawDmg);
            this.log(`${this.enemy.name}に ${dmg} の膨張ダメージ！`);
            this.animateEnemyDamage();
        } else if (card.type === 'special_charm') {
            const recoil = Math.floor(this.player.hp * 0.5);
            this.player.hp = Math.max(0, this.player.hp - recoil);
            this.updateStatsUI();
            this.log(`体力を ${recoil} 消費して誘惑を放つ！`);
            
            if (this.enemy.isBoss) {
                this.log("ボスには効かなかった！");
            } else {
                const expLv = this.player.expansionLevel || 0;
                const successRate = 0.2 + (expLv * 0.2);
                if (Math.random() < successRate) {
                    this.log(`${this.enemy.name}は戦意を失い、こちらを見つめている……`);
                    await wait(1000);
                    this.processWin();
                    return;
                } else {
                    this.log("敵は誘惑を振り払った！");
                }
            }
        } else if (card.type === 'attack_heavy_press') {
            const expLv = this.player.expansionLevel || 0;
            const rawDmg = Math.floor(this.player.atk * expLv * 1.5);
            const dmg = this.enemy.takeDamage(rawDmg);
            this.log(`${this.enemy.name}を巨大な胸で押し潰した！ ${dmg} ダメージ！`);
            this.animateEnemyDamage();
            this.player.skipTurn = true;
        } else if (card.type === 'attack_vs_intent') {
            let powerMult = 2.0;
            const enemyIntent = this.enemyNextAction ? this.enemyNextAction.type : null;
            
            let isMatch = (enemyIntent === card.targetIntent);
            if (card.targetIntent === 'attack' && enemyIntent === 'strong_attack') isMatch = true;

            if (isMatch) {
                powerMult = 4.0;
                if (card.targetIntent === 'defend') {
                    this.enemy.isDefending = false;
                    this.log("敵のガードを粉砕した！");
                } else {
                    this.log("敵の隙を突くカウンター！");
                }
            }
            
            const rawDmg = Math.floor(this.player.int * powerMult);
            const dmgVal = calculateMagicDamage(rawDmg, this.enemy.int);
            const finalDmg = this.enemy.takeDamage(dmgVal, true); // 魔法なので物理防御無視
            
            this.log(`${this.enemy.name}に ${finalDmg} の特効魔法ダメージ！`);
            this.animateEnemyDamage();
        } else if (card.type === 'none') {
            this.log("しかし何も起こらなかった...");
        }
    }

    // プレイヤーのターン終了 → 敵のターンへ
    endPlayerTurn() {
        // アクセサリーによるターン終了時回復
        if (this.equipment.accessory && this.equipment.accessory.passive) {
            const p = this.equipment.accessory.passive;
            if (p.type === 'turn_end_heal') {
                const healAmount = Math.floor(this.player.maxHp * p.value);
                if (healAmount > 0) {
                    this.player.heal(healAmount);
                    this.log(`${this.equipment.accessory.name} でHPが ${healAmount} 回復。`);
                    this.updateStatsUI();
                }
            }
            // 不安定な指輪 (リスク)
            if (p.type === 'risk_stat_boost') {
                if (Math.random() < p.riskChance) {
                    this.applyStatus('shrink', 99);
                    this.showToast("指輪の呪いで体が縮んでしまった！", 'warning');
                }
            }
            // shrink_lock は recalcStats で常時適用されるためここでは処理不要
            
            // 清めのミサンガ (自動回復)
            if (p.type === 'auto_cure') {
                if (this.player.currentStatus && Math.random() < p.chance) {
                    this.log(`${this.equipment.accessory.name}の効果で状態異常が回復した！`);
                    this.player.currentStatus = null;
                    this.updateStatsUI();
                }
            }

            // [拡張] 汎用ターン終了時効果 (ENDGAME_ITEMS / Magic Circle)
            if (this.equipment.magic_circle) {
                const mc = this.equipment.magic_circle.passive;
                
                // 代償回復
                if (mc.type === 'trade_off_regen') {
                    this.player.heal(Math.floor(this.player.maxHp * mc.regen));
                }
                // 盾シナジー (防壁増強)
                if (mc.type === 'weapon_synergy' && mc.effect === 'shield_boost' && this.equipment.weapon && this.equipment.weapon.name.includes('大盾')) {
                    if (this.player.barrier > 0) {
                        this.player.barrier = Math.floor(this.player.barrier * 1.2);
                        this.log("防壁が強化された！");
                    }
                }
                // 手札廃棄
                if (mc.type === 'turn_end_discard') {
                    if (this.deck.hand.length > 0) {
                        const idx = Math.floor(Math.random() * this.deck.hand.length);
                        const discarded = this.deck.hand.splice(idx, 1)[0];
                        this.deck.discardPile.push(discarded);
                        this.log(`${discarded.name} が記憶から消えた……`);
                        this.renderHandCards();
                    }
                }
            }

            // ▼ 追加: 魔法陣効果 (ターン終了時に膨張)
            if (this.equipment.magic_circle && this.equipment.magic_circle.passive && this.equipment.magic_circle.passive.type === 'auto_expand') {
                // 脱衣状態(膨張含む)ならレベルアップ
                if (this.player.hasStatus('undressing')) {
                    this.processExpansion(1);
                }
            }

            // [拡張] 汎用ターン終了時効果 (ENDGAME_ITEMS)
            Object.values(this.equipment).forEach(item => {
                if (item && item.passive) {
                    if (item.passive.hpRegen) {
                        const healAmt = Math.floor(this.player.maxHp * item.passive.hpRegen);
                        if (healAmt > 0) this.player.heal(healAmt);
                    }
                    if (item.passive.shieldGenRate) {
                        const shieldAmt = Math.floor(this.player.int * item.passive.shieldGenRate);
                        if (shieldAmt > 0) this.player.barrier = (this.player.barrier || 0) + shieldAmt;
                    }
                }
            });

            // BattleSystem.js の endPlayerTurn 内、毒ダメージ処理の付近
if (this.enemy && this.enemy.curse > 0) {
    const curseDmg = this.enemy.curse;
    this.enemy.takeDamage(curseDmg, true); // 防御無視ダメージ
    this.log(`呪いの蝕み！ ${this.enemy.name}に ${curseDmg} のダメージ！`);
    this.enemy.curse = Math.floor(this.enemy.curse / 2); // 呪いを半減
}
        }

        // [拡張] デッキ内パッシブ (ターン終了時効果)
        this.masterDeck.forEach(card => {
            if (card.onTurnEnd) {
                const msg = card.onTurnEnd(this.player);
                if (msg) this.log(msg);
            }
        });

        // 状態異常: 毒ダメージ
        if (this.player.currentStatus && this.player.currentStatus.id === 'poison') {
            const dmg = Math.floor(this.player.maxHp * 0.05) || 1;
            this.player.takeDamage(dmg, true); // 防御無視
            this.log(`毒のダメージ！ HPが ${dmg} 減った。`);
            this.updateStatsUI();
            if (this.player.isDead()) {
                this.processDefeat();
                return;
            }
        }

        // 状態異常: ターン経過
        if (this.player.currentStatus && this.player.statusTurn !== Infinity) {
            this.player.statusTurn--;
            if (this.player.statusTurn <= 0) {
                this.log(`${this.player.currentStatus.name} が治った！`);
                this.player.currentStatus = null;
                this.updateStatsUI(); // 立ち絵更新含む
            }
        }

        // バフの経過処理
        // リジェネ
        this.player.buffs.forEach(buff => {
            if (buff.healPerTurn) {
                this.player.heal(buff.healPerTurn);
                this.log(`${buff.name} でHPが ${buff.healPerTurn} 回復。`);
                this.updateStatsUI();
            }
        });

        // [拡張] 条件付きバフの解除チェック
        this.player.buffs = this.player.buffs.filter(buff => {
            if (buff.condition) {
                // 例: 脱衣中のみ (status: 'undressing')
                if (buff.condition.status && (!this.player.currentStatus || this.player.currentStatus.id !== buff.condition.status)) {
                    return false;
                }
            }
            return true;
        });

        // 期間減算と削除
        this.player.buffs = this.player.buffs.filter(buff => {
            buff.remaining--;
            if (buff.remaining <= 0) {
                this.log(`${buff.name} の効果が切れた。`);
                return false;
            }
            return true;
        });
        this.recalcStats(); // バフ切れによるステータス更新

        this.isPlayerTurn = false;
        this.processEnemyTurn();
        this.saveGame(); // ターン終了セーブ
    }

    // --- 敵のターン処理 ---
    async processEnemyTurn() {
        // 勝利処理が先行した場合、敵はnullになっているためターンを即時終了
        if (!this.enemy) {
            console.log("processEnemyTurn: 敵が存在しないため処理を中断しました。");
            return;
        }

        this.log("敵のターン...");
        await wait(800);
        this.enemy.isDefending = false; // 防御状態リセット

        // 行動スキップ判定
        if (this.enemy.skipTurn) {
            this.log("敵は怯んで動けない！");
            this.enemy.skipTurn = false; // フラグ解除
            
            // 次のターンの準備
            this.turn++;
            this.planEnemyTurn();
            await wait(1000);
            this.startPlayerTurn();
            return;
        }

        // 混乱時は行動予測を隠す処理を planEnemyTurn で行っているが、
        // 実際の行動処理には影響しない（プレイヤーが予測できないだけ）
        
        const action = this.enemyNextAction;
        
        if (action.type === 'attack' || action.type === 'strong_attack') {
            // 回避判定 (縮小化による固定回避)
            let hitChance = 100;
            if (this.player.shrinkLevel > 0) {
                const stats = SHRINK_STATS['LV' + this.player.shrinkLevel];
                if (stats) hitChance -= stats.evasionAdd;
            }

            if (Math.random() * 100 > hitChance) {
                this.log("ヒラリ！攻撃を回避した！");
            } else {
                // 書シナジー (被ダメ無効) - 魔法陣
                if (this.equipment.magic_circle && this.equipment.magic_circle.passive.type === 'weapon_synergy' && this.equipment.magic_circle.passive.effect === 'barrier_chance') {
                    if (this.equipment.weapon && this.equipment.weapon.name.includes('書') && (!this.player.barrier || this.player.barrier <= 0)) {
                        if (Math.random() < 0.2) {
                            action.damageScale = 0; // ダメージ0化
                            this.log("賢者の知恵でダメージを無効化した！");
                        }
                    }
                }
                let rawDmg = Math.floor(this.enemy.atk * action.damageScale);
                
                // [拡張] バリア処理
                const bRes = this.player.applyBarrier(rawDmg);
                rawDmg = bRes.damage;

                // 膨張: 被ダメージ軽減 (風船の護符)
                if (this.equipment.accessory && this.equipment.accessory.passive && this.equipment.accessory.passive.type === 'expansion_dmg_cut' && this.player.expansionLevel > 0) {
                    rawDmg = Math.floor(rawDmg * 0.7);
                }

                if (bRes.absorbed > 0) this.log(`(バリアが ${bRes.absorbed} ダメージ軽減)`);

                let dmg = this.player.takeDamage(rawDmg);

                // [拡張] 被弾カウンター (Damage Counter)
                if (this.player.counterStance && this.player.counterStance.type === 'damage') {
                    const counterDmg = this.enemy.takeDamage(this.player.counterStance.dmg);
                    this.log(`反撃！敵に ${counterDmg} のダメージ！`);
                }

                // 縮小化による被ダメージ増加 (最終ダメージに乗算)
                if (this.player.shrinkLevel > 0) {
                    const stats = SHRINK_STATS['LV' + this.player.shrinkLevel];
                    if (stats && stats.damageRate > 1.0) {
                        const extraDmg = Math.floor(dmg * (stats.damageRate - 1));
                        if (extraDmg > 0) {
                            this.player.hp = Math.max(0, this.player.hp - extraDmg);
                            dmg += extraDmg;
                        }
                    }
                }
            
                // 画面揺れ演出
                document.body.classList.add('shake');
                setTimeout(() => document.body.classList.remove('shake'), 500);

                this.log(`${action.label}！ ${dmg} のダメージを受けた！`);
                this.updateStatsUI();
            }

            // ▼ 追加: マゾヒストガーター効果
            const acc = this.equipment.accessory;
            if (acc && acc.id === 'acc_click_dmg' && dmg > 0) { // ダメージを受けた場合
                 if (this.player.hasStatus('undressing') || this.player.isLiberated || this.player.expansionLevel > 0) {
                    if (this.player.expansionLevel < 4) {
                        this.player.expansionLevel++;
                        this.log("痛みを快感に変換し、さらに膨張した！");
                    }
                } else {
                    this.processForceStrip();
                    this.log("衝撃で服が破け散った！");
                }
                this.updateCharacterSprite();
                this.recalcStats();
            }
        } else if (action.type === 'defend') {
            this.enemy.isDefending = true;
            this.log("敵は身を固めている！(DEF UP)");
        } else if (action.type === 'skill_status') {
            this.log(`敵は不気味な呪文を唱えた！`);
            this.applyStatus(action.status, 3);
        } else if (action.type === 'skill_shrink') {
            this.log(`敵は縮小魔法を放ってきた！`);
            if (Math.random() < action.chance) {
                this.applyStatus('shrink', 99);
            } else {
                this.log("しかし魔法は効かなかった！");
            }
        } else if (action.type === 'skill_cure_shrink') {
            this.log("敵は何故か回復魔法をかけた？");
            if (this.player.shrinkLevel > 0) {
                this.player.shrinkLevel = 0;
                this.log("体が元の大きさに戻った！");
                this.updateStatsUI();
            }
        } else {
            this.log("敵は様子をうかがっている...");
        }

        // プレイヤー死亡判定
        if (this.player.isDead()) {
            await wait(500);
            this.processDefeat();
            return;
        }

        // 次のターンの準備
        this.turn++;
        this.planEnemyTurn();
        await wait(1000);
        this.startPlayerTurn();
    }

    // --- 勝利・ドロップ関連 ---

    // 戦闘終了時のクリーンアップ
    cleanupBattle() {
        this.inBattle = false;
        this.enemy = null;
        this.turnCount = 0;

        // ▼ 修正: 戦闘用ステータスの完全リセット
        this.player.isDefending = false;
        this.player.weaponCharge = false;
        
        this.player.buffs = []; 

        // 戦闘中の一時補正をリセット
        this.player.battleStatsMod = { atk: 0, def: 0, int: 0, spd: 0 };

        this.deck.hand = [];
        this.deck.discardPile = [];
        this.deck.drawPile = []; // 必要なら reshuffle するが、次は startBattle で初期化されるはず

        this.player.currentStatus = null;

        // 戦闘用一時ステータスのリセット
        this.player.battleStatsMod = { atk: 0, def: 0, int: 0, spd: 0 };
        this.player.weaponCharge = false;
        this.player.dropQualityBonus = 0;

        // ▼ 追加: 混沌の報酬フラグをリセット
        this.chaosRewardCard = false; // 追加カード獲得フラグ
        this.chaosLootMod = 0;        // ドロップ補正値加算
        
        // ▼ 追加: 即座に再計算して探索状態のステータスを表示する
        this.recalcStats();
        this.updateStatsUI();
        this.updateCharacterSprite(); // 通常立ち絵に戻す(ピンチ顔などの解除)

        this.ui.battleCommands.style.display = 'none';
        this.ui.systemCommands.style.display = 'none';
    }

// 勝利処理
    async processWin() {
        if (!this.enemy) {
            this.cleanupBattle();
            this.showHome();
            return;
        }

        const isBoss = this.enemy.isBoss;
        const enemyName = this.enemy.name;

        // ログ出力
        this.log(`${enemyName}を倒した！`);
        
        // 演出
        if (this.ui.enemyGraphic) {
            this.ui.enemyGraphic.classList.add('defeat-anim');
        }

        // --- 演出待ち (短縮) ---
        setTimeout(() => {
            let dropNum = 1;
            if (isBoss) dropNum += 2;

            const currentLoot = [];

            // ドロップ生成
            for (let i = 0; i < dropNum; i++) {
                if (typeof this.generateLoot === 'function') {
                    const loot = this.generateLoot(isBoss);
                    if (loot) {
                        this.tempInventory.push(loot);
                        currentLoot.push(loot);
                    }
                }
            }
            if (isBoss) this.log("エリアボスを撃破した！");

            // --- 画面切り替え待ち (さらに短縮) ---
            setTimeout(() => {
                this.cleanupBattle(); 
                this.inBattle = false;

                this.ui.battleCommands.style.display = 'none';
                this.ui.systemCommands.style.display = 'flex';
                this.ui.enemyGraphic.classList.remove('defeat-anim');

                // ★変更: 汎用メソッド呼び出し
                this.showInlineResult(currentLoot, "VICTORY");

                if (typeof this.renderDungeonButtons === 'function') {
                    this.renderDungeonButtons();
                } else {
                    this.showHome();
                }
                
                this.saveGame();

            }, 400); // 800ms -> 400ms に短縮

        }, 600); // 最初の待ちも 800ms -> 600ms 程度に短縮
    }


    // 逃走処理
    async processEscape(isSmokeBomb = false) {
        // 成功判定 (煙玉なら必ず成功)
        // ※既存の判定ロジックがあれば維持してください。ここでは簡易実装です。
        const success = isSmokeBomb || (Math.random() < 0.8); // 仮: 80%

        if (!success) {
            this.log("逃げられなかった！");
            await wait(500);
            this.processEnemyTurn();
            return;
        }

        // 成功時
        this.log(isSmokeBomb ? "煙玉を使って逃げ出した！" : "逃走に成功した！");
        
        // 逃走アニメーション (敵がフェードアウト)
        if (this.ui.enemyGraphic) {
            this.ui.enemyGraphic.classList.add('escape-anim');
        }

        // 演出待ち
        await wait(600);

        // クリーンアップ
        this.cleanupBattle();
        this.inBattle = false;

        // UIリセット
        this.ui.battleCommands.style.display = 'none';
        this.ui.systemCommands.style.display = 'flex';
        this.ui.enemyGraphic.classList.remove('escape-anim');
        
        // ★変更: 「ESCAPE」リザルトを表示
        this.showInlineResult([], "ESCAPE", "escape");

        // 次の選択肢へ
        if (typeof this.renderDungeonButtons === 'function') {
            this.renderDungeonButtons();
        } else {
            this.showHome();
        }
        
        this.saveGame();
    }

    // リザルト画面を閉じて、次へ進む
    closeBattleResult() {
        const overlay = document.getElementById('battle-result-overlay');
        if (overlay) overlay.style.display = 'none';

        // 画面リセット
        this.ui.battleCommands.style.display = 'none';
        this.ui.systemCommands.style.display = 'flex';
        this.ui.enemyGraphic.classList.remove('defeat-anim');
        this.ui.enemyGraphic.textContent = "";

        // 探索コマンドの描画
        if (typeof this.renderDungeonButtons === 'function') {
            this.renderDungeonButtons();
        } else {
            this.showHome();
        }
        
        this.log("探索を続けますか？");
        this.saveGame();
    }
    
// インラインリザルト表示 (汎用・スタイル対応版)
    showInlineResult(lootList, titleText = "GET ITEMS", type = 'normal') {
        const lootArea = document.getElementById('battle-loot-area');
        const enemyGraph = document.getElementById('enemy-graphic');
        const enemyIntent = document.getElementById('enemy-intent');

        if (!lootArea) return;

        // 敵表示などを隠す
        if (enemyGraph) enemyGraph.style.display = 'none';
        if (enemyIntent) enemyIntent.style.display = 'none';

        // 表示
        lootArea.style.display = 'block';
        lootArea.innerHTML = '';

        // タイトル
        const title = document.createElement('div');
        title.className = 'inline-loot-title';
        title.textContent = titleText;
        
        // ▼ タイプによって色を変える
        if (type === 'escape') {
            title.classList.add('escape-mode');
        }
        
        lootArea.appendChild(title);

        if (!lootList || lootList.length === 0) {
            const emptyMsg = document.createElement('div');
            // 逃走時はメッセージを変える
            if (type === 'escape') {
                emptyMsg.textContent = "安堵感を得た...";
            } else {
                emptyMsg.textContent = "獲得アイテムなし";
            }
            emptyMsg.style.textAlign = "center";
            emptyMsg.style.color = "#777";
            emptyMsg.style.padding = "20px";
            lootArea.appendChild(emptyMsg);
        } else {
            // (既存のアイテム表示ループ)
            lootList.forEach(item => {
                const div = document.createElement('div');
                div.className = 'inline-loot-item';
                
                if (item.plusValue >= 5 || item.type === 'magic_circle' || (item.id && item.id.startsWith('acc_'))) {
                    div.classList.add('inline-loot-rare');
                }

                let descText = "";
                if (item.passive) descText = item.passive.desc || item.passive.name;
                else if (item.desc) descText = item.desc;
                else {
                    let stats = [];
                    if (item.atk) stats.push(`ATK+${item.atk}`);
                    if (item.def) stats.push(`DEF+${item.def}`);
                    if (item.int) stats.push(`INT+${item.int}`);
                    if (item.spd) stats.push(`SPD+${item.spd}`);
                    if (item.hp)  stats.push(`HP+${item.hp}`);
                    descText = stats.join(', ');
                }

                let icon = '📦';
                if (item.type === 'magic_circle') icon = '🔯';
                else if (item.type === 'accessory') icon = '💍';
                else if (item.type === 'card' || item.cost !== undefined) icon = '🃏';
                else if (item.type === 'weapon') icon = '⚔️';
                else if (item.type === 'armor') icon = '🛡️';

                div.innerHTML = `
                    <div class="inline-loot-name">${icon} ${item.name}</div>
                    <div class="inline-loot-desc">${descText}</div>
                `;
                lootArea.appendChild(div);
            });
        }
    }
// BattleSystem.js - generateLoot メソッドの修正

// ドロップ生成ロジック
    generateLoot(isBoss = false) {
        // ドロップ率の重み付け
        let weights = { weapon: 35, armor: 35, accessory: 15, magic_circle: 15 };

        if (this.equipment.magic_circle) {
            const mc = this.equipment.magic_circle.passive;
            if (mc.type === 'drop_rate_mod' && weights[mc.target]) {
                weights[mc.target] += 50;
            }
            if (mc.type === 'win_card_loot' && Math.random() < mc.chance) {
                const card = CARD_DATABASE[Math.floor(Math.random() * CARD_DATABASE.length)];
                card.cost = 0; 
                return card; 
            }
        }

        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
        let r = Math.random() * totalWeight;
        let type = 'weapon';
        
        if (r < weights.weapon) type = 'weapon';
        else if (r < weights.weapon + weights.armor) type = 'armor';
        else if (r < weights.weapon + weights.armor + weights.accessory) type = 'accessory';
        else type = 'magic_circle';

        let item = { type: type, level: this.depth };

        // ランク(Tier)決定
        const effectiveDepth = this.depth + (this.player.dropQualityBonus || 0);
        let tierIndex = 0;
        if (effectiveDepth >= 50) tierIndex = 5;
        else if (effectiveDepth >= 30) tierIndex = 4;
        else if (effectiveDepth >= 20) tierIndex = 3;
        else if (effectiveDepth >= 10) tierIndex = 2;
        else if (effectiveDepth >= 5) tierIndex = 1;
        
        // ▼▼▼ 変更: 3種類(バランス/物理/魔法)から抽選 ▼▼▼
        const randType = Math.random();
        let subType = 'bal'; // デフォルト: バランス(既存)
        if (randType < 0.33) subType = 'phy';      // 物理
        else if (randType < 0.66) subType = 'mag'; // 魔法
        
        // data.js で定義したデータを取り出す
        const matData = MATERIAL_TIERS[tierIndex][subType];
        
        const power = matData.power;
        const bias = matData.bias || { atk:1, def:1, int:1, spd:1 };

        if (type === 'weapon') {
            const wKeys = Object.keys(WEAPON_TYPES);
            const wKey = wKeys[Math.floor(Math.random() * wKeys.length)];
            const wType = WEAPON_TYPES[wKey];
            
            // IDにサブタイプ(bal/phy/mag)を含めて区別する
            item.id = `gen_weapon_${tierIndex}_${subType}_${wKey}`;
            item.name = `${matData.name}${wType.name}`;
            item.atk = 0; item.int = 0; item.def = 0; item.hp = 0; item.spd = 0;

            const mainVal = Math.floor(power * wType.mod);
            
            // メインステータスにバイアスを適用
            if (wType.stat === 'atk') item.atk = Math.floor(mainVal * bias.atk);
            if (wType.stat === 'int') item.int = Math.floor(mainVal * bias.int);
            if (wType.stat === 'def') item.def = Math.floor(mainVal * bias.def);

            // サブステータスにもバイアス適用
            if (wType.sub) {
                Object.keys(wType.sub).forEach(key => {
                    let val = Math.floor(power * wType.sub[key]);
                    if (key === 'hp') val *= 5;
                    
                    // HPなどにも補正をかけたい場合はここで bias[key] を掛ける
                    if (bias[key]) val = Math.floor(val * bias[key]);
                    
                    item[key] = (item[key] || 0) + val;
                });
            }
        } 
        else if (type === 'armor') {
            const aKeys = Object.keys(ARMOR_TYPES);
            const aKey = aKeys[Math.floor(Math.random() * aKeys.length)];
            const aType = ARMOR_TYPES[aKey];

            item.id = `gen_armor_${tierIndex}_${subType}_${aKey}`;
            item.name = `${matData.name}${aType.name}`;
            item.atk = 0; item.int = 0; item.def = 0; item.hp = 0; item.spd = 0;

            const isModObj = (typeof aType.mod === 'object');
            
            aType.main.forEach(statKey => {
                let multiplier = isModObj ? (aType.mod[statKey] || aType.mod.others || 1.0) : aType.mod;
                let val = Math.floor(power * multiplier);
                if (statKey === 'hp') val *= 5;

                // バイアス適用
                if (bias[statKey]) val = Math.floor(val * bias[statKey]);

                item[statKey] = (item[statKey] || 0) + val;
            });
        } 
        else if (type === 'accessory') {
            let candidates = ACCESSORY_EFFECTS.filter(e => !e.isUnique);
            if (this.mode === 'rogue' && this.depth < 30) {
                candidates = candidates.filter(e => !e.id.startsWith('pin_small'));
            }
            const effect = candidates[randomInt(0, candidates.length - 1)];
            item.id = effect.id;
            item.name = effect.name;
            item.passive = effect;
            item.atk = 0; item.int = 0; item.def = 0; item.hp = 0; item.spd = 0;
        } 
        else if (type === 'magic_circle') {
            const effect = MAGIC_CIRCLE_DATABASE[Math.floor(Math.random() * MAGIC_CIRCLE_DATABASE.length)];
            item.id = effect.id;
            item.name = effect.name;
            item.passive = effect;
            item.atk=0; item.def=0; item.int=0; item.hp=0; item.spd=0;
        }

        // 強化値 (+X) システム
        let plusVal = 0;
        if (this.mode === 'rogue') {
            const base = Math.floor(this.depth / 10);
            const variance = Math.floor(Math.random() * 7) - 3;
            plusVal = base + variance;
            if (plusVal < 0) plusVal = 0;
        } else {
            plusVal = Math.floor(this.depth / 3);
        }

        if (this.equipment.magic_circle && this.equipment.magic_circle.passive.type === 'loot_plus_mod') {
            plusVal += 1;
        }
        if (this.chaosLootMod) {
            plusVal += this.chaosLootMod;
        }

        if (plusVal > 0 && type !== 'accessory' && type !== 'magic_circle') {
            item.name += `(+${plusVal})`;
            item.plusValue = plusVal;

            if (type === 'weapon') {
                if (item.atk > 0) item.atk += plusVal;
                if (item.int > 0) item.int += plusVal;
            } else if (type === 'armor') {
                if (item.def > 0) item.def += plusVal;
                if (item.atk > 0) item.atk += plusVal;
                if (item.int > 0) item.int += plusVal;
                if (item.spd > 0) item.spd += plusVal;
            }
        }

        return item;
    }

    // BattleSystem.js 内
applyCurseToEnemy(amount) {
    if (!this.enemy) return;
    this.enemy.addCurse(amount);
    
    // 装飾品：呪い増幅 (1.2倍)
    if (this.equipment.accessory && (this.equipment.accessory.curseBoost || (this.equipment.accessory.passive && this.equipment.accessory.passive.curseBoost))) {
        this.enemy.curse = Math.floor(this.enemy.curse * 1.2);
    }
}
        // リザルトセリフ判定ロジック
    checkResultDialogue(player, inventory) {
        // 1. Loot Check (Plus Value)
        let maxPlus = 0;
        inventory.forEach(item => { if((item.plusValue || 0) > maxPlus) maxPlus = item.plusValue; });

        if (maxPlus >= 50) return 'result_loot_50';
        if (maxPlus >= 40) return 'result_loot_40';
        if (maxPlus >= 30) return 'result_loot_30';
        if (maxPlus >= 20) return 'result_loot_20';

        // 2. Play Style (Strip)
        const stripCount = player.runStats.selfStripCount || 0;
        if (stripCount >= 20) return 'result_strip_high';
        if (stripCount >= 10) return 'result_strip_mid';
        if (stripCount >= 3)  return 'result_strip_low';

        // 3. Challenges (Floor 20+)
        if (player.runStats.maxFloor >= 20) {
            if (!player.runStats.everEquipped) return 'result_naked';
            if (player.runStats.magicUse === 0) return 'result_no_magic';
            if (player.runStats.attackUse === 0) return 'result_no_attack';
            if (player.runStats.escapeCount >= 10) return 'result_escape_master';
        }

        return null; // 通常セリフへ
    }

    showWinMenu(hasLoot, lootItem, title = "VICTORY") {
        this.menuUi.overlay.style.display = 'flex';
        this.menuUi.title.textContent = title;
        
        if (title === "TREASURE") this.menuUi.title.style.color = "#3498db";
        else this.menuUi.title.style.color = "#f1c40f";

        // メインビュー（オーバーレイ）の設定: 戦利品リストを大きく表示
        this.menuUi.content.style.display = 'none'; // HPなどのテキストは隠す
        this.menuUi.buttons.innerHTML = ''; // オーバーレイ内のボタンは削除

        if (hasLoot && lootItem) {
            this.menuUi.loot.style.display = 'block';
            this.menuUi.loot.style.maxHeight = '80%'; // 高さを広げる
            this.menuUi.loot.innerHTML = 
                `<div style="color:#fff; margin-bottom:10px; font-weight:bold;">【戦利品獲得】</div>` +
                (lootItem.cost !== undefined 
                    ? `<div class="loot-item" style="font-size:16px; color:#f1c40f;">🃏 ${lootItem.name} <br><small>${lootItem.desc}</small></div>`
                    : `<div class="loot-item" style="font-size:16px; color:#f1c40f;">✨ ${lootItem.name} <br><small>${this.getItemStatsString(lootItem)}</small></div>`) +
                `<hr style="border-color:#555; margin:10px 0;">` +
                `<div style="color:#ccc; font-size:12px;">仮取得リスト (帰還で確定):</div>` +
                this.tempInventory.map(i => `<div class="loot-item">${i.cost !== undefined ? '🃏' : '✨'} ${i.name}</div>`).join('');
        } else {
            this.menuUi.loot.style.display = 'none';
        }

        // コマンドエリアの設定: 次の行動選択を表示
        this.ui.battleCommands.style.display = 'none';
        this.ui.systemCommands.style.display = 'flex';
        this.ui.systemCommands.innerHTML = '';

        // 階層情報テキスト
        const infoDiv = document.createElement('div');
        infoDiv.style.textAlign = 'center';
        infoDiv.style.fontWeight = 'bold';
        infoDiv.innerHTML = `次は <span style="color:#e74c3c">地下 ${this.depth + 1} 階</span>`;
        this.ui.systemCommands.appendChild(infoDiv);

        this.renderDungeonButtons();
    }

    // ダンジョン進行用ボタンの描画
    renderDungeonButtons() {
        // ボタン生成（右下エリア用）
        const buttons = [
            { text: "さらに奥へ進む", onClick: () => this.goNextFloor() },
            { 
                text: this.mode === 'rogue' ? "リタイア (記録終了)" : "街へ帰還する", 
                onClick: () => {
                    console.log("帰還ボタンが押されました。");
                    if (this.mode === 'rogue') {
                        if (!confirm("リタイアしますか？ (アイテムは持ち帰れません)")) return;
                        // endRogueModeはreturnHome内で呼ばれるが、
                        // ここで明示的に呼ぶか、returnHomeに任せるか。
                        // 既存実装ではreturnHome内でendRogueModeを呼んでいるため、
                        // そのままreturnHomeを呼ぶ。
                        this.returnHome();
                    } else {
                        this.returnHome();
                    }
                }
            }
        ];

        // 休憩ボタン追加
        const isHpFull = this.player.hp >= this.player.maxHp;
        const isRestEmpty = this.restCount <= 0;
        const restText = `休憩 (残り${this.restCount}回)`;
        buttons.splice(1, 0, { 
            text: restText, 
            onClick: () => this.processRest(),
            disabled: isHpFull || isRestEmpty
        });

        // [専用ルールA] ダンジョン内編成 (Rogue Mode)
        // 休憩画面（ダンジョン進行選択画面）でも編成可能に
        if (this.mode === 'rogue') {
            buttons.push({ text: "編成", onClick: () => this.openManagement() });
        }

        this.ui.systemCommands.innerHTML = ''; // クリアして再描画
        // 階層情報テキスト再追加
        const infoDiv = document.createElement('div');
        infoDiv.style.textAlign = 'center';
        infoDiv.style.fontWeight = 'bold';
        infoDiv.innerHTML = `次は <span style="color:#e74c3c">地下 ${this.depth + 1} 階</span>`;
        this.ui.systemCommands.appendChild(infoDiv);

        this.renderSystemButtons(buttons);
    }

    // 休憩処理
    processRest() {
        if (this.restCount > 0 && this.player.hp < this.player.maxHp) {
            this.player.hp = this.player.maxHp;
            this.restCount--;
            this.log(`少し休憩した。体力が全回復した！（残り${this.restCount}回）`);
            this.updateStatsUI();
            this.renderDungeonButtons(); // ボタン状態更新
        }
    }

    // 敵ダメージ時の演出
    animateEnemyDamage() {
        this.ui.enemyGraphic.style.transform = 'scale(0.9) rotate(5deg)';
        this.ui.enemyGraphic.style.backgroundColor = '#e74c3c'; // 一瞬赤く
        setTimeout(() => {
            this.ui.enemyGraphic.style.transform = 'scale(1) rotate(0deg)';
            this.ui.enemyGraphic.style.backgroundColor = '#8e44ad'; // 元の色
        }, 200);
    }

    // ボタン制御
    setControlsEnabled(enabled) {
        this.ui.btns.forEach(btn => {
            btn.disabled = !enabled;
            btn.style.opacity = enabled ? 1 : 0.5;
        });
    }

    // メニューボタン生成ヘルパー
    renderMenuButtons(actions) {
        this.menuUi.buttons.innerHTML = '';
        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.textContent = action.text;
            btn.onclick = action.onClick;
            this.menuUi.buttons.appendChild(btn);
        });
    }

    // システムエリア用ボタン生成
    renderSystemButtons(actions) {
        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.textContent = action.text;
            btn.onclick = action.onClick;
            if (action.disabled) {
                btn.disabled = true;
                btn.style.opacity = 0.5;
            }
            this.ui.systemCommands.appendChild(btn);
        });
    }

    // 状態異常付与メソッド
    applyStatus(statusId, turns = 3) {
        if (statusId === 'shrink') {
            // ▼ 追加: 反転のピアス効果
            const acc = this.equipment.accessory;
            const isConvert = acc && acc.id === 'acc_click_convert' && 
                              (this.player.hasStatus('undressing') || this.player.isLiberated || this.player.expansionLevel > 0);

            if (isConvert) {
                // 縮小の代わりに膨張
                this.processExpansion(1); // 膨張Lv+1
                this.log("反転のピアスが輝き、縮小の呪いを膨張の力に変えた！");
                this.showToast("反転のピアス：縮小効果が反転した！", "system");
                return; // 縮小処理は行わない
            }

            // 巨人のベルト (縮小無効)
            if (this.equipment.accessory && this.equipment.accessory.passive && this.equipment.accessory.passive.type === 'immune_shrink') {
                this.log("巨人のベルトが縮小を防いだ！");
                return;
            }
            // [拡張] 伝説級装備による縮小無効
            let nullify = false;
            Object.values(this.equipment).forEach(item => {
                if (item && item.passive) {
                    if (item.passive.nullifyStatus) nullify = true;
                    if (item.passive.nullifyShrink) nullify = true;
                }
            });
            if (nullify) {
                this.log("装備の加護が縮小を防いだ！");
                return;
            }

            if (this.player.shrinkLevel < 3) {
                this.player.shrinkLevel++;
                this.registerCollection('statuses', 'shrink'); // ▼ 追加: 縮小登録
                this.log("体が小さくなってしまった！(ATK/DEF低下)");
            } else {
                this.log("これ以上は小さくなれない！");
            }
        } else {
            // ▼▼▼ 修正: 解放の証による状態異常無効化 (判定強化) ▼▼▼
            const acc = this.equipment.accessory;
            // プロパティ判定(isLiberationProof) または ID判定(acc_liberation_proof)
            if (acc && (acc.isLiberationProof || acc.id === 'acc_liberation_proof')) {
                // 縮小以外は無効
                this.log("解放の証が状態異常を弾いた！");
                this.showToast("状態異常無効！", "success");
                return;
            }
            // [拡張] 伝説級装備による状態異常無効
            let nullify = false;
            Object.values(this.equipment).forEach(item => {
                if (item && item.passive) {
                    if (item.passive.nullifyStatus) nullify = true;
                    if (item.passive.nullifyBadStatus && item.passive.nullifyBadStatus.includes(statusId)) nullify = true;
                }
            });
            if (nullify) {
                this.log("装備の加護が状態異常を弾いた！");
                this.showToast("状態異常無効！", "success");
                return;
            }

            // ▼ 追加: 状態異常にかかったら図鑑登録
            this.registerCollection('statuses', statusId);

            const status = STATUS_TYPES[statusId.toUpperCase()];
            if (status) {
                this.player.currentStatus = status;
                this.player.statusTurn = turns;
                this.log(`${status.name} になってしまった！`);
            }
        }
        this.recalcStats();
        this.updateStatsUI();
    }

    // トースト通知表示
    showToast(message, type = 'normal') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const el = document.createElement('div');
        el.className = 'toast-msg';
        if (type === 'warning') el.classList.add('toast-warning');
        if (type === 'success') el.classList.add('toast-success');
        el.textContent = message;

        container.appendChild(el);
        // CSSアニメーションで消えるが、DOMからも削除
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 3000);
    }

    // 混沌の効果を実行する
    async executeChaos(baseCount) {
        let count = baseCount;
        
        // 回数増加ボーナスの計算
        if (this.equipment.accessory) {
            if (this.equipment.accessory.passive.type === 'chaos_reflector') count += 3;
            if (this.equipment.accessory.passive.type === 'chaos_healer') count += 5;
        }
        if (this.equipment.magic_circle) {
            if (this.equipment.magic_circle.passive.type === 'chaos_cost_zero') count += 3;
            if (this.equipment.magic_circle.passive.type === 'chaos_death_gamble') count += 8;
        }

        this.log(`混沌の発動回数: ${baseCount} -> ${count}回`);

        let remaining = count;
        // 無限ループ防止のリミッター（念のため）
        let loopSafety = 30; 

        while (remaining > 0 && loopSafety > 0) {
            remaining--;
            loopSafety--;
            await wait(200); // 演出用ウェイト

            // 強欲の杯 (回復)
            if (this.equipment.accessory && this.equipment.accessory.passive.type === 'chaos_healer') {
                const healVal = Math.floor(this.player.maxHp * 0.2);
                this.player.heal(healVal);
            }

            // ▼ 変更: 抽選範囲を 1~21 に拡大
            const roll = randomInt(1, 21);

            switch (roll) {
                // Case 1~16 (省略: 変更なし)
                case 1: 
                    this.player.addBuff({ type: 'stat_up', buffStats: { atkScale: 1.0 }, duration: 3, name: '混沌の怪力', desc: 'ATK+100%' });
                    this.log("混沌の怪力！(ATK+100%)");
                    break;
                case 2: 
                    this.player.addBuff({ type: 'stat_up', buffStats: { def: this.player.def }, duration: 3, name: '混沌の硬化', desc: 'DEF+100%' });
                    this.log("混沌の硬化！(DEF+100%)");
                    break;
                case 3: 
                    this.player.addBuff({ type: 'stat_up', buffStats: { intScale: 1.0 }, duration: 3, name: '混沌の知性', desc: 'INT+100%' });
                    this.log("混沌の知性！(INT+100%)");
                    break;
                case 4: 
                    this.player.addBuff({ type: 'stat_up', buffStats: { spd: this.player.spd }, duration: 3, name: '混沌の加速', desc: 'SPD+100%' });
                    this.log("混沌の加速！(SPD+100%)");
                    break;
                case 5: 
                    this.player.addBuff({ type: 'evasion_up', val: 30, duration: 3, name: '混沌の幻影', desc: '回避率+30%' });
                    this.log("混沌の幻影！(回避+30%)");
                    break;
                case 6: 
                    {
                        const rate = (randomInt(50, 300) / 100);
                        const dmg = Math.floor(this.player.atk * rate);
                        this.enemy.takeDamage(dmg);
                        this.log(`デタラメな物理攻撃！ ${dmg}ダメージ`);
                        this.animateEnemyDamage();
                    }
                    break;
                case 7: 
                    {
                        const rate = (randomInt(50, 300) / 100);
                        const dmg = Math.floor(this.player.int * rate);
                        this.enemy.takeDamage(dmg);
                        this.log(`制御不能な魔力弾！ ${dmg}ダメージ`);
                        this.animateEnemyDamage();
                    }
                    break;
                case 8: 
                    {
                        const texts = ["小石につまづいて敵にぶつかった！", "デコピンがヒット！", "威嚇したら敵が少しビビった！", "投げキッスが直撃！"];
                        this.enemy.takeDamage(1);
                        this.log(`${texts[randomInt(0, texts.length - 1)]}`);
                        this.animateEnemyDamage();
                    }
                    break;
                case 9: 
                    {
                        const selfDmg = Math.floor(this.player.maxHp * 0.5);
                        if (this.equipment.accessory && this.equipment.accessory.passive.type === 'chaos_reflector') {
                            this.enemy.takeDamage(selfDmg);
                            this.log(`「混沌の鏡」が自傷の運命を反転！ 敵に ${selfDmg} のダメージ！`);
                            this.animateEnemyDamage();
                        } else {
                            const actualDmg = Math.min(selfDmg, this.player.hp - 1);
                            if (actualDmg > 0) {
                                this.player.takeDamage(actualDmg);
                                this.log(`魔力が暴走して自爆！ ${actualDmg}のダメージ！`);
                            } else {
                                this.log("魔力が暴走したが、ギリギリ持ち堪えた！");
                            }
                        }
                    }
                    break;
                case 10: 
                    this.chaosRewardCard = true;
                    this.log("空間が歪み、新たなカードの気配がする…");
                    break;
                case 11: 
                    this.chaosLootMod = (this.chaosLootMod || 0) + 1;
                    this.log("運命が書き換わり、財宝の質が高まった気がする…");
                    break;
                case 12: 
                    {
                        const texts = ["体が急激に縮んでいく！", "視界が巨大化した！？ いや、私が小さくなったのか！", "まるで人形のようなサイズに！"];
                        this.log(texts[randomInt(0, texts.length - 1)]);
                        this.player.shrinkLevel = Math.min(3, this.player.shrinkLevel + 3);
                    }
                    break;
                case 13: 
                    {
                        this.log("体が勝手に動き出し、武器を振るった！");
                        let hitCount = 1;
                        if (this.equipment.accessory && this.equipment.accessory.passive && this.equipment.accessory.passive.type === 'weapon_syn_cannon') hitCount += 2;
                        if (this.equipment.magic_circle && this.equipment.magic_circle.passive && this.equipment.magic_circle.passive.type === 'status_attack_plus' && this.player.currentStatus) hitCount += 1;
                        const multiHitBuff = this.player.buffs.find(b => b.type === 'multi_hit');
                        if (multiHitBuff) hitCount += 2;
                        if (this.equipment.magic_circle && this.equipment.magic_circle.passive && this.equipment.magic_circle.passive.type === 'expansion_multi_hit') hitCount += this.player.expansionLevel;

                        for(let i=0; i<hitCount; i++) {
                            if (i > 0) await wait(100);
                            let dmg = Math.floor(this.player.atk * (randomInt(90, 110)/100));
                            if (this.equipment.accessory && this.equipment.accessory.passive && this.equipment.accessory.passive.type === 'weapon_syn_cannon') dmg = Math.floor(dmg * 0.7);
                            this.enemy.takeDamage(dmg);
                            this.log(`追撃(${i+1}): ${dmg}ダメージ！`);
                            this.animateEnemyDamage();
                            if(this.enemy.isDead()) break;
                        }
                    }
                    break;
                case 14: 
                    {
                        this.log("武器の奥義が勝手に発動する！");
                        let dmg = Math.floor(this.player.atk * 2.5);
                        if (this.equipment.accessory && this.equipment.accessory.passive && this.equipment.accessory.passive.type === 'weapon_syn_spec' && this.equipment.weapon && this.equipment.weapon.name.includes('剣')) {
                            dmg *= 2;
                        }
                        this.enemy.takeDamage(dmg);
                        this.log(`必殺の一撃！ ${dmg}ダメージ！`);
                        this.animateEnemyDamage();
                    }
                    break;
                case 15: // 抽選回数+2
                    remaining += 2;
                    loopSafety += 2; // 安全装置も少し緩める
                    this.log("混沌が更なる混沌を呼ぶ！ 効果が2回追加！");
                    break;
                case 16: // 毒
                    this.player.addStatus('poison');
                    this.log("毒霧を吸い込んでしまった！");
                    break;
                // ▼ 変更: 脱衣判定の拡張
                case 17: 
                    // 既に脱衣状態（解放・膨張含む）の場合は膨張Lv+1
                    if (this.player.hasStatus('undressing') || this.player.isLiberated) {
                        this.log("露出した肌に魔力が過剰供給される！");
                        this.processExpansion(1);
                    } else {
                        // 通常時は強制脱衣
                        this.processForceStrip();
                    }
                    break;

                case 18: // 何も起こらない
                    {
                        let triggeredDeath = false;
                        if (this.equipment.magic_circle && this.equipment.magic_circle.passive.type === 'chaos_death_gamble') {
                            if (Math.random() < 0.10) {
                                triggeredDeath = true;
                                this.log("「終焉の魔法陣」が虚無に反応し、破滅の光を放つ……！！");
                                await wait(500);
                                
                                if (this.enemy.isBoss) {
                                    const bossDmg = Math.floor(this.enemy.maxHp * 0.5);
                                    this.enemy.takeDamage(bossDmg);
                                    this.log(`ボスに致命的な一撃！ ${bossDmg}ダメージ！`);
                                } else {
                                    this.enemy.takeDamage(99999);
                                    this.log("敵は消滅した！！(即死)");
                                }
                                this.animateEnemyDamage();
                            }
                        }
                        if (!triggeredDeath) {
                            const texts = ["……しかし、何も起こらなかった。", "不発。", "虚空を見つめた。"];
                            this.log(texts[randomInt(0, texts.length - 1)]);
                        }
                    }
                    break;
                case 19: // 防壁獲得
                    this.player.barrier = (this.player.barrier || 0) + this.player.def;
                    this.log(`咄嗟に身を守った！ 防壁+${this.player.def}`);
                    break;

                // ▼ 追加: HP全回復
                case 20: 
                    this.player.hp = this.player.maxHp;
                    this.log("混沌の恵み！ HPが全回復した！");
                    break;

                // ▼ 追加: 「ただの石」入手
                case 21: 
                    {
                        const stoneCard = CARD_DATABASE.find(c => c.id === 'stone');
                        if (stoneCard) {
                            const newCard = JSON.parse(JSON.stringify(stoneCard));
                            // モードに応じて入手先を変更
                            if (this.mode === 'rogue') {
                                this.cardPool.push(newCard);
                            } else {
                                this.tempInventory.push(newCard);
                            }
                            this.log("魔法カード「ただの石」を手に入れた！");
                        }
                    }
                    break;
            }

            this.updateStatsUI();
            
            // ループ終了判定: どちらかが死んだらbreak
            if (this.enemy.isDead() || this.player.isDead()) break;
        }

        // ▼ 追加: 敵死亡時の即時勝利判定
        if (this.enemy.isDead()) {
            await wait(500);
            this.processWin();
        }
    }

    updateCharacterSprite() {
        const imgEl = this.ui.playerImg;
        if (!imgEl) return;

        let src = FACE_IMAGES.NORMAL; // デフォルト

        // 1. 膨張状態 (最優先)
        if (this.player.expansionLevel > 0) {
            const lv = this.player.expansionLevel;
            // ▼ 修正: ファイル名の割り当てを入れ替え
            if (this.player.isLiberated) {
                src = `fairy_liberation_growth${lv}.png`;
            } else {
                src = `Fairy_undressing_growth${lv}.png`;
            }
        }
        // 2. 解放 or 脱衣状態
        else if (this.player.isLiberated || this.player.hasStatus('undressing')) {
             // 既存の脱衣差分があればここで分岐
             src = this.player.isLiberated ? "Fairy_liberated.png" : "Fairy_stripped.png"; 
             // ※既存ファイル名に合わせて調整してください
        }
        // 3. 通常 (updatePlayerExpressionでHPに応じた表情がセットされるため、ここではベース画像があればセット)
        // ただし、updatePlayerExpressionが毎フレーム呼ばれるわけではない場合、ここでセットが必要
        // ここでは updatePlayerExpression に任せるか、強制的に上書きするか。
        // 膨張時は専用画像を使うため、ここでセットして updatePlayerExpression 側で上書きされないように制御が必要かも知れない
        
        if (this.player.expansionLevel > 0) imgEl.src = src;
    }

    /**
     * 強制脱衣処理 (Magic Overload Strip)
     * 魔法の暴走や副作用により、強制的に脱衣状態にする
     */
    processForceStrip() {
        // すでに脱衣状態なら何もしない
        if (this.player.hasStatus('undressing') || (this.player.isLiberated)) {
            return null;
        }

        // 脱衣状態を付与 (永続扱い)
        this.player.addStatus('undressing', 99); // 永続扱いで付与
        
        // 演出テキストのランダム抽選
        const patterns = [
            // パターン1: 暴発 (Burst)
            {
                log: "制御しきれない魔力が体内から噴き出し、衝撃で衣服が弾け飛んだ！",
                reaction: "あ……っ！ 魔力が、体の中から溢れて……服が、耐えられなかったみたい……。はぁ、熱い……。"
            },
            
            // パターン2: 溶解 (Melt)
            {
                log: "詠唱の熱が衣服に伝導する……。服が熱を帯びてドロドロに溶け落ちてしまった！",
                reaction: "んくっ……。服が、溶けて……肌にまとわりついて……。熱いです、ヌルヌルして……気持ち悪い……。"
            },
            
            // パターン3: 透過 (Phase)
            {
                log: "魔力との同調率が高まり、肉体が一時的に霊体化した！ 実体を失った服だけが、ヒラリと床に落ちる。",
                reaction: "あれ……？ 私、服をすり抜けちゃった……？ まるで脱皮したみたい……風が、直接当たってスースーします……。"
            },
            
            // パターン4: 自然 (Nature)
            {
                log: "漏れ出た魔力に反応し、魔法のツタが急成長！ 妖精の体を愛でるように衣服を剥ぎ取ってしまった！",
                reaction: "ひゃうっ！ ツタさん、どこに入って……だ、ダメです！ 服を持っていかないでぇ……っ！"
            },
            
            // パターン5: 意思 (Alive)
            {
                log: "魔法の副作用で衣服に仮初めの命が宿った！ ひとりでに紐が解け、重力に従ってズルリと滑り落ちていく……。",
                reaction: "えっ、嘘……勝手に、解けてる……？ 待って、落ちないで……！ ……あぁ、全部見えちゃいました……。"
            },

            // パターン6: 蒸発 (Vaporize) - 光の粒子になる
            {
                log: "高密度の魔力干渉により、装備していた衣服が一瞬で光の粒子となって霧散した！",
                reaction: "……え？ 今、パァンって……。うそ、私、一瞬で裸ん坊に……？ 魔力酔いで、頭がクラクラします……。"
            },

            // パターン7: 内側からの熱 (Internal Heat) - 我慢できずに自分で（半自動）
            {
                log: "副作用で体温が急上昇！ 耐え難い熱さに、無意識のうちに自ら服を引き裂いてしまった！",
                reaction: "はぁ、はぁ……熱い、熱いよぉ……。ダメ、着てられない……。……はっ！ 私、自分で破っちゃった……！？"
            }
        ];

        // ランダム抽選
        const selected = patterns[Math.floor(Math.random() * patterns.length)];

        // ログ出力 (ナレーション)
        this.log(selected.log);
        
        // ログ出力 (妖精のリアクション)
        // ※セリフであることが分かるように鉤括弧で囲んで表示
        this.log(`「${selected.reaction}」`); 

        // 呼び出し元で必要であればテキストを返す
        return selected.log;
    }

showFairySpring() {
        const overlay = document.getElementById('spring-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            
            // ▼▼▼ 追加: オーバーレイ内のボタンを強制的に有効化する ▼▼▼
            const buttons = overlay.querySelectorAll('button');
            buttons.forEach(btn => {
                // "知恵を授かる"ボタン(id: btn-get-wisdom)は updateSpringUI で制御するので除外
                if (btn.id !== 'btn-get-wisdom') {
                    btn.disabled = false;
                    btn.style.opacity = 1.0;
                }
            });
            // ▲▲▲ 追加ここまで ▲▲▲

            this.updateSpringUI();
        }
    }
// 妖精の泉を閉じる
    closeSpring() {
        const overlay = document.getElementById('spring-overlay');
        
        // 1. 即座に画面を閉じる
        if (overlay) {
            overlay.style.display = 'none';
        }

        // 2. セーブ処理を非同期（少し遅れて実行）にする
        // これにより、重い処理が走ってもUIの「閉じる」動作が妨げられない
        setTimeout(() => {
            try {
                this.saveGame(); 
            } catch (e) {
                console.error("closeSpring: Save failed", e);
            }
        }, 50); // 50ミリ秒後に実行
    }

updateSpringUI() {
        // --- 知恵ボタンの更新 ---
        const btnWisdom = document.getElementById('btn-get-wisdom');
        const msgWisdom = document.getElementById('spring-wisdom-msg');
        
        if (btnWisdom && msgWisdom) {
            if (this.canReceiveWisdom) {
                btnWisdom.disabled = false;
                btnWisdom.style.opacity = 1.0;
                msgWisdom.textContent = "冒険の成果により、新たな知識が得られそうです。";
            } else {
                btnWisdom.disabled = true;
                btnWisdom.style.opacity = 0.5;
                msgWisdom.textContent = "深い階層(10F以上)から帰還すると、知識が得られます。";
            }
        }

        // --- 変性ステータスの表示 ---
        const shrinkSpan = document.getElementById('spring-shrink-val');
        const expansionSpan = document.getElementById('spring-expansion-val');

        // 現在値の再取得 (確実に最新の値を表示するため)
        const curShrink = (typeof this.player.shrinkLevel === 'number') ? this.player.shrinkLevel : 0;
        const curExp = (typeof this.player.expansionLevel === 'number') ? this.player.expansionLevel : 0;
        
        const minShrink = this.getMinShrinkLevel();
        const maxShrink = 3;
        
        const minExp = this.getMinExpansionLevel();
        const maxExp = 3; // 手動上限

        // 縮小UI更新
        if (shrinkSpan) {
            shrinkSpan.textContent = `Lv${curShrink}`;
            
            const btnMinus = document.getElementById('btn-shrink-minus');
            const btnPlus = document.getElementById('btn-shrink-plus');
            if (btnMinus) {
                btnMinus.disabled = (curShrink <= minShrink);
                btnMinus.style.opacity = (curShrink <= minShrink) ? 0.3 : 1.0;
            }
            if (btnPlus) {
                btnPlus.disabled = (curShrink >= maxShrink);
                btnPlus.style.opacity = (curShrink >= maxShrink) ? 0.3 : 1.0;
            }
        }

        // 膨張UI更新
        if (expansionSpan) {
            expansionSpan.textContent = `Lv${curExp}`;
            
            const btnMinus = document.getElementById('btn-expansion-minus');
            const btnPlus = document.getElementById('btn-expansion-plus');
            if (btnMinus) {
                btnMinus.disabled = (curExp <= minExp);
                btnMinus.style.opacity = (curExp <= minExp) ? 0.3 : 1.0;
            }
            if (btnPlus) {
                btnPlus.disabled = (curExp >= maxExp);
                btnPlus.style.opacity = (curExp >= maxExp) ? 0.3 : 1.0;
            }
        }
    }
    
    // 機能1: 知恵を授かる
    triggerSpringWisdom() {
        if (!this.canReceiveWisdom) return;

        // ランダムな魔法カード(合成専用などを除く)を1枚取得
        const candidates = CARD_DATABASE.filter(c => 
            !c.isSynthesisOnly && c.type !== 'passive' && c.type !== 'none' && c.type !== 'misc'
        );
        const card = candidates[Math.floor(Math.random() * candidates.length)];

        // 入手処理 (インベントリへ)
        const newCard = JSON.parse(JSON.stringify(card));
        this.permInventory.push(newCard);

        this.log(`妖精の泉から『${newCard.name}』を授かった！`);
        this.showToast(`魔法カード『${newCard.name}』を獲得！`, "success");

        // フラグ消費
        this.canReceiveWisdom = false;
        this.updateSpringUI();
        this.saveGame();
    }

// 機能2: 変性の術式 (Lv変更)
// 妖精の泉でのステータス調整
adjustSpringStatus(type, delta) {
        // 現在の値を安全に取得
        const curShrink = (typeof this.player.shrinkLevel === 'number') ? this.player.shrinkLevel : 0;
        const curExp = (typeof this.player.expansionLevel === 'number') ? this.player.expansionLevel : 0;

        if (type === 'shrink') {
            // ▼ 追加: 反転のピアス効果
            const acc = this.equipment.accessory;
            const isConvert = acc && acc.id === 'acc_click_convert' && 
                              (this.player.hasStatus('undressing') || this.player.isLiberated || this.player.expansionLevel > 0);

            if (isConvert && delta > 0) {
                // 縮小+1 の代わりに 膨張+1
                this.adjustSpringStatus('expansion', 1);
                this.showToast("反転のピアス：縮小効果が反転した！", "system");
                return; // 縮小処理は行わない
            }
            
            const min = this.getMinShrinkLevel(); 
            const max = 3; 
            
            let next = curShrink + delta;
            
            // 範囲制限
            if (next < min) next = min;
            if (next > max) next = max;
            
            // 値の更新
            this.player.shrinkLevel = next;

        } else if (type === 'expansion') {
            const min = this.getMinExpansionLevel();
            const max = 3; // 手動上限はLv3
            
            let next = curExp + delta;
            
            // 範囲制限
            if (next < min) next = min;
            if (next > max) next = max;
            
            // 値の更新
            this.player.expansionLevel = next;
        }
        
        // 即座に反映
        this.recalcStats();
        this.updateSpringUI(); // ボタン・数値の表示更新
        this.updateStatsUI();  // 立ち絵やパラメータ更新
        this.saveGame();
    }
    
    /**
     * 現在の状態に基づいて、ダンジョン用フレーバーイベントの候補リストを取得する
     * @returns {Array} テキストオブジェクト({text, dialogue})の配列
     */
    getDungeonFlavorCandidates() {
        let pool = [];

        const sLv = this.player.shrinkLevel;   // 縮小Lv
        const eLv = this.player.expansionLevel; // 膨張Lv

        // ▼ 追加: 縮小(Shrink) × 膨張(Expansion) の複合状態
        if (sLv > 0 && eLv > 0) {
            // キー名生成ロジック: flavor_shrink_lv{S}_expansion_lv{E}
            const key = `flavor_shrink_lv${sLv}_expansion_lv${eLv}`;
            
            if (FLAVOR_EVENT_DATA_MIXED[key]) {
                pool = pool.concat(FLAVOR_EVENT_DATA_MIXED[key]);
            } else {
                // 万が一該当キーがない場合は、汎用の縮小or膨張テキストを混ぜる（安全策）
                pool = pool.concat(FLAVOR_EVENT_DATA.flavor_shrink_general_positive);
                pool = pool.concat(FLAVOR_EVENT_DATA.flavor_expansion_general_positive);
            }
            
            // 複合状態のときは、これだけでリターンしても良いし、他と混ぜても良い。
            // ここでは「特殊状態」感を出すため、複合テキストのみを返す（poolがあれば）
            if (pool.length > 0) return pool;
        }
        
        // ▼ 以下、既存のロジック (優先度: 膨張 > 解放 > 縮小 > 通常)

        // A. 膨張状態 (Expansion)
        if (eLv > 0) {
            const lv = eLv;
            
            // 汎用膨張セリフ
            pool = pool.concat(FLAVOR_EVENT_DATA.flavor_expansion_general_positive);

            if (this.player.isLiberated) {
                // 解放 + 膨張 (陶酔)
                if (lv === 1 && FLAVOR_EVENT_DATA.flavor_liberation_expansion_lv1_positive) pool = pool.concat(FLAVOR_EVENT_DATA.flavor_liberation_expansion_lv1_positive);
                if (lv === 2 && FLAVOR_EVENT_DATA.flavor_liberation_expansion_lv2_positive) pool = pool.concat(FLAVOR_EVENT_DATA.flavor_liberation_expansion_lv2_positive);
                if (lv >= 3 && FLAVOR_EVENT_DATA.flavor_liberation_expansion_lv3_positive)  pool = pool.concat(FLAVOR_EVENT_DATA.flavor_liberation_expansion_lv3_positive);
            } else if (this.player.hasStatus('undressing')) {
                // 脱衣 + 膨張 (事故/ポジティブ)
                if (lv === 1 && FLAVOR_EVENT_DATA.flavor_accident_expansion_lv1_positive) pool = pool.concat(FLAVOR_EVENT_DATA.flavor_accident_expansion_lv1_positive);
                if (lv === 2 && FLAVOR_EVENT_DATA.flavor_accident_expansion_lv2_positive) pool = pool.concat(FLAVOR_EVENT_DATA.flavor_accident_expansion_lv2_positive);
                if (lv >= 3 && FLAVOR_EVENT_DATA.flavor_accident_expansion_lv3_positive)  pool = pool.concat(FLAVOR_EVENT_DATA.flavor_accident_expansion_lv3_positive);
            }
        }
        // B. 解放状態 (Liberation) ※膨張していない時
        else if (this.player.isLiberated) {
            pool = pool.concat(FLAVOR_EVENT_DATA.flavor_liberation_stripped_positive);
        }
        // C. 縮小状態 (Shrink)
        else if (sLv > 0) {
            const lv = sLv;
            
            // 汎用縮小セリフ
            pool = pool.concat(FLAVOR_EVENT_DATA.flavor_shrink_general_positive);

            // レベル別
            if (lv === 1 && FLAVOR_EVENT_DATA.flavor_shrink_lv1_positive) pool = pool.concat(FLAVOR_EVENT_DATA.flavor_shrink_lv1_positive);
            if (lv === 2 && FLAVOR_EVENT_DATA.flavor_shrink_lv2_positive) pool = pool.concat(FLAVOR_EVENT_DATA.flavor_shrink_lv2_positive);
            if (lv >= 3 && FLAVOR_EVENT_DATA.flavor_shrink_lv3_positive)  pool = pool.concat(FLAVOR_EVENT_DATA.flavor_shrink_lv3_positive);
        }
        // D. 通常状態 (Normal)
        else {
            pool = pool.concat(FLAVOR_EVENT_DATA.flavor_normal_expansion_positive);
        }

        return pool;
    }

    // --- 妖精の独り言システム ---

    startMessageTimer() {
        if (this.messageTimer) clearInterval(this.messageTimer);
        this.messageTimer = setInterval(() => this.updateFairyMessage(), 10000); // 10秒ごと
    }

    updateFairyMessage(isManual = false) {
        if (!this.isHome) return;
        
        // ▼ ロック中は反応しない
        if (this.isClickLocked) return;

        let text = "";
        
        // --- 手動クリック処理 ---
        if (isManual) {
            // 1. カウンター処理
            this.clickStreak = (this.clickStreak || 0) + 1;
            
            // ▼▼▼ 追加: 300回通知 ▼▼▼
            if (this.clickStreak === 300) {
                this.showToast("そのくらいにしてあげませんか……？", "system"); // systemスタイル等は適宜
            }

            // ---------------------------------------------------------
            // ▼ タイマー設定: 連打が途切れたら状態をリセット
            // ---------------------------------------------------------
            if (this.clickStreakTimer) clearTimeout(this.clickStreakTimer);
            
            // ▼ タイマー発火で段階リセット処理へ
            this.clickStreakTimer = setTimeout(() => {
                this.processGradualReset();
            }, 2500);


            // 2. イベントデータ取得
            let eventData = null;
            let isLimitLoop = false;
            let isLimitBreath = false;

            // A. 150回超えのループ判定 (160, 170, 180...)
            if (this.clickStreak > 150 && this.clickStreak % 10 === 0) {
                isLimitLoop = true;
            }
            // B. 通常ステップ判定 (10, 20... 150)
            else if (typeof CLICK_EVENT_DIALOGUE !== 'undefined' && CLICK_EVENT_DIALOGUE[`count_${this.clickStreak}`]) {
                eventData = CLICK_EVENT_DIALOGUE[`count_${this.clickStreak}`];
            }
            // A. 150回超えのループ判定
            if (this.clickStreak > 150) {
                if (this.clickStreak % 10 === 0) {
                    isLimitLoop = true; // 10回ごとの長文
                } else {
                    isLimitBreath = true; // それ以外は喘ぎ
                }
            }
            // B. 通常ステップ判定
            else if (CLICK_EVENT_DIALOGUE[`count_${this.clickStreak}`]) {
                eventData = CLICK_EVENT_DIALOGUE[`count_${this.clickStreak}`];
            }

            // 3. イベント実行
            if (isLimitLoop) {
                // 打ち止めループ用セリフ
                text = this.getRandomDialogue(CLICK_EVENT_DIALOGUE.limit_loop);
                // 演出は弱めの揺れで固定
                this.ui.playerImg.classList.remove('shake', 'shake_strong'); // 重複防止
                void this.ui.playerImg.offsetWidth; // リフロー
                this.ui.playerImg.classList.add('shake');
                setTimeout(() => this.ui.playerImg.classList.remove('shake'), 200);
            }
            else if (isLimitBreath) {
                // ▼ 新規: 短い喘ぎ
                text = this.getRandomDialogue(LIMIT_BREATH_DIALOGUE);
                // 演出は控えめに
                this.ui.playerImg.classList.remove('shake', 'shake_strong');
                void this.ui.playerImg.offsetWidth;
                this.ui.playerImg.classList.add('shake');
                setTimeout(() => this.ui.playerImg.classList.remove('shake'), 200);
            } 
            else if (eventData) {
                // ▼▼▼ 先に状態を変更して立ち絵を変える (タイミング同期) ▼▼▼

                // ゲーム内イベント実行 (strip / expand)
                if (eventData.event) {
                    if (eventData.event === 'strip') {
                        // 強制脱衣 (ステータス付与のみ、ログは出さない)
                        if (!this.player.hasStatus('undressing') && !this.player.isLiberated) {
                            this.player.addStatus('undressing', 99);
                        }
                    } 
                    else if (eventData.event.startsWith('expand')) {
                        // 膨張 (Lvを加算)
                        // 通常上限(Lv3)を無視して加算する
                        if (this.player.expansionLevel < 4) {
                            this.player.expansionLevel++;
                        }
                    }
                    // ★重要: 立ち絵とUIを即座に更新
                    this.updateCharacterSprite();
                    this.updateStatsUI();
                }

                // アクション演出 (shake / shake_strong)
                if (eventData.action) {
                    this.ui.playerImg.classList.remove('shake', 'shake_strong'); // クラス削除
                    void this.ui.playerImg.offsetWidth; // 強制リフロー(再生用)
                    this.ui.playerImg.classList.add(eventData.action);
                    
                    // アニメーション終了後にクラスを外す
                    setTimeout(() => this.ui.playerImg.classList.remove(eventData.action), 500);
                }

                // セリフの決定（配列からランダム）
                text = this.getRandomDialogue(eventData.text);
            }

            // イベントセリフがある場合はそれを表示して終了（通常の会話抽選は行わない）
            if (text) {
                this.showFairyMessage(text);
                return; 
            }
            
            // イベント該当回数でなければ、低確率で通常クリックセリフへ流す(既存処理)
            // (以下、既存ロジック)
        } else {
            // 自動更新時はカウンターリセットしない（タイマーに任せる）
            // もし放置ボイスでリセットしたいならここで this.clickStreak = 0;
        }

        // --- 独り言ロジック (Idle Talk) ---
        const sLv = (typeof this.player.shrinkLevel === 'number') ? this.player.shrinkLevel : 0;
        const eLv = (typeof this.player.expansionLevel === 'number') ? this.player.expansionLevel : 0;
        const isLiberated = this.player.isLiberated; // 解放の証装備中

        // 1. 帰還直後のイベント (優先度高)
        if (!text && this.returnState) {
            // (既存の帰還ロジックを維持)
            if (this.returnState === 'defeat') {
                text = this.getRandomDialogue(FAIRY_DIALOGUE_DATA.return_defeat);
            } else if (this.returnState === 'victory') {                
                if (this.specialResultKey && FAIRY_DIALOGUE_DATA[this.specialResultKey]) {
                    text = this.getRandomDialogue(FAIRY_DIALOGUE_DATA[this.specialResultKey]);
                    this.specialResultKey = null; 
                } else 
                if (this.lastLootCount === 0) {
                    text = this.getRandomDialogue(FAIRY_DIALOGUE_DATA.return_empty);
                } else {
                    text = this.getRandomDialogue(FAIRY_DIALOGUE_DATA.return_victory);
                }
            }
            this.returnState = null;
        }
        
        // 2. 放置ボイス (AFK)
        else if (!text && Date.now() - this.lastActionTime > 120000) {
            // ▼▼▼ 修正: 放置時のセリフを膨張状態で分岐 ▼▼▼
            let afkPool = [];
            const currentExpansionLevel = this.player.expansionLevel || 0;

            // A. 膨張Lv4 (限界突破・肉の海に溺れる)
            if (currentExpansionLevel >= 4) {
                afkPool = [
                    "はぁ……っ。自分の胸なのに、抱きしめると……大きすぎて、腕が回りません。……ムニュッて潰すと、脳みそが溶けそうな快感が……。",
                    "（胸に顔を埋めて）……んーっ、ぷはぁ。甘い匂い……。自分の肉の海に溺れちゃう……。もう、息するのも忘れて……ずっとこうしてたい……。",
                    "あぁ、ダメ……。皮が薄すぎて、血管が透けて見えるくらい……。指でなぞるだけで、中身がビクビク震えて……イキっぱなしになっちゃう……。",
                    "重い、熱い、苦しい……でも、気持ちいい……。見て、先端から魔力がポタポタ垂れてる……。搾ってほしいのかな？ ねえ……。",
                    "ひぐぅ……っ！ ちょっと動いただけで、ボヨンってすごい衝撃が……！ 乳房が揺れるたびに、子宮までズンって響いて……あはぁっ♡",
                    "もう、私の顔なんて見えなくていいです……。視界全部が、ピンク色のお肉……。世界で一番幸せな、閉鎖空間……ふふっ……。"
                ];
            }
            // B. 膨張Lv3 (快楽堕ち・トランス)
            else if (currentExpansionLevel === 3) {
                afkPool = [
                    "あぁっ、んあぁっ……！ ダメ、止まらない……！ お肉が揺れるたびに、頭の芯まで痺れて……ッ、イっちゃう、またイっちゃう……！",
                    "（床に体を押し付けながら）……はぁ、はぁ……。見て、私の体……こんなに浅ましく脈打って……。もう妖精じゃなくて、ただの「快感を感じる肉袋」です……。",
                    "ひグッ、あぁ……！ 魔力が、中から突き上げて……内臓ごと犯されてるみたい……。ねえ、もう壊して……めちゃくちゃにしてください……ッ！",
                    "……んぅ。……今の、聞きました？ 私、自分の重みだけで……こんなに濡れて……。ふふ、恥ずかしいのに、体が喜んで止まりません……。",
                    "あへぇ……。もう、指一本動かせない……。体中がジンジンして……頭がトロトロで……。このまま一生、こうして喘いでいたい……。"
                ];
            }
            // C. 膨張Lv1-2 (敏感・自慰)
            else if (currentExpansionLevel > 0) {
                afkPool = [
                    "くぅっ……！ 皮膚が薄くなってて、空気が触れるだけで乳首が……っ！ ごめんなさい、我慢できなくて……自分で、触っちゃいます……。",
                    "はぁ……はぁ……。ダメです、見ないで……。お腹の奥が熱くて、疼いて……こうして自分で宥（なだ）めてないと、おかしくなりそうで……。",
                    "……んっ、ぁ。ふふ、すごいです。指がズブズブ沈んでいく……。私、全身が性感帯になっちゃったみたい……気持ちいい……。",
                    "（体を抱きしめて身悶えしながら）……んくっ。膨らんだところが擦れ合って……熱い、熱いよぉ……。ねえ、この熱、どうすれば静まりますか……？",
                    "あぁ……魔力がパンパンに詰まってて……。ちょっと撫ただけで、中から「出して」って暴れるんです……。んぅ……っ、出ちゃいそう……。"
                ];
            }
            // D. 通常時 (既存のAFKデータ)
            else {
                afkPool = FAIRY_DIALOGUE_DATA.afk || ["……（退屈そうにしている）"];
            }
            text = this.getRandomDialogue(afkPool);
        }

        // 3. 通常の抽選ループ
        else if (!text) {
            let pool = [...FAIRY_DIALOGUE_DATA.idle]; // 基本会話

            // --- A. 複合状態 (縮小 x 膨張) ---
            if (sLv > 0 && eLv > 0) {
                const mixKey = `mixed_s${sLv}_e${eLv}`;
                if (FAIRY_TALK_EXPANSION[mixKey]) {
                    // 複合状態なら、かなりの高確率でこれを喋らせるためにpoolをこれだけで上書きしてもいいが、
                    // ここではpoolに追加して比率を高める
                    pool = pool.concat(FAIRY_TALK_EXPANSION[mixKey]);
                    pool = pool.concat(FAIRY_TALK_EXPANSION[mixKey]); // 比率アップ
                }
            }

            // --- B. 膨張状態 (単体) ---
            if (eLv > 0) {
                // 解放の証装備中 -> Liberation (Positive)
                if (isLiberated) {
                    const libKey = `liberation_lv${Math.min(3, eLv)}`;
                    if (FAIRY_TALK_EXPANSION[libKey]) {
                        pool = pool.concat(FAIRY_TALK_EXPANSION[libKey]);
                    }
                } 
                // 未装備 -> Accident (Negative/Shy)
                else {
                    const accKey = `accident_lv${Math.min(3, eLv)}`;
                    if (FAIRY_TALK_EXPANSION[accKey]) {
                        pool = pool.concat(FAIRY_TALK_EXPANSION[accKey]);
                    }
                }
                
                // 治療拒否セリフも混ぜる
                if (FAIRY_TALK_EXPANSION.refuse_cure) {
                    pool = pool.concat(FAIRY_TALK_EXPANSION.refuse_cure);
                }
            }

            // --- C. 縮小状態 (単体) ---
            if (sLv > 0 && eLv === 0) { // 複合でない場合のみ
                pool = pool.concat(FAIRY_DIALOGUE_DATA.shrink_idle_universal || []);
                if (sLv === 1) pool = pool.concat(FAIRY_DIALOGUE_DATA.shrink_idle_lv1 || []);
                if (sLv === 2) pool = pool.concat(FAIRY_DIALOGUE_DATA.shrink_idle_lv2 || []);
                if (sLv === 3) pool = pool.concat(FAIRY_DIALOGUE_DATA.shrink_idle_lv3 || []);
            }

            // --- D. 装備・ステータス反応 (既存) ---
            
            // 状態異常反応
            pool = pool.concat(FAIRY_DIALOGUE_DATA.talk_poison || []);
            // ... (その他の状態異常) ...

            // 解放の証 (Liberated) 単体のセリフ (膨張していない時)
            if (isLiberated && eLv === 0) {
                // 既存の脱衣セリフなどを流用、または解放専用セリフがあれば追加
                pool = pool.concat(FAIRY_DIALOGUE_DATA.talk_stripped || []); 
            }
            // 通常脱衣 (Accident Strip)
            else if (!isLiberated && this.player.hasStatus('undressing') && eLv === 0) {
                pool = pool.concat(FAIRY_DIALOGUE_DATA.idle_stripped_home || []);
                pool = pool.concat(FAIRY_DIALOGUE_DATA.talk_stripped || []);
            }

            // High Status / Weapon Type (既存ロジック維持)
            if (this.player.atk >= this.player.int * 2.5) pool = pool.concat(FAIRY_DIALOGUE_DATA.high_atk || []);
            if (this.player.int >= this.player.atk * 2.5) pool = pool.concat(FAIRY_DIALOGUE_DATA.high_int || []);
            
            if (this.equipment.weapon) {
                const wName = this.equipment.weapon.name;
                if (wName.includes("剣") || wName.includes("斧")) pool = pool.concat(FAIRY_DIALOGUE_DATA.equip_sword || []);
                if (wName.includes("杖") || wName.includes("書")) pool = pool.concat(FAIRY_DIALOGUE_DATA.equip_wand || []);
            }

            text = this.getRandomDialogue(pool);
        }

        // 表示
        if (text) {
            this.showFairyMessage(text);
        }
    }

    stopMessageTimer() {
        if (this.messageTimer) {
            clearInterval(this.messageTimer);
            this.messageTimer = null;
        }
    }

    showFairyMessage(text) {
        // 1. 既存の吹き出しがあれば削除
        const oldBubble = document.getElementById('speech-bubble');
        if (oldBubble) oldBubble.remove();

        // 2. 新しい吹き出しを作成
        const bubble = document.createElement('div');
        bubble.id = 'speech-bubble';
        bubble.className = 'speech-bubble visible';
        bubble.innerText = text;

        // 3. body直下に追加（左パネルの制限を受けないようにする）
        document.body.appendChild(bubble);

        // 立ち絵アニメーション (Bounce)
        const playerImg = document.getElementById('player-img');
        if (playerImg) {
            // 既存のアニメーションクラスを一度削除
            playerImg.classList.remove('anim-speak');
            // 強制リフロー
            void playerImg.offsetWidth;
            // クラスを再付与
            playerImg.classList.add('anim-speak');
        }

        // 自動非表示
        setTimeout(() => {
            if (bubble && bubble.parentNode) {
                bubble.classList.remove('visible');
            }
        }, 3000);
    }

    getRandomDialogue(arr) {
        if (!arr || arr.length === 0) return "";
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // 連打終了後の段階的リセット処理
    async processGradualReset() {
        // ロック開始
        this.isClickLocked = true;
        
        // 戻る前の最大到達レベルを記録（セリフ分岐用）
        // Lv4以上なら4、それ以外は現在のレベル
        let maxReachedLv = this.player.expansionLevel || 0;
        if (maxReachedLv > 4) maxReachedLv = 4;
        
        // 通常状態(Lv0)だった場合でも、少し焦っていたならLv0用セリフを出すため記録
        // ただしclickStreakが小さすぎれば反応しないなどの調整も可（今回は単純に実行）

        // 最終的に戻るべき下限レベル
        const minExp = this.getMinExpansionLevel();

        // 段階的に戻すアニメーションループ
        while (this.player.expansionLevel > minExp) {
            await wait(500); // 0.5秒待機
            
            // レベルを1下げる
            this.player.expansionLevel--;
            
            // 立ち絵更新
            this.updateCharacterSprite();
            this.updateStatsUI();
        }

        // 脱衣状態の解除 (装備由来でなければ)
        let isEquipStrip = false;
        if (this.equipment.magic_circle && this.equipment.magic_circle.id === 'mc_lust') isEquipStrip = true;
        
        if (this.player.hasStatus('undressing') && !this.player.isLiberated && !isEquipStrip) {
            // 脱衣解除は一瞬で行う（あるいはレベル戻しループの後で）
            this.player.removeStatus('undressing');
            this.updateCharacterSprite(); // 服を着た絵に戻す
        }

        // ▼▼▼ 追加: 300回報酬ロジック ▼▼▼
        const finalStreak = this.clickStreak || 0;

        if (finalStreak >= 300) {
            // 候補アイテムを抽出
            const candidates = [
                ...ACCESSORY_EFFECTS.filter(i => i.clickReward),
                ...MAGIC_CIRCLE_DATABASE.filter(i => i.clickReward)
            ];
            
            if (candidates.length > 0) {
                const reward = candidates[Math.floor(Math.random() * candidates.length)];
                const newItem = getItemById(reward.id);
                
                this.permInventory.push(newItem);
                
                this.showToast(`隠し報酬『${newItem.name}』を手に入れた……`, "success");
                await wait(1000); // 演出待ち
            }
        }

        // カウンターリセット
        this.clickStreak = 0;

        // 完了後のセリフ再生
        // 直前まで到達していたレベルに応じて分岐
        const dialogueKey = `lv${maxReachedLv}`;
        const dialogueList = RESET_DIALOGUE[dialogueKey] || RESET_DIALOGUE['lv0'];
        const text = this.getRandomDialogue(dialogueList);
        
        this.showFairyMessage(text);

        // ロック解除
        this.isClickLocked = false;
    }
}