// ゲーム開始
const game = new BattleSystem();

// セーブデータの確認とロード
window.onload = function() {
    if (localStorage.getItem('fairy_rogue_save_v1')) {
        console.log("セーブデータを検知。自動ロードを実行します。");
        if (game.loadGame()) {
            game.isSaveEnabled = true;
            console.log("ロード完了: セーブ機能を有効化しました");
            return;
        }
        // ロード失敗時はデータを削除して初期化
        localStorage.removeItem('fairy_rogue_save_v1');
    }

    // ニューゲーム開始
    console.log("ニューゲームを開始します");
    game.isSaveEnabled = true;
    game.saveGame();
};

// アイテム取得・復元用関数
// アイテム取得・復元用関数
function getItemById(itemId) {
    if (!itemId) return null;

    // 1. カードデータベース
    let master = CARD_DATABASE.find(c => c.id === itemId);
    if (master) return JSON.parse(JSON.stringify(master));

    // 2. エンドコンテンツ装備
    master = ENDGAME_ITEMS.find(i => i.id === itemId);
    if (master) return JSON.parse(JSON.stringify(master));

    // 3. アクセサリー効果 (IDが一致する場合)
    master = ACCESSORY_EFFECTS.find(e => e.id === itemId);
    if (master) {
        return {
            id: master.id,
            name: master.name,
            type: 'accessory',
            passive: JSON.parse(JSON.stringify(master)),
            atk: 0, def: 0, int: 0, hp: 0, spd: 0
        };
    }

    // 4. 自動生成アイテム (gen_TYPE_TIER_SUB... )
    if (itemId.startsWith('gen_')) {
        const parts = itemId.split('_');
        // 新ID形式: gen_TYPE_TIER_SUBTYPE_SUBKEY (length 5)
        // 旧ID形式: gen_TYPE_TIER_SUBKEY (length 4)

        if (parts.length >= 4) {
            const type = parts[1];
            const tierIndex = parseInt(parts[2]);
            
            let subType = 'bal'; // デフォルト (旧データはバランス型として扱う)
            let subKey = '';

            if (parts.length === 5) {
                // 新しい形式 (物理/魔法/バランス)
                subType = parts[3];
                subKey = parts[4];
            } else {
                // 古い形式 (互換性維持)
                subKey = parts[3];
            }
            
            // 階層データ取得
            const tierGroup = MATERIAL_TIERS[tierIndex];
            if (!tierGroup) return null;

            // サブタイプ(bal/phy/mag)のデータを取得。旧データで合わない場合はbalを使用
            const matData = tierGroup[subType] || tierGroup['bal'];
            if (!matData) return null;

            let item = { id: itemId, type: type, level: (tierIndex + 1) * 5 };
            const power = matData.power;
            const bias = matData.bias || { atk:1, def:1, int:1, spd:1 }; // バイアス値

            if (type === 'weapon') {
                const wType = WEAPON_TYPES[subKey];
                if (!wType) return null;
                
                item.name = `${matData.name}${wType.name}`;
                item.atk = 0; item.int = 0; item.def = 0; item.hp = 0; item.spd = 0;
                
                const mainVal = Math.floor(power * wType.mod);
                
                // バイアスを適用してステータス設定
                if (wType.stat === 'atk') item.atk = Math.floor(mainVal * bias.atk);
                if (wType.stat === 'int') item.int = Math.floor(mainVal * bias.int);
                if (wType.stat === 'def') item.def = Math.floor(mainVal * bias.def);
                
                if (wType.sub) {
                    Object.keys(wType.sub).forEach(k => {
                        let val = Math.floor(power * wType.sub[k]);
                        if (k === 'hp') val *= 5;
                        if (bias[k]) val = Math.floor(val * bias[k]);
                        item[k] = (item[k]||0) + val;
                    });
                }
            } else if (type === 'armor') {
                const aType = ARMOR_TYPES[subKey];
                if (!aType) return null;
                
                item.name = `${matData.name}${aType.name}`;
                item.atk = 0; item.int = 0; item.def = 0; item.hp = 0; item.spd = 0;
                
                const isModObj = (typeof aType.mod === 'object');
                aType.main.forEach(k => {
                    let m = isModObj ? (aType.mod[k] || aType.mod.others || 1.0) : aType.mod;
                    let val = Math.floor(power * m);
                    if (k === 'hp') val *= 5;
                    
                    // バイアス適用
                    if (bias[k]) val = Math.floor(val * bias[k]);
                    
                    item[k] = (item[k]||0) + val;
                });
            }
            return item;
        }
    }

    // 5. 魔法陣
    if (itemId.startsWith('mc_')) {
        let master = MAGIC_CIRCLE_DATABASE.find(m => m.id === itemId);
        if (master) {
             return {
                id: master.id,
                name: master.name,
                type: 'magic_circle',
                passive: JSON.parse(JSON.stringify(master)),
                atk: 0, def: 0, int: 0, hp: 0, spd: 0
            };
        }
    }
    return null;
}// main.js の末尾に追加
