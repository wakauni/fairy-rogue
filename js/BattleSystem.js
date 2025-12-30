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
        this.playerBaseStats = { maxHp: 100, atk: 10, def: 5, int: 15, spd: 12 }; // 装備なしの基礎ステータス
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
        document.getElementById('player-area').classList.add('interactive');

        // タイマーリセット
        this.stopMessageTimer();

        // 吹き出しの表示状態をリセット
        const bubble = document.getElementById('speech-bubble');
        if (bubble) bubble.style.display = 'block';

        // UI Cleanup: 前のシーンのボタンを消す
        this.ui.battleCommands.style.display = 'none';
        // this.ui.systemCommands.style.display = 'none'; // 右下を使うため削除（後でflexにする）

        this.player.hp = this.player.maxHp; // 全回復
        // ▼ 追加: 防壁リセット
        this.player.barrier = 0;

        this.updateStatsUI();
        this.updateDeckUI();
        
        this.menuUi.overlay.style.display = 'flex';
        this.menuUi.loot.style.display = 'none'; // 既存のリスト表示エリアは隠す

        // 表示内容の切り替えロジック
        let contentHtml = '';
        let titleText = '';

        // 条件A: 未確認の戦利品がある場合（ダンジョンからの帰還直後）
        if (this.tempInventory.length > 0) {
            titleText = "探索から帰還しました！今回の戦利品です";
            this.returnState = 'victory'; // 勝利帰還フラグ

            contentHtml += `<div class="loot-list" style="display:block; max-height:250px; margin-bottom:10px;">`;
            contentHtml += this.tempInventory.map(item => 
                (item.cost !== undefined) 
                ? `<div class="loot-item">🃏 ${item.name} <small>${item.desc}</small></div>`
                : `<div class="loot-item">✨ ${item.name} <small>${this.getItemStatsString(item)}</small></div>`
            ).join('');
            contentHtml += `</div>`;
            contentHtml += `<div style="font-size:14px; color:#f1c40f;">アイテムは倉庫に移動されました。</div>`;

            // 戦利品を確定（Permanent Inventoryへ移動）してクリア
            this.tempInventory.forEach(item => {
                if (item.cost !== undefined) {
                    this.cardPool.push(item);
                } else {
                    this.permInventory.push(item);
                }
            });
            this.tempInventory = [];
        } else {
            // 条件B: 通常時（初回起動、戦利品なし帰還、編成画面からの戻りなど）
            titleText = "妖精の森（拠点）";
            // コンテンツエリアは空でも良いが、何か表示したい場合はここに追加
            contentHtml += `<div style="font-size:14px; color:#ccc; margin-top:10px;">準備を整えて、ダンジョンへ出発しましょう。</div>`;
        }

        this.menuUi.title.textContent = titleText;
        this.menuUi.content.innerHTML = contentHtml;
        
        // 中央ボタンのクリア
        this.menuUi.buttons.innerHTML = '';

        // 右下コマンドエリアの構築
        this.ui.systemCommands.style.display = 'flex';
        this.ui.systemCommands.innerHTML = ''; // クリア

        const actions = [
            { text: "探索開始", onClick: () => this.startDungeon() }
        ];
        
        // 試練の洞窟（ローグライク）ボタン
        actions.push({ text: "試練の洞窟へ", onClick: () => this.confirmStartRogueMode() });

        // 所持品または装備がある場合は最強装備ボタンを表示 (Shortcut)
        if (this.permInventory.length > 0 || this.equipment.weapon || this.equipment.armor || this.equipment.accessory || this.equipment.magic_circle) {
            actions.push({ text: "最強装備", onClick: () => this.equipBestGear() });
        }

        // 編成ボタン
        actions.push({ text: "編成", onClick: () => this.openManagement() });

        // 冒険譚ボタン
        actions.push({ text: "冒険譚", onClick: () => this.showAdventureLog() });

        this.renderSystemButtons(actions);

        // 妖精のメッセージ更新開始
        this.updateFairyMessage();
        this.startMessageTimer();
        this.saveGame(); // 拠点セーブ
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
            this.permInventory.push(rewardItem);
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

    // ステータス再計算
    recalcStats() {
        // ▼ 追加: 解放の証フラグの更新 (Unit側で参照するため)
        this.player.isLiberated = (this.equipment.accessory && this.equipment.accessory.isLiberationProof);
        let addAtk = 0;
        let addMaxHp = 0;
        let addDef = 0;
        let addInt = 0;
        let addSpd = 0;
        let buffDef = 0; // バフによるDEF加算分（脱衣後も残る）
        let maxMinShrinkLevel = 0; // 装備による縮小下限レベルの最大値
        let statMultipliers = { atk: 1.0, def: 1.0, int: 1.0, spd: 1.0, hp: 1.0 }; // 乗算補正

        // ▼ 追加: 魔法陣ブースト判定 (魔法陣ループの前に定義)
        let mcBoostRate = 1.0;
        if (this.equipment.accessory && this.equipment.accessory.passive && this.equipment.accessory.passive.type === 'mc_booster') {
            mcBoostRate = 2.0; // 上昇量を2倍にする
        }
        // ▼ 追加: 手札上限ボーナス用変数
        this.handLimitBonus = 0;

        // 1. 装備補正
        Object.values(this.equipment).forEach(item => {
            if (item) {
                addAtk += (item.atk || 0);
                addDef += (item.def || 0);
                addInt += (item.int || 0);
                addMaxHp += (item.hp || 0);
                addSpd += (item.spd || 0);

                // [拡張] 装備パッシブ (ENDGAME_ITEMS)
                if (item.stats) { // ENDGAME_ITEMS形式の固定値加算
                    if (item.stats.atk) addAtk += item.stats.atk;
                    if (item.stats.def) addDef += item.stats.def;
                    if (item.stats.int) addInt += item.stats.int;
                    if (item.stats.hp) addMaxHp += item.stats.hp;
                    if (item.stats.spd) addSpd += item.stats.spd;
                }
                if (item.passive) {
                    if (item.passive.handSizeMod) this.handLimitBonus += item.passive.handSizeMod;
                    if (item.passive.type === 'hand_size_up') this.handLimitBonus += item.passive.value;
                    if (item.passive.minShrinkLevel) maxMinShrinkLevel = Math.max(maxMinShrinkLevel, item.passive.minShrinkLevel);
                    if (item.passive.statMultiplier) {
                        if (item.passive.statMultiplier.atk) statMultipliers.atk *= item.passive.statMultiplier.atk;
                        if (item.passive.statMultiplier.def) statMultipliers.def *= item.passive.statMultiplier.def;
                        if (item.passive.statMultiplier.int) statMultipliers.int *= item.passive.statMultiplier.int;
                        if (item.passive.statMultiplier.spd) statMultipliers.spd *= item.passive.statMultiplier.spd;
                    }
                }

                // magic_circleの場合の処理を追加
                if (item && item.type === 'magic_circle') {
                    const mc = item.passive; // MAGIC_CIRCLE_DATABASEの定義

                    // 小人の留め針(pin_small)チェック
                    const hasPin = this.equipment.accessory && this.equipment.accessory.id.startsWith('pin_small');
                    if (mc.type === 'shrink_int' && hasPin) {
                        // 留め針がある場合、この魔法陣の効果は無効化される
                        return;
                    }
                    
                    if (mc.stats) {
                        if (mc.stats.hpMult !== undefined) statMultipliers.hp *= mc.stats.hpMult;
                        if (mc.stats.defMult !== undefined) statMultipliers.def *= mc.stats.defMult;
                    }

                    // ステータス倍率適用
                    if (mc.type === 'stat_mult') {
                        const effectiveValue = 1 + (mc.value - 1) * mcBoostRate;
                        if (mc.stat === 'hp') statMultipliers.hp *= effectiveValue;
                        if (mc.stat === 'atk') statMultipliers.atk *= effectiveValue;
                        if (mc.stat === 'def') statMultipliers.def *= effectiveValue;
                        if (mc.stat === 'int') statMultipliers.int *= effectiveValue;
                        if (mc.stat === 'spd') statMultipliers.spd *= effectiveValue;
                    }
                    // 縮小・INT
                    if (mc.type === 'shrink_int') {
                        statMultipliers.int *= mc.intMult;
                        maxMinShrinkLevel = Math.max(maxMinShrinkLevel, mc.minLevel);
                    }
                    // 武器シナジー (ステータス分)
                    if (mc.type === 'weapon_synergy' && this.equipment.weapon && this.equipment.weapon.name.includes(mc.wType)) {
                        if (mc.stats) {
                            if (mc.stats.atkMult) statMultipliers.atk *= mc.stats.atkMult;
                            if (mc.stats.intMult) statMultipliers.int *= mc.stats.intMult;
                            if (mc.stats.defMult) statMultipliers.def *= mc.stats.defMult;
                            if (mc.stats.hpMult) statMultipliers.hp *= mc.stats.hpMult;
                            if (mc.stats.evasionAdd) { /* 回避率は別途管理が必要 */ }
                        }
                    }
                    // 裸シナジー
                    if (mc.type === 'naked_synergy') {
                        if (!this.equipment.weapon && !this.equipment.armor) {
                            if (mc.mode === 'offensive') { statMultipliers.atk *= 2.0; statMultipliers.int *= 2.0; }
                            if (mc.mode === 'defensive') { statMultipliers.def *= 2.0; statMultipliers.hp *= 2.0; }
                        }
                    }
                    // 孤高シナジー
                    if (mc.type === 'solo_synergy') {
                        if (!this.equipment.weapon && !this.equipment.armor && !this.equipment.accessory) {
                            statMultipliers.hp *= 3.0; // +200% = 3倍
                            statMultipliers.int *= 3.0;
                            statMultipliers.atk = 0; // -100%
                            statMultipliers.def = 0;
                            // 手札上限+1, 状態異常無効は別途処理
                        }
                    }
                    // 代償 (HP半減)
                    if (mc.type === 'trade_off_regen') {
                        statMultipliers.hp *= mc.hpMult;
                    }
                }

                // --- アクセサリーの処理 (追加) ---
                if (item.type === 'accessory' && item.passive) {
                    const p = item.passive;
                    const weaponName = this.equipment.weapon ? this.equipment.weapon.name : '';
                    const armorName = this.equipment.armor ? this.equipment.armor.name : '';

                    if (p.type === 'chaos_healer') {
                        this.handLimitBonus = (this.handLimitBonus || 0) - 3;
                    }

                    // 武器シナジー (ステータス系)
                    if (p.type === 'weapon_syn_stat' && weaponName.includes(p.wType)) {
                        if (p.stat === 'def') statMultipliers.def *= p.val;
                        if (p.stat === 'atk') statMultipliers.atk *= p.val;
                        if (p.stat === 'int') statMultipliers.int *= p.val;
                    }
                    // 杖シナジー (HP + 手札)
                    if (p.type === 'weapon_syn_wand' && weaponName.includes(p.wType)) {
                        statMultipliers.hp *= 1.2;
                        this.handLimitBonus += 1; // 後で startPlayerTurn で使用
                    }

                    // 防具シナジー
                    if (p.type === 'armor_syn_heavy' && armorName.includes(p.aType)) {
                        statMultipliers.hp *= 1.2;
                        statMultipliers.def *= 1.2;
                    }
                    if (p.type === 'armor_syn_robe' && armorName.includes(p.aType)) {
                        statMultipliers.def *= 1.2;
                        statMultipliers.spd *= 1.2;
                    }
                }
            }
        });

        // 2. デッキボーナス判定
        // A. ユニークボーナス (Technician Style): 重複なし
        const cardIds = this.masterDeck.map(c => c.id);
        const isUnique = cardIds.length > 0 && new Set(cardIds).size === cardIds.length;
        
        // B. 枚数ボーナス (Heavy Deck Style): 24枚以上
        const isHeavy = this.masterDeck.length >= 24;

        this.activeBonuses = { unique: isUnique, heavy: isHeavy };

        // 3. パッシブカード補正
        this.masterDeck.forEach(card => {
            if (card.type === 'passive' && card.passiveStats) {
                if (card.passiveStats.maxHp) addMaxHp += card.passiveStats.maxHp;
                if (card.passiveStats.def) addDef += card.passiveStats.def;
                if (card.passiveStats.atk) addAtk += card.passiveStats.atk;
                if (card.passiveStats.int) addInt += card.passiveStats.int;
            }
        });

        // 3.5. 戦闘中の一時ステータス補正 (マナ縮小など)
        if (this.player.battleStatsMod) {
            addInt += this.player.battleStatsMod.int || 0;
        }
        // [拡張] ダンジョンボーナス
        if (this.player.dungeonBonus) {
            addAtk += this.player.dungeonBonus.atk || 0;
            addInt += this.player.dungeonBonus.int || 0;
        }
        
        // [修正] バフによる固定値補正の加算 (基礎ステータス計算前に行う)
        this.player.buffs.forEach(buff => {
            let isActive = true;
            if (buff.condition && buff.condition.status) {
                if (!this.player.currentStatus || this.player.currentStatus.id !== buff.condition.status) {
                    isActive = false;
                }
            }
            if (isActive && buff.buffStats) {
                if (buff.buffStats.def) buffDef += buff.buffStats.def; // バフ分は分離
                if (buff.buffStats.atk) addAtk += buff.buffStats.atk;
                if (buff.buffStats.int) addInt += buff.buffStats.int;
                if (buff.buffStats.hp) addMaxHp += buff.buffStats.hp;
            }
        });

        // 基礎ステータス更新 (INTを先に計算)
        let totalInt = this.playerBaseStats.int + addInt;
        let totalAtk = this.playerBaseStats.atk + addAtk;
        let totalDef = this.playerBaseStats.def + addDef;
        let totalMaxHp = this.playerBaseStats.maxHp + addMaxHp;
        let totalSpd = this.playerBaseStats.spd + addSpd;

        // バフによるSPD補正
        this.player.buffs.forEach(buff => {
            let isActive = true;
            if (buff.condition && buff.condition.status) {
                if (!this.player.currentStatus || this.player.currentStatus.id !== buff.condition.status) {
                    isActive = false;
                }
            }
            if (isActive && buff.buffStats && buff.buffStats.spd) {
                totalSpd += buff.buffStats.spd;
            }
        });

        // [修正] デッキボーナス (倍率適用)
        if (isUnique) {
            totalInt = Math.floor(totalInt * 1.2); // Technician: INT +20%
        }
        if (isHeavy) {
            totalDef = Math.floor(totalDef * 1.2); // Heavy: DEF +20%
        }

        // [拡張] デッキ内パッシブ (In-Deck Passives)
        this.masterDeck.forEach(card => {
            if (card.deckStatBonus) {
                if (card.deckStatBonus.intRate) totalInt = Math.floor(totalInt * (1 + card.deckStatBonus.intRate));
                if (card.deckStatBonus.atkRate) totalAtk = Math.floor(totalAtk * (1 + card.deckStatBonus.atkRate));
            }
        });

        // アクセサリーのパッシブ効果（ステータス倍率）
        if (this.equipment.accessory && this.equipment.accessory.passive) {
            const p = this.equipment.accessory.passive;
            if (p.type === 'stat_mod_restriction') {
                if (p.stat === 'int') totalInt = Math.floor(totalInt * p.multiplier);
                if (p.stat === 'atk') totalAtk = Math.floor(totalAtk * p.multiplier);
            } else if (p.type === 'risk_stat_boost') {
                if (p.multipliers.atk) totalAtk = Math.floor(totalAtk * p.multipliers.atk);
                if (p.multipliers.int) totalInt = Math.floor(totalInt * p.multipliers.int);
            } else if (p.type === 'conditional_boost') {
                if (this.player.currentStatus?.id === 'fear') totalInt = Math.floor(totalInt * 1.5);
                if (this.player.currentStatus?.id === 'distraction') totalAtk = Math.floor(totalAtk * 1.5);
            } else if (p.type === 'shrink_lock') {
                // 縮小レベル固定
                if (this.player.shrinkLevel < p.minLevel) {
                    this.player.shrinkLevel = p.minLevel;
                    maxMinShrinkLevel = Math.max(maxMinShrinkLevel, p.minLevel);
                    // 立ち絵更新が必要なため、UI更新をトリガーしたいが、
                    // ここは計算中なのでフラグ管理か、updateStatsUIで再確認する
                }
                // ステータス倍率 (縮小ペナルティ計算前に適用するか後にするか。
                // ここでは「基礎値に乗算」として扱うため、縮小ペナルティの影響を受ける)
                if (p.stats.int) totalInt = Math.floor(totalInt * p.stats.int);
                if (p.stats.atk) totalAtk = Math.floor(totalAtk * p.stats.atk);
                
                maxMinShrinkLevel = Math.max(maxMinShrinkLevel, p.minLevel);
            } else if (p.type === 'stat_mult') {
                if (p.stat === 'hp') totalMaxHp = Math.floor(totalMaxHp * p.value);
                if (p.stat === 'atk') totalAtk = Math.floor(totalAtk * p.value);
                if (p.stat === 'def') totalDef = Math.floor(totalDef * p.value);
                if (p.stat === 'int') totalInt = Math.floor(totalInt * p.value);
            }
        }

        // [拡張] 汎用ステータス倍率適用 (ENDGAME_ITEMS)
        totalAtk = Math.floor(totalAtk * statMultipliers.atk);
        totalDef = Math.floor(totalDef * statMultipliers.def);
        totalInt = Math.floor(totalInt * statMultipliers.int);
        totalSpd = Math.floor(totalSpd * statMultipliers.spd);
        totalMaxHp = Math.floor(totalMaxHp * statMultipliers.hp);
        
        // [拡張] 解放の証 (Proof of Liberation)
        if (this.equipment.accessory && this.equipment.accessory.isLiberationProof) {
            totalInt = Math.floor(totalInt * 1.5);
            totalSpd = Math.floor(totalSpd * 1.5);
            // DEFは後で0にする
        }

        // 脱衣 (Undressing) - バフ加算前に適用
        if (this.player.currentStatus && this.player.currentStatus.id === 'undressing') {
            totalDef = 0;
        }
        // [拡張] 解放の証 (常時脱衣扱い)
        if (this.equipment.accessory && this.equipment.accessory.isLiberationProof) {
            totalDef = 0;
        }

        // 最終ステータス確定
        this.player.int = totalInt;

        // 4. バフ補正 (INT依存のスケール値のみここで計算)
        let buffAtkScaled = 0;
        this.player.buffs.forEach(buff => {
            let isActive = true;
            if (buff.condition && buff.condition.status) {
                if (!this.player.currentStatus || this.player.currentStatus.id !== buff.condition.status) {
                    isActive = false;
                }
            }
            if (isActive && buff.buffStats && buff.buffStats.atkScale) {
                buffAtkScaled += Math.floor(this.player.int * buff.buffStats.atkScale);
            }
        });

        this.player.atk = totalAtk + buffAtkScaled;
        this.player.def = totalDef + buffDef + (this.player.battleStatsMod.def || 0); // バフ分を加算
        this.player.maxHp = totalMaxHp;
        this.player.spd = totalSpd + (this.player.battleStatsMod.spd || 0);

        // --- 縮小レベルの整合性チェック ---
        // 装備による下限(maxMinShrinkLevel)と、呪い等による下限(player.minShrinkLevel)の大きい方を採用
        const effectiveMin = Math.max(this.player.minShrinkLevel, maxMinShrinkLevel);

        // 1. 下限チェック（常に適用）
        // 現在のレベルが下限より小さいなら、強制的に引き上げる
        if (this.player.shrinkLevel < effectiveMin) {
            this.player.shrinkLevel = effectiveMin;
        }
        // 2. 解除チェック（拠点のみ適用）
        // 拠点にいるなら、装備を外して下限が下がった時に、縮小レベルも下げる（元に戻す）
        else if (this.isHome && this.player.shrinkLevel > effectiveMin) {
            this.player.shrinkLevel = effectiveMin;
        }

        // --- 状態異常による補正 ---
        // 縮小化 (Shrink)
        // ※ shrink_lockアイテムがある場合、上で強制的にレベルが上がっている
        // ここでペナルティ計算を行う
        
        // 縮小ペナルティ適用
        if (this.player.shrinkLevel === 1) {
            this.player.atk = Math.floor(this.player.atk * SHRINK_STATS.LV1.atk);
            this.player.spd = Math.floor(this.player.spd * SHRINK_STATS.LV1.spdMult);
        } else if (this.player.shrinkLevel === 2) {
            this.player.atk = Math.floor(this.player.atk * SHRINK_STATS.LV2.atk);
            this.player.spd = Math.floor(this.player.spd * SHRINK_STATS.LV2.spdMult);
        } else if (this.player.shrinkLevel === 3) {
            this.player.atk = Math.floor(this.player.atk * SHRINK_STATS.LV3.atk);
            this.player.spd = Math.floor(this.player.spd * SHRINK_STATS.LV3.spdMult);
        }

        // HPが最大値を超えていたら調整（装備変更時など）
        // [修正] HP全回復バグ防止: maxHpを超えた分だけカットし、回復はさせない
        if (this.player.hp > this.player.maxHp) this.player.hp = this.player.maxHp;

        // UI更新
        this.updateStatsUI();
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
        const slots = [
            { id: 'weapon', label: '武器 (Weapon)' },
            { id: 'armor', label: '防具 (Armor)' },
            { id: 'accessory', label: '装飾 (Accessory)' },
            { id: 'magic_circle', label: '魔法陣 (Circle)' }
        ];

        let leftHtml = `<h3>現在の装備</h3>`;
        
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
    goNextFloor() {
        this.depth++;
        this.player.runStats.maxFloor = this.depth; // [Stats] 到達階層更新
        
        // ローグライクモードならハイスコア更新
        if (this.mode === 'rogue' && this.depth > this.rogueHighScore) {
            this.rogueHighScore = this.depth;
        }
        
        // UIリセット（戦闘モードへ）
        this.ui.systemCommands.style.display = 'none';
        this.ui.battleCommands.style.display = 'flex';
        this.menuUi.overlay.style.display = 'none'; // メニューを閉じる

        // イベント発生判定 (20%)
        if (Math.random() < 0.2) {
            this.processEvent();
            return;
        }
        
        // 敵生成（階層に応じて強化）
        const scale = 1 + (this.depth * 0.1); // 1階層ごとに10%強化
        const isBoss = (this.depth % 5 === 0); // 5階層ごとにボス
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

        this.log(`=== 地下 ${this.depth} 階 ===`);
        this.log(`${this.enemy.name} が現れた！`);
        
        // 開幕効果
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
            ...DUNGEON_EVENT_DATA.flavor_normal
        ];

        if (this.player.shrinkLevel >= 1) {
            candidatePool.push(...DUNGEON_EVENT_DATA.event_small_hole);
            candidatePool.push(...DUNGEON_EVENT_DATA.flavor_shrink);
        }
        if (this.player.shrinkLevel >= 2) {
            candidatePool.push(...DUNGEON_EVENT_DATA.event_shrink_penalty);
        }
        if (this.player.hasStatus('undressing') || (this.equipment.accessory && this.equipment.accessory.isLiberationProof)) {
            candidatePool.push(...DUNGEON_EVENT_DATA.event_stripped_penalty);
            candidatePool.push(...DUNGEON_EVENT_DATA.flavor_stripped);
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
        this.log("宝箱を発見した！");
        
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
        
        // 戦闘コマンドを隠してシステムコマンドを表示
        this.ui.battleCommands.style.display = 'none';
        this.ui.systemCommands.style.display = 'flex';
        
        this.showWinMenu(true, loot, "TREASURE");
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

    // UI更新関連
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
        
        // 色変化
        if (pct < 30) this.ui.hpBar.style.backgroundColor = '#e74c3c';
        else this.ui.hpBar.style.backgroundColor = '#2ecc71';

        // 立ち絵の表情差分更新
        this.updatePlayerExpression(pct);

        // ヘッダーのステータス数値更新
        if (this.ui.statAtk) this.ui.statAtk.textContent = this.player.atk;
        
        if (this.ui.statDef) {
            this.ui.statDef.textContent = this.player.def;
            // Heavy Bonus時は緑色
            this.ui.statDef.style.color = this.activeBonuses.heavy ? '#2ecc71' : 'inherit';
            this.ui.statDef.style.fontWeight = this.activeBonuses.heavy ? 'bold' : 'normal';
        }

        if (this.ui.statInt) {
            this.ui.statInt.textContent = this.player.int;
            // Unique Bonus時は青色
            this.ui.statInt.style.color = this.activeBonuses.unique ? '#3498db' : 'inherit';
            this.ui.statInt.style.fontWeight = this.activeBonuses.unique ? 'bold' : 'normal';
        }

        // SPD表示更新
        if (this.ui.statSpd) this.ui.statSpd.textContent = this.player.spd;

        // フロア表示の更新
        const floorEl = document.getElementById('floor-display');
        if (floorEl) {
            if (this.isHome) {
                floorEl.textContent = "Home";
            } else {
                let text = `Floor: ${this.depth}`;
                if (this.mode === 'rogue') {
                    text += ` (Best: ${this.rogueHighScore})`;
                }
                floorEl.textContent = text;
            }
        }

        // ステータスアイコンの表示
        const statusEl = document.getElementById('status-icon');
        if (statusEl) {
            let statusText = '';
            let statusClass = '';

            // 優先度1: 縮小 (これは解放中でもかかる)
            if (this.player.shrinkLevel > 0) {
                statusText = `縮小 Lv${this.player.shrinkLevel}`;
                statusClass = 'status-shrink';
            }
            // 優先度2: 通常の状態異常
            else if (this.player.currentStatus) {
                statusText = this.player.currentStatus.name;
                statusClass = `status-${this.player.currentStatus.id}`;
            }
            // ▼ 追加: 解放の証による「脱衣」表示
            else if (this.player.isLiberated) {
                statusText = '脱衣(解放)';
                statusClass = 'status-undressing';
            }

            statusEl.textContent = statusText;
            statusEl.className = `status-badge ${statusClass}`;
            statusEl.style.display = statusText ? 'inline-block' : 'none';
        }
    }

    // HP残量に応じて立ち絵の見た目を変える
    updatePlayerExpression(hpPct) {
        if (!this.ui.playerImg) return; // 要素が存在しない場合は中断

        let imageName = "";
        const isLiberated = this.equipment.accessory && this.equipment.accessory.isLiberationProof;
        const safePct = (typeof hpPct === 'number') ? hpPct : 100;

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
    }

    updateDeckUI() {
        this.ui.deckCount.textContent = this.deck.drawPile.length;
        this.ui.discardCount.textContent = this.deck.discardPile.length;
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
        this.ui.cardList.innerHTML = '';
        this.deck.hand.forEach((card, index) => {
            const el = document.createElement('div');
            el.className = 'card-item';
            el.innerHTML = `<span>${card.name}</span> <small>${card.desc}</small>`;
            el.onclick = () => this.playerUseCard(index);
            this.ui.cardList.appendChild(el);
        });
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
                    this.showWinMenu(false); // 逃走はドロップなしでリザルトへ
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
        this.deck.reset();
        this.updateDeckUI();
        this.ui.cardList.innerHTML = ''; // 手札表示をクリア

        // 戦闘終了時の状態異常リカバリー (縮小以外を解除)
        this.player.currentStatus = null;
        this.updateStatsUI();
        this.player.buffs = []; // バフ全解除
        // ▼ 追加: 防壁の持ち越しペナルティ (50%に減衰) ▼
        if (this.player.barrier > 0) {
            this.player.barrier = Math.floor(this.player.barrier * 0.5);
        }
        // ▲ 追加ここまで ▲

        // 戦闘用一時ステータスのリセット
        this.player.battleStatsMod = { atk: 0, def: 0, int: 0, spd: 0 };
        this.player.weaponCharge = false;
        this.player.dropQualityBonus = 0;

        // ▼ 追加: 混沌の報酬フラグをリセット
        this.chaosRewardCard = false; // 追加カード獲得フラグ
        this.chaosLootMod = 0;        // ドロップ補正値加算
    }

    processWin() {
        this.log("敵を撃破した！");
        this.cleanupBattle(); // デッキ等のリセット
        
        // ドロップ生成
        // ▼ 追加: 混沌の効果による追加カード報酬
        if (this.chaosRewardCard) {
            const randomCard = CARD_DATABASE[Math.floor(Math.random() * CARD_DATABASE.length)];
            if (randomCard) {
                // コピーを作成して追加
                const newCard = JSON.parse(JSON.stringify(randomCard));
                this.permInventory.push(newCard);
                this.log(`混沌の報酬: カード『${newCard.name}』を獲得！`);
            }
        }

        const loot = this.generateLoot();

        // 魔法陣: 階層スキップ
        if (this.equipment.magic_circle && this.equipment.magic_circle.passive.type === 'win_skip_floor') {
            if (Math.random() < 0.1) {
                this.depth++;
                this.log("魔法陣が輝き、階層が転移した！");
            }
        }

        // [修正] ローグライクモードなら即時入手
        if (this.mode === 'rogue') {
            if (loot.cost !== undefined) {
                this.cardPool.push(loot); // カードの場合
            } else {
                this.permInventory.push(loot); // 装備の場合
            }
        } else {
            this.tempInventory.push(loot);
        }

        // [専用ルールB] ボス撃破ボーナス
        if (this.enemy.isBoss && this.mode === 'rogue') {
            this.restCount++;
            this.showToast("ボス撃破ボーナス！ 休憩回数が増えました！", "success");
        }
        this.saveGame(); // 勝利時セーブ
        
        this.showWinMenu(true, loot);
    }

    // ドロップ生成ロジック
    generateLoot() {
        // ドロップ率の重み付け初期値
        let weights = { weapon: 35, armor: 35, accessory: 15, magic_circle: 15 };

        // 魔法陣によるレート補正
        if (this.equipment.magic_circle) {
            const mc = this.equipment.magic_circle.passive;
            if (mc.type === 'drop_rate_mod') {
                // 対象の重みを大幅に増やす (+50)
                if (weights[mc.target]) weights[mc.target] += 50;
            }
            // カード化 (20%)
            if (mc.type === 'win_card_loot' && Math.random() < mc.chance) {
                const card = CARD_DATABASE[Math.floor(Math.random() * CARD_DATABASE.length)];
                card.cost = 0; // 念のため
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

        // [調整] ローグライクモードかつ浅層(30階未満)では「小人の留め針」を出さない
        // generateLoot内でアイテムIDを直接指定して生成するわけではないが、
        // accessory生成時にフィルタリングが必要。
        // 現在のロジックでは ACCESSORY_EFFECTS からランダムに選んでいるため、
        // 候補リストを作成する段階でフィルタリングを行う。

        let item = { type: type, level: this.depth };

        // 素材ランクの決定
        // 深度に応じてTierを選択 (簡易マッピング)
        // 幸運の星(dropQualityBonus)があれば深度を加算して判定
        const effectiveDepth = this.depth + (this.player.dropQualityBonus || 0);
        let tierIndex = 0;
        if (effectiveDepth >= 50) tierIndex = 5;
        else if (effectiveDepth >= 30) tierIndex = 4;
        else if (effectiveDepth >= 20) tierIndex = 3;
        else if (effectiveDepth >= 10) tierIndex = 2;
        else if (effectiveDepth >= 5) tierIndex = 1;
        
        const tier = MATERIAL_TIERS[tierIndex];
        const power = tier.power;

        if (type === 'weapon') {
            // 武器種別をランダム選択
            const wKeys = Object.keys(WEAPON_TYPES);
            const wKey = wKeys[Math.floor(Math.random() * wKeys.length)];
            const wType = WEAPON_TYPES[wKey];
            
            item.id = `gen_weapon_${tierIndex}_${wKey}`; // ID付与
            item.name = `${tier.name}${wType.name}`;
            item.atk = 0; item.int = 0; item.def = 0; item.hp = 0; item.spd = 0;

            // メインステータス計算
            const mainVal = Math.floor(power * wType.mod);
            if (wType.stat === 'atk') item.atk = mainVal;
            if (wType.stat === 'int') item.int = mainVal;
            if (wType.stat === 'def') item.def = mainVal;

            // サブステータス計算
            if (wType.sub) {
                Object.keys(wType.sub).forEach(key => {
                    // 1 Power = 1 Stat (HPは5倍)
                    let val = Math.floor(power * wType.sub[key]);
                    if (key === 'hp') val = Math.floor(power * wType.sub[key] * 5);
                    item[key] = (item[key] || 0) + val;
                });
            }
        } 
        else if (type === 'armor') {
            // 防具種別をランダム選択
            const aKeys = Object.keys(ARMOR_TYPES);
            const aKey = aKeys[Math.floor(Math.random() * aKeys.length)];
            const aType = ARMOR_TYPES[aKey];

            item.id = `gen_armor_${tierIndex}_${aKey}`; // ID付与
            item.name = `${tier.name}${aType.name}`;
            item.atk = 0; item.int = 0; item.def = 0; item.hp = 0; item.spd = 0;

            // ステータス計算
            // modがオブジェクトか数値かで分岐
            const isModObj = (typeof aType.mod === 'object');
            
            aType.main.forEach(statKey => {
                let multiplier = isModObj ? (aType.mod[statKey] || aType.mod.others || 1.0) : aType.mod;
                let val = Math.floor(power * multiplier);
                if (statKey === 'hp') val *= 5; // HPは係数5倍
                item[statKey] = (item[statKey] || 0) + val;
            });
        } 
        else if (type === 'accessory') {
            // ランダムでパッシブ効果を選択
            let candidates = ACCESSORY_EFFECTS;
            
            // [調整] ドロップ制限
            if (this.mode === 'rogue' && this.depth < 30) {
                candidates = candidates.filter(e => !e.id.startsWith('pin_small'));
            }

            const effect = candidates[randomInt(0, candidates.length - 1)];
            item.id = effect.id; // アクセサリーは効果IDを使用
            item.name = effect.name;
            item.passive = effect;
            item.atk = 0;
            item.int = 0;
            item.def = 0;
            item.hp = 0;
            item.spd = 0;
        } else if (type === 'magic_circle') {
            const effect = MAGIC_CIRCLE_DATABASE[Math.floor(Math.random() * MAGIC_CIRCLE_DATABASE.length)];
            item.id = effect.id;
            item.name = effect.name;
            item.passive = effect;
            // 魔法陣は基本ステータス0
            item.atk=0; item.def=0; item.int=0; item.hp=0; item.spd=0;
        }

        // 強化値 (+X) システム
        let plusVal = 0;
        if (this.mode === 'rogue') {
            // [専用ルールC] ローグライクモードの計算式
            const base = Math.floor(this.depth / 10);
            const variance = Math.floor(Math.random() * 7) - 3; // -3 ~ +3
            plusVal = base + variance;
            if (plusVal < 0) plusVal = 0;
        } else {
            // 通常モード
            plusVal = Math.floor(this.depth / 3);
        }

        // 鍛冶の魔法陣 (補正値+1)
        if (this.equipment.magic_circle && this.equipment.magic_circle.passive.type === 'loot_plus_mod') {
            plusVal += 1;
        }

        // ▼ 追加: 混沌の効果による補正値加算
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

        // 安全策: IDが設定されなかった場合のフォールバック
        if (!item.id) {
            console.error("生成されたアイテムにIDがありません！", item);
            // 緊急回避: ランダムなユニークIDを付与するか、強制的にエラーを防ぐ
            item.id = `fallback_${type}_${Date.now()}`;
        }

        return item;
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

            if (this.equipment.accessory && this.equipment.accessory.passive.type === 'chaos_healer') {
                const healVal = Math.floor(this.player.maxHp * 0.2);
                this.player.heal(healVal);
            }

            // 効果テーブル (重み付けなしの等確率なら配列からランダム)
            const roll = randomInt(1, 19);
            
            // this.log(`[混沌] 効果発動 (${remaining + 1}回残り)...`);

            switch (roll) {
                case 1: // ATK+100% (3T)
                    this.player.addBuff({ type: 'stat_up', buffStats: { atkScale: 1.0 }, duration: 3, name: '混沌の怪力', desc: 'ATK+100%' });
                    this.log("混沌の怪力！(ATK+100%)");
                    break;
                case 2: // DEF+100% (3T)
                    this.player.addBuff({ type: 'stat_up', buffStats: { def: this.player.def }, duration: 3, name: '混沌の硬化', desc: 'DEF+100%' });
                    this.log("混沌の硬化！(DEF+100%)");
                    break;
                case 3: // INT+100% (3T)
                    this.player.addBuff({ type: 'stat_up', buffStats: { intScale: 1.0 }, duration: 3, name: '混沌の知性', desc: 'INT+100%' });
                    this.log("混沌の知性！(INT+100%)");
                    break;
                case 4: // SPD+100% (3T)
                    this.player.addBuff({ type: 'stat_up', buffStats: { spd: this.player.spd }, duration: 3, name: '混沌の加速', desc: 'SPD+100%' });
                    this.log("混沌の加速！(SPD+100%)");
                    break;
                case 5: // 回避+30% (3T)
                    this.player.addBuff({ type: 'evasion_up', val: 30, duration: 3, name: '混沌の幻影', desc: '回避率+30%' });
                    this.log("混沌の幻影！(回避+30%)");
                    break;
                case 6: // ATKランダムダメージ (0.5~3.0倍)
                    {
                        const rate = (randomInt(50, 300) / 100);
                        const dmg = Math.floor(this.player.atk * rate);
                        this.enemy.takeDamage(dmg);
                        this.log(`デタラメな物理攻撃！ ${dmg}ダメージ`);
                        this.animateEnemyDamage();
                    }
                    break;
                case 7: // INTランダムダメージ (0.5~3.0倍)
                    {
                        const rate = (randomInt(50, 300) / 100);
                        const dmg = Math.floor(this.player.int * rate);
                        this.enemy.takeDamage(dmg);
                        this.log(`制御不能な魔力弾！ ${dmg}ダメージ`);
                        this.animateEnemyDamage();
                    }
                    break;
                case 8: // 固定1ダメージ (ランダムテキスト)
                    {
                        const texts = ["小石につまづいて敵にぶつかった！", "デコピンがヒット！", "威嚇したら敵が少しビビった！", "投げキッスが直撃！"];
                        this.enemy.takeDamage(1);
                        this.log(`${texts[randomInt(0, texts.length - 1)]}`);
                        this.animateEnemyDamage();
                    }
                    break;
                case 9: // 自傷50%
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
                case 10: // 勝利時カード獲得
                    this.chaosRewardCard = true;
                    this.log("空間が歪み、新たなカードの気配がする…");
                    break;
                case 11: // 勝利時装備補正+1
                    this.chaosLootMod = (this.chaosLootMod || 0) + 1;
                    this.log("運命が書き換わり、財宝の質が高まった気がする…");
                    break;
                case 12: // 縮小化+3 (ランダムテキスト)
                    {
                        const texts = ["体が急激に縮んでいく！", "視界が巨大化した！？ いや、私が小さくなったのか！", "まるで人形のようなサイズに！"];
                        this.log(texts[randomInt(0, texts.length - 1)]);
                        this.player.shrinkLevel = Math.min(3, this.player.shrinkLevel + 3);
                    }
                    break;
                case 13: // 通常攻撃 (回数反映)
                    {
                        this.log("体が勝手に動き出し、武器を振るった！");
                        let hitCount = 1;
                        if (this.equipment.accessory && this.equipment.accessory.passive && this.equipment.accessory.passive.type === 'weapon_syn_cannon') hitCount += 2;
                        if (this.equipment.magic_circle && this.equipment.magic_circle.passive && this.equipment.magic_circle.passive.type === 'status_attack_plus' && this.player.currentStatus) hitCount += 1;
                        const multiHitBuff = this.player.buffs.find(b => b.type === 'multi_hit');
                        if (multiHitBuff) hitCount += 2;

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
                case 14: // 武器必殺技
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
                case 17: // 脱衣 (ランダムテキスト)
                    this.processForceStrip();
                    break;
                case 18: // 何も起こらない (ランダムテキスト)
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
            }

            this.updateStatsUI();
            if (this.enemy.isDead() || this.player.isDead()) break;
        }
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

    // --- 妖精の独り言システム ---

    startMessageTimer() {
        if (this.messageTimer) clearInterval(this.messageTimer);
        this.messageTimer = setInterval(() => this.updateFairyMessage(), 10000); // 10秒ごと
    }

    stopMessageTimer() {
        if (this.messageTimer) {
            clearInterval(this.messageTimer);
            this.messageTimer = null;
        }
    }

    updateFairyMessage(isManual = false) {
        // 【修正】拠点以外では絶対に喋らせない
        if (!this.isHome) return;

        let text = "";

        // --- 手動クリックの場合 (Manual) ---
        if (isManual) {
            this.clickStreak++;

            // ▼▼▼ 修正: 50%の確率で「タッチ反応」を採用。残りの50%は何もせず下の「雑談」へ流す ▼▼▼
            if (Math.random() < 0.5) {
                
                // 1. 現在の状態から、使用するセリフリストを決定
                let targetData = null;
                
                // 優先度: 脱衣 > 縮小 > 通常
                if (this.player.hasStatus('undressing') || (this.equipment.accessory && this.equipment.accessory.isLiberationProof)) {
                    targetData = FAIRY_DIALOGUE_DATA.touch_stripped;
                } else if (this.player.shrinkLevel === 3) {
                    targetData = FAIRY_DIALOGUE_DATA.touch_shrink_3;
                } else if (this.player.shrinkLevel === 2) {
                    targetData = FAIRY_DIALOGUE_DATA.touch_shrink_2;
                } else if (this.player.shrinkLevel === 1) {
                    targetData = FAIRY_DIALOGUE_DATA.touch_shrink_1;
                } else {
                    targetData = FAIRY_DIALOGUE_DATA.touch_normal;
                }

                // データがない場合のフォールバック
                if (!targetData) {
                    targetData = { lv1: FAIRY_DIALOGUE_DATA.idle };
                }

                // 2. 連打回数に応じたセリフの選択
                let targetList = [];
                if (this.clickStreak <= 3) {
                    targetList = targetData.lv1 || targetData.lv1;
                } else if (this.clickStreak <= 8) {
                    targetList = targetData.lv2 || targetData.lv1;
                } else {
                    targetList = targetData.lv3 || targetData.lv1;
                }

                text = this.getRandomDialogue(targetList);
            }
            // ▲▲▲ 修正ここまで (50%でtextが空のままとなり、下の雑談ロジックが実行される) ▲▲▲
            
        } else {
            this.clickStreak = 0; // 自動更新時は連打リセット
        }

        // 1. Return Event (帰還直後)
        if (!text && this.returnState) {
            if (this.returnState === 'defeat') {
                text = this.getRandomDialogue(FAIRY_DIALOGUE_DATA.return_defeat);
            } else if (this.returnState === 'victory') {                
                // 特殊リザルトがある場合は優先
                if (this.specialResultKey && FAIRY_DIALOGUE_DATA[this.specialResultKey]) {
                    text = this.getRandomDialogue(FAIRY_DIALOGUE_DATA[this.specialResultKey]);
                    this.specialResultKey = null; // 一度だけ表示
                } else 
                if (this.lastLootCount === 0) {
                    text = this.getRandomDialogue(FAIRY_DIALOGUE_DATA.return_empty);
                } else {
                    text = this.getRandomDialogue(FAIRY_DIALOGUE_DATA.return_victory);
                }
            }
            this.returnState = null; // フラグ消費
        }
        // 2. AFK (放置状態)
        else if (!text && Date.now() - this.lastActionTime > 120000) {
             text = this.getRandomDialogue(FAIRY_DIALOGUE_DATA.afk);
        }
        // [New] 拠点での脱衣状態 (Stripped at Home)
        // 戦闘コマンドが表示されていない(=拠点) かつ 脱衣状態
        else if (!text && this.ui.battleCommands.style.display === 'none' && this.player.hasStatus('undressing')) {
            text = this.getRandomDialogue(FAIRY_DIALOGUE_DATA.idle_stripped_home);
        }
        // 3. Normal Loop (日常)
        else if (!text) {
            let pool = [...FAIRY_DIALOGUE_DATA.idle];
            
            // 状態異常についての雑談 (Status Ailment Talks)
            pool = pool.concat(FAIRY_DIALOGUE_DATA.talk_poison || []);
            pool = pool.concat(FAIRY_DIALOGUE_DATA.talk_confusion || []);
            pool = pool.concat(FAIRY_DIALOGUE_DATA.talk_distraction || []);
            pool = pool.concat(FAIRY_DIALOGUE_DATA.talk_fear || []);
            pool = pool.concat(FAIRY_DIALOGUE_DATA.talk_petrified || []);
            pool = pool.concat(FAIRY_DIALOGUE_DATA.talk_stripped || []);
            pool = pool.concat(FAIRY_DIALOGUE_DATA.talk_shrink_general || []);

            // High ATK (脳筋)
            if (this.player.atk >= this.player.int * 2.5) {
                pool = pool.concat(FAIRY_DIALOGUE_DATA.high_atk || []);
            }
            // High INT (魔力特化)
            if (this.player.int >= this.player.atk * 2.5) {
                pool = pool.concat(FAIRY_DIALOGUE_DATA.high_int || []);
            }

            // Weapon Type (装備種別)
            if (this.equipment.weapon) {
                const wName = this.equipment.weapon.name;
                if (wName.includes("剣") || wName.includes("斧") || wName.includes("刀")) {
                    pool = pool.concat(FAIRY_DIALOGUE_DATA.equip_sword || []);
                }
                if (wName.includes("杖") || wName.includes("書")) {
                    pool = pool.concat(FAIRY_DIALOGUE_DATA.equip_wand || []);
                }
                if (wName.includes("大盾")) {
                    pool = pool.concat(FAIRY_DIALOGUE_DATA.equip_shield || []);
                }
            }
            
            // Shrink (縮小)
            if (this.player.shrinkLevel > 0) {
                pool = pool.concat(FAIRY_DIALOGUE_DATA.shrink_idle_universal || []);
                if (this.player.shrinkLevel === 1) pool = pool.concat(FAIRY_DIALOGUE_DATA.shrink_idle_lv1 || []);
                if (this.player.shrinkLevel === 2) pool = pool.concat(FAIRY_DIALOGUE_DATA.shrink_idle_lv2 || []);
                if (this.player.shrinkLevel === 3) pool = pool.concat(FAIRY_DIALOGUE_DATA.shrink_idle_lv3 || []);
            }
            
            // Equip Hints (装備ヒント)
            if (this.equipment.accessory) {
                const hints = FAIRY_DIALOGUE_DATA.equip_hints[this.equipment.accessory.id];
                if (hints) {
                    pool = pool.concat(hints);
                }
            }
            
            text = this.getRandomDialogue(pool);
        }

        // 抽選と表示
        if (text) {
            this.showFairyMessage(text);
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
}