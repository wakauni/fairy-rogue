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
        // アクセサリーとして構築して返す
        return {
            id: master.id,
            name: master.name,
            type: 'accessory',
            passive: JSON.parse(JSON.stringify(master)),
            atk: 0, def: 0, int: 0, hp: 0, spd: 0
        };
    }

    // 4. 自動生成アイテム (gen_TYPE_TIER_SUB)
    if (itemId.startsWith('gen_')) {
        const parts = itemId.split('_');
        // parts[0]=gen, parts[1]=type, parts[2]=tierIndex, parts[3]=subtypeKey
        if (parts.length >= 4) {
            const type = parts[1];
            const tierIndex = parseInt(parts[2]);
            const subKey = parts[3];
            
            const tier = MATERIAL_TIERS[tierIndex];
            if (!tier) return null;

            let item = { id: itemId, type: type, level: (tierIndex + 1) * 5 }; // レベルは概算
            const power = tier.power;

            if (type === 'weapon') {
                const wType = WEAPON_TYPES[subKey];
                if (!wType) return null;
                item.name = `${tier.name}${wType.name}`;
                item.atk = 0; item.int = 0; item.def = 0; item.hp = 0; item.spd = 0;
                const mainVal = Math.floor(power * wType.mod);
                if (wType.stat === 'atk') item.atk = mainVal;
                if (wType.stat === 'int') item.int = mainVal;
                if (wType.stat === 'def') item.def = mainVal;
                if (wType.sub) Object.keys(wType.sub).forEach(k => item[k] = (item[k]||0) + Math.floor(power * wType.sub[k] * (k==='hp'?5:1)));
            } else if (type === 'armor') {
                const aType = ARMOR_TYPES[subKey];
                if (!aType) return null;
                item.name = `${tier.name}${aType.name}`;
                item.atk = 0; item.int = 0; item.def = 0; item.hp = 0; item.spd = 0;
                const isModObj = (typeof aType.mod === 'object');
                aType.main.forEach(k => {
                    let m = isModObj ? (aType.mod[k] || aType.mod.others || 1.0) : aType.mod;
                    item[k] = (item[k]||0) + Math.floor(power * m * (k==='hp'?5:1));
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
}
// main.js の末尾に追加
