// ダメージ計算ヘルパー
function calculateDamage(atk, def) {
    return Math.max(1, Math.floor(atk - Math.floor(def / 2)));
}

function calculateMagicDamage(int, targetInt) {
    return Math.max(1, Math.floor(int - Math.floor(targetInt / 2)));
}

// カードの定義
const CARD_DATABASE = [
    { id: 'fire', name: 'ファイア', cost: 0, type: 'attack', power: 1.5, desc: 'INT×1.5のダメージ' },
    { id: 'thunder', name: 'サンダー', cost: 0, type: 'attack', power: 2.0, desc: 'INT×2.0の大ダメージ' },
    { id: 'heal', name: 'ヒール', cost: 0, type: 'heal', power: 20, desc: 'HPを20回復' },
    { id: 'barrier', name: 'バリア', cost: 0, type: 'buff', power: 0, desc: '次のターンまで防御力UP' },

    // --- 新規追加カード ---
    { id: 'reload', name: 'リロード', cost: 0, type: 'utility', desc: '手札を全て捨て、捨てた枚数分引き直す' },
    { id: 'drain', name: 'ドレイン', cost: 0, type: 'attack_heal', power: 1.0, healRatio: 0.5, desc: 'INT×1.0のダメージを与え、50%回復' },
    { id: 'enchant', name: '魔力充填', cost: 0, type: 'buff_turn', duration: 3, buffStats: { atkScale: 0.5 }, desc: '3ターンの間、ATKにINTの50%を加算' },
    { id: 'regen', name: '癒やしの風', cost: 0, type: 'buff_turn', duration: 3, healPerTurn: 10, desc: '3ターンの間、行動終了時にHPを10回復' },
    { id: 'disrupt', name: 'ディスラプト', cost: 0, type: 'special', costType: 'hp', costValue: 15, desc: 'HP15消費。敵の次の行動をキャンセル' },
    { id: 'snipe', name: 'スナイプ', cost: 0, type: 'attack', power: 1.2, ignoreDef: true, desc: '敵の防御力を無視してINT×1.2のダメージ' },
    { id: 'stone', name: 'ただの石', cost: 0, type: 'none', desc: '使っても何も起こらない' },
    { id: 'amulet', name: '幸運のお守り', cost: 0, type: 'passive', passiveStats: { maxHp: 20, def: 2 }, desc: 'デッキにあるだけでHP+20/DEF+2' },
    { id: 'chaos_gate', name: 'カオスゲート', cost: 0, type: 'special', desc: 'デッキ内の他のカードの効果をランダムに発動' },

    // --- 新規追加カード (特殊効果・リスク系) ---
    { id: 'venom_edge', name: 'ヴェノムエッジ', cost: 0, type: 'attack_risk', power: 1.8, riskType: 'poison', riskChance: 0.3, desc: '高威力だが、30%の確率で自分が毒になる' },
    { id: 'berserk_smash', name: '捨て身のタックル', cost: 0, type: 'attack_risk', power: 2.5, riskType: 'confusion', riskChance: 0.5, desc: '超威力だが、50%の確率で自分が混乱する' },
    { id: 'needle_rush', name: 'ニードルラッシュ', cost: 0, type: 'special_shrink', desc: '縮小状態でのみ使用可。縮小レベルが高いほど威力UP' },
    { id: 'revenge_blast', name: 'リベンジブラスト', cost: 0, type: 'attack_revenge', power: 1.0, desc: '自分が状態異常のとき、威力が2.5倍になる' },
    { id: 'cure_status', name: 'クリアハーブ', cost: 0, type: 'heal_status', target: 'status', desc: '状態異常を回復する(縮小は治せない)' },
    { id: 'cure_size', name: 'グロウポーション', cost: 0, type: 'heal_status', target: 'shrink', desc: '縮小状態を元に戻す' },
    { id: 'cure_all', name: '万能薬', cost: 0, type: 'heal_status', target: 'all', desc: '全ての状態異常と縮小を回復する' },
    { id: 'fairy_wish', name: '妖精の祈り', cost: 0, type: 'heal_int', power: 1.5, desc: 'INT×1.5 のHPを回復する' },
    { id: 'vampire_form', name: '吸血の構え', cost: 0, type: 'buff_turn', duration: 3, buffId: 'drain_attack', desc: '3ターンの間、通常攻撃でHPを吸収する' },
    { id: 'trinity_burst', name: 'トリニティバースト', cost: 0, type: 'special_poker', desc: '手札に同名のカードが3枚ある時、敵に特大ダメージ' },

    // --- 新規追加カード (必殺技・特殊系) ---
    { id: 'warp_strike', name: '次元斬', cost: 0, type: 'attack_warp', power: 1.2, desc: 'この攻撃で敵を倒すと、階層を3つスキップする' },
    { id: 'lucky_star', name: '幸運の星', cost: 0, type: 'buff_drop', desc: 'この戦闘でのドロップ品の質が向上する' },
    { id: 'iron_wall', name: '鉄壁', cost: 0, type: 'buff_turn', duration: 3, buffStats: { def: 10 }, desc: '3ターンの間、DEF+10' },
    { id: 'protection', name: 'プロテクション', cost: 0, type: 'buff_special', buffId: 'dmg_cut', duration: 3, value: 0.3, desc: '3ターンの間、被ダメージを30%軽減する' },
    { id: 'sharpness', name: '研磨', cost: 0, type: 'buff_turn', duration: 3, buffId: 'atk_bonus', desc: '3ターンの間、通常攻撃ダメージ+50%' },
    { id: 'extend_force', name: 'フォース拡張', cost: 0, type: 'utility_extend', desc: '自分にかかっている全てのバフの効果時間を3ターン延長する' },
    { id: 'charge_weapon', name: 'ウェポンチャージ', cost: 0, type: 'charge', desc: '次のターン、武器に応じた必殺技を放つ' },
    { id: 'full_burst', name: 'フルバースト', cost: 0, type: 'attack_stun', power: 4.0, desc: 'INT×4.0のダメージを与えるが、次のターン動けなくなる' },
    { id: 'shrink_surge', name: 'マナ縮小', cost: 0, type: 'utility_mana_shrink', desc: '戦闘終了までINT+50されるが、縮小化が進む' },
    { id: 'discard_smash', name: '捨て身の一撃', cost: 0, type: 'attack_discard', power: 3.0, desc: '手札をランダムに1枚捨て、INT×3.0の大ダメージ' },

    { id: 'curse_light', name: 'ウィークカース', cost: 0, type: 'magic_curse', power: 1.2, desc: '敵にINT×1.2の呪いを付与。' },
{ id: 'curse_heavy', name: 'デッドリーカース', cost: 0, type: 'magic_curse', power: 1.8, desc: '敵にINT×1.8の呪いを付与。' },
{ id: 'curse_poison', name: '毒禍の呪い', cost: 0, type: 'magic_curse_poison', power: 1.0, desc: 'INT分の呪い。毒状態なら効果増、そうでなければ自身が毒になる。' },
{ id: 'curse_deck', name: '連鎖する呪詛', cost: 0, type: 'magic_curse_deck', power: 0.1, desc: 'INT×0.1×デッキ枚数分の呪いを付与。' },
{ id: 'curse_echo', name: '怨嗟の共鳴', cost: 0, type: 'magic_curse_echo', desc: '敵の呪い値分のダメージを与える。' },
{ id: 'curse_drain', name: '吸魂の呪儀', cost: 0, type: 'magic_curse_drain', desc: '敵の呪い値分、自分のHPを回復する。' },
{ id: 'curse_burst', name: 'カタストロフィ', cost: 0, type: 'magic_curse_burst', desc: '呪い値×2倍のダメージを与え、呪いを清算する。' },
{ id: 'curse_chaos', name: '呪詛の混沌', cost: 0, type: 'magic_curse_chaos', desc: '呪い値100につき1回、混沌を招く。' },
    // --- 新規追加カード (Skill / Magic Expansion) ---
    // 1. 禁断の解放
    {
        id: 'skill_cast_off',
        name: '禁断の解放',
        type: 'skill_custom',
        cost: 0,
        desc: '自身を【脱衣】状態にし、脱衣中のみATKとINTを+50する',
        effect: (user, target) => {
            user.addStatus('undressing', 99); // IDは undressing
            user.addBuff({ 
                type: 'stat_boost', 
                buffStats: { atk: 50, int: 50 }, // buffStats形式に合わせる
                name: '解放', 
                condition: { status: 'undressing' }
            });
            return { msg: "服を脱ぎ捨て、力を解き放った！" };
        }
    },
    // 2. 決死の覚悟
    {
        id: 'skill_last_resort',
        name: '決死の覚悟',
        type: 'skill_custom',
        cost: 0,
        desc: 'HPが1になる代わりに、戦闘終了まで与ダメ2倍＆1ターン無敵を得る',
        effect: (user, target) => {
            user.hp = 1;
            user.addBuff({ type: 'dmg_boost', value: 2.0, duration: 99, name: '決死' });
            user.addBuff({ type: 'invincible', duration: 1, name: '無敵' });
            return { msg: "後がない！ 限界を超えた力を絞り出す！" };
        }
    },
    // 3. 煙玉
    {
        id: 'item_smoke_bomb',
        name: '煙玉',
        type: 'skill_custom',
        cost: 0,
        desc: '戦闘から確実に離脱する（戦利品なし / ボス無効）',
        effect: (user, target, battle) => {
            if (target.isBoss) return { msg: "ボスからは逃げられない！" };
            battle.forceEscape = true; 
            return { msg: "煙に紛れて逃げ出した！" };
        }
    },
    // 4. グラビティ
    {
        id: 'magic_gravity',
        name: 'グラビティ',
        type: 'skill_custom',
        cost: 2,
        desc: '敵の最大HPの20%分の固定ダメージを与える',
        effect: (user, target) => {
            let dmg = Math.floor(target.maxHp * 0.2);
            dmg = Math.min(dmg, 999);
            target.takeDamage(dmg, true); // 固定ダメージなので防御無視推奨
            return { msg: `重力波！ ${dmg}のダメージ！` };
        }
    },
    // 5. 幻影の構え
    {
        id: 'skill_mirage',
        name: '幻影の構え',
        type: 'skill_custom',
        cost: 1,
        desc: '3ターンの間、回避成功時にINT依存の魔法反撃を行う',
        effect: (user, target) => {
            user.counterStance = { type: 'evade', dmg: user.int, label: '幻影' };
            return { msg: "ゆらりと構えを取った。（回避反撃待機）" };
        }
    },
    // 6. 復讐の構え
    {
        id: 'skill_vengeance',
        name: '復讐の構え',
        type: 'skill_custom',
        cost: 1,
        desc: '3ターンの間、攻撃を受けた時にATK依存の物理反撃を行う',
        effect: (user, target) => {
            user.counterStance = { type: 'damage', dmg: Math.floor(user.atk * 0.8), label: '復讐' };
            return { msg: "殺気を放ち構えを取った。（被弾反撃待機）" };
        }
    },
    // 7. マナシールド
    {
        id: 'magic_barrier',
        name: 'マナシールド',
        type: 'skill_custom',
        cost: 2,
        desc: 'INT×2 の耐久値を持つ防壁を展開する',
        effect: (user, target, battle) => {
            let shieldVal = Math.floor(user.int * 2);

            // 装備による防壁補正の適用
            if (battle && battle.equipment && battle.equipment.accessory && battle.equipment.accessory.passive && battle.equipment.accessory.passive.barrierMod) {
                const mod = battle.equipment.accessory.passive.barrierMod;
                shieldVal = Math.floor(shieldVal * mod);
            }

            user.barrier = (user.barrier || 0) + shieldVal;
            return { msg: `魔力の盾を展開！（耐久: ${user.barrier}）` };
        }
    },
    // 8. ボディプレス (修正版)
    {
        id: 'body_press',
        name: 'ボディプレス',
        type: 'skill_custom',
        cost: 2,
        desc: '自身のDEF依存の物理大ダメージを与える。防御力が低いと失敗する。',
        effect: (user, target, battle) => {
            // 1. 現状のステータスを取得
            let calcDef = user.def;
            const isStripped = user.hasStatus('undressing');
            const weapon = battle.equipment.weapon;
            // 武器が「盾」かどうか判定（名前判定 または 武器種判定）
            const hasShield = weapon && (weapon.name.includes('盾') || weapon.name.includes('Shield'));

            // 2. 脱衣状態の分岐処理
            if (isStripped) {
                if (hasShield) {
                    // 【例外】盾を持っている場合、失われたDEFの代わりに「盾の性能」を適用する
                    // user.defは0になっているため、武器データの生の数値を参照
                    calcDef = (weapon.def || 0) + user.def; // バフ分(user.def)も一応足しておく
                } else {
                    // 盾がなく、バフによるDEF上昇もない(=0)場合
                    if (calcDef <= 0) {
                        return { msg: "勢いよく飛び込んだが、柔らかい肌が むにゅっ と当たっただけだった……。(ダメージなし)" };
                    }
                }
            }

            // 3. ダメージ計算 (DEF x 2.5倍 と仮定)
            let val = Math.floor(calcDef * 2.5);
            target.takeDamage(val);
            
            if (hasShield && isStripped) return { msg: `全体重を乗せたシールドプレス！ ${val}のダメージ！` };
            return { msg: `重量級のボディプレス！ ${val}のダメージ！` };
        }
    },
    // 9. ソウルキャノン
    {
        id: 'magic_soul_cannon',
        name: 'ソウルキャノン',
        type: 'skill_custom',
        cost: 3,
        desc: '敵にINT依存の大ダメージを与える',
        effect: (user, target) => {
            let dmg = Math.max(1, Math.floor(user.int * 2.5) - Math.floor(target.int / 2)); // 魔法防御(INT/2)
            target.takeDamage(dmg);
            return { msg: `純粋な魔力の奔流！ ${dmg}のダメージ！` };
        }
    },
    // 10. 妖精の呪い
    {
        id: 'magic_cursed_growth',
        name: '妖精の呪い',
        type: 'skill_custom',
        cost: 0,
        desc: 'この探索中、INT+10を得るが、縮小化の下限が1段階上がる',
        effect: (user, target) => {
            if (user.minShrinkLevel >= 3) return { msg: "これ以上は呪えない……（不発）" };
            
            user.minShrinkLevel++;
            if (!user.dungeonBonus) user.dungeonBonus = { atk: 0, int: 0 };
            user.dungeonBonus.int += 10;
            
            if (user.shrinkLevel < user.minShrinkLevel) {
                 user.shrinkLevel = user.minShrinkLevel;
            }
            return { msg: "体が疼く……！ 強力な魔力を得たが、体が戻りにくくなった！" };
        }
    },
    // 11. 石の型
    {
        id: 'skill_stone_form',
        name: '石の型',
        type: 'skill_custom',
        cost: 1,
        desc: '自身を【石化】状態にし、石化中のみDEFを+100する',
        effect: (user, target) => {
            user.addStatus('petrification');
            user.addBuff({ 
                type: 'stat_boost', 
                buffStats: { def: 100 }, 
                name: '石化防御', 
                condition: { status: 'petrification' }
            });
            return { msg: "皮膚が岩のように硬化した！" };
        }
    },
    // 12. ピュージバースト
    {
        id: 'magic_purge',
        name: 'ピュージバースト',
        type: 'skill_custom',
        cost: 2,
        desc: '自身の状態異常を解除し、解除に成功した場合、敵に大ダメージを与える',
        effect: (user, target) => {
            // ▼ 修正: currentStatusがなくても、脱衣(解放の証含む)ならOKとする
            const isStripped = user.hasStatus('undressing');
            if (!user.currentStatus && !isStripped) {
                return { msg: "解除する状態異常がない！（不発）" };
            }
            
            // ソース名の決定
            let statusId = user.currentStatus ? user.currentStatus.id : (isStripped ? 'undressing' : '');
            let sourceName = "穢れ"; // デフォルト

            if (statusId === 'poison') sourceName = "体内の猛毒";
            else if (statusId === 'confusion') sourceName = "思考の混沌";
            else if (statusId === 'distraction') sourceName = "心の雑念";
            else if (statusId === 'fear') sourceName = "凍える恐怖";
            else if (statusId === 'petrification') sourceName = "石化の呪い";
            else if (statusId === 'undressing') sourceName = "溢れる羞恥心";

            // 解除処理 (解放の証装備中は、これを呼んでも脱衣状態は維持される仕様を利用)
            user.clearAllStatus();

            let dmg = Math.max(1, Math.floor(user.int * 2.0) - Math.floor(target.int / 2));
            target.takeDamage(dmg);
            
            return { msg: `${sourceName}を魔力に変換して撃ち出した！ ${dmg}のダメージ！` };
        }
    },
    // 13. リバウンドサイズ
    {
        id: 'magic_rebound',
        name: 'リバウンドサイズ',
        type: 'skill_custom',
        cost: 3,
        desc: '縮小化を解除し、解除したレベルに応じた固定大ダメージを与える',
        effect: (user, target, battle) => {
            // 1. 現在の縮小レベルチェック
            if (user.shrinkLevel <= 0) {
                return { msg: "縮小化していないため、効果がない！（不発）" };
            }

            // ▼ 追加: 装備による「下限レベル」のチェック ▼
            let limitLevel = 0;
            
            // アクセサリーの確認 (小人の留め針など)
            if (battle.equipment.accessory && battle.equipment.accessory.passive && battle.equipment.accessory.passive.minLevel) {
                limitLevel = Math.max(limitLevel, battle.equipment.accessory.passive.minLevel);
            }
            
            // 魔法陣の確認 (小人の魔法陣など)
            if (battle.equipment.magic_circle && battle.equipment.magic_circle.passive && battle.equipment.magic_circle.passive.minLevel) {
                limitLevel = Math.max(limitLevel, battle.equipment.magic_circle.passive.minLevel);
            }

            // 現在のレベルが下限以下なら、解除不可能なので失敗
            if (user.shrinkLevel <= limitLevel) {
                return { msg: "装備の呪いにより、元のサイズに戻れない！（発動失敗）" };
            }
            // ▲ 追加ここまで ▲
            // ▼ 修正: レベルに応じたダメージ計算 (指数関数的に強化) ▼
            let level = user.shrinkLevel;
            let baseDmg = 0;
            let scaleMsg = "";

            if (level === 1) {
                baseDmg = 80;
                scaleMsg = "一気に元通り！";
            } else if (level === 2) {
                baseDmg = 200;
                scaleMsg = "弾けるように巨大化！";
            } else if (level >= 3) {
                baseDmg = 500; // Lv3は特大ダメージ
                scaleMsg = "限界圧縮からの爆発的解放！";
            }

            // INT補正も加える (INT * 1.5)
            let dmg = baseDmg + Math.floor(user.int * 1.5);

            // 3. 縮小解除
            user.shrinkLevel = 0;
            target.takeDamage(dmg);
            return { msg: `${scaleMsg} 衝撃波で ${dmg} のダメージ！` };
        }
    },

    // --- 新規追加カード (Additional Cards) ---
    // 1. 裸の王様
    {
        id: 'skill_naked_king', name: '裸の王様', type: 'skill_custom', cost: 1,
        desc: '【脱衣限定】戦闘終了までDEF+100。脱衣でない場合は脱衣状態になるのみ',
        effect: (user, target, battle) => {
            if (!user.hasStatus('undressing')) {
                battle.processForceStrip();
                return { msg: "（効果不発）" };
            }
            user.addBuff({ type: 'stat_boost', buffStats: { def: 100 }, name: '裸の王様', duration: 99 });
            return { msg: "堂々たる立ち姿！ 防御力が跳ね上がった！" };
        }
    },
    // 2. 恥じらいの鉄槌
    {
        id: 'skill_blushing_hammer', name: '恥じらいの鉄槌', type: 'skill_custom', cost: 2,
        desc: '【脱衣限定】ATK依存の大ダメージ。脱衣でない場合は攻撃できず脱衣になる',
        effect: (user, target, battle) => {
            if (!user.hasStatus('undressing')) { battle.processForceStrip(); return { msg: "（攻撃失敗）" }; }
            const dmg = calculateDamage(user.atk * 2.5, target.def);
            target.takeDamage(dmg);
            return { msg: `羞恥心を力に変えた一撃！ ${dmg}ダメージ！` };
        }
    },
    // 3. 自然の癒し
    {
        id: 'magic_nature_heal', name: '自然の癒し', type: 'skill_custom', cost: 2,
        desc: '【脱衣限定】HPを大きく回復。脱衣でない場合は回復できず脱衣になる',
        effect: (user, target, battle) => {
            if (!user.hasStatus('undressing')) { battle.processForceStrip(); return { msg: "（回復失敗）" }; }
            const heal = Math.floor(user.maxHp * 0.5);
            user.heal(heal);
            return { msg: `大自然と一体化して回復！ +${heal}HP` };
        }
    },
    // 4. スルーザウィンド
    {
        id: 'skill_through_wind', name: 'スルーザウィンド', type: 'skill_custom', cost: 1,
        desc: '【脱衣限定】次に受けるダメージを1回だけ無効化。脱衣でない場合は脱衣になるのみ',
        effect: (user, target, battle) => {
            if (!user.hasStatus('undressing')) { battle.processForceStrip(); return { msg: "（効果不発）" }; }
            user.addBuff({ type: 'invincible', duration: 1, name: '回避態勢' });
            return { msg: "風のように回避する構えをとった！" };
        }
    },
    // 5. ペーパーナイフ
    {
        id: 'magic_paper_knife', name: 'ペーパーナイフ', type: 'skill_custom', cost: 1,
        desc: 'INTダメージ。自身のDEFが低いほどダメージボーナス（脱衣時は最大）',
        effect: (user, target) => {
            let multiplier = 1.0 + Math.max(0, (20 - user.def) * 0.1);
            if (user.hasStatus('undressing')) multiplier += 1.0;
            const dmg = calculateMagicDamage(user.int * multiplier, target.int);
            target.takeDamage(dmg);
            return { msg: `防御を捨てた鋭い魔力！ ${dmg}ダメージ！` };
        }
    },
    // 例: エーテルストライク（仮称：脱衣時のみ撃てる、または撃つと脱衣する魔法）
    {
        id: 'magic_force_strip_attack', // 任意のID
        name: '解放の魔弾',
        type: 'skill_custom',
        cost: 3,
        desc: '服を脱ぎ捨て、そのエネルギーで特大ダメージを与える',
        effect: (user, target, battle) => { // 第3引数 battle が必要
            
            // ▼ 追加: 強制脱衣処理と演出テキストの取得
            // BattleSystem側のメソッドを呼び出す
            const stripText = battle.processForceStrip(); 
            
            // ダメージ計算 (脱衣状態なら威力アップなどの処理も可能)
            let dmg = Math.floor(user.int * 3.0);
            target.takeDamage(dmg);

            let msg = "";
            // 脱衣演出があった場合はメッセージに追加
            if (stripText) {
                msg += "服を代償に魔力を解放！ "; 
            } else {
                msg += "肌で感じる魔力を収束して発射！ ";
            }

            msg += `${dmg}のダメージ！`;
            return { msg: msg };
        }
    },
    // 6. 毒手
    {
        id: 'magic_poison_hand', name: '毒手', type: 'skill_custom', cost: 0,
        desc: 'INT大ダメージを与えるが、自身が【毒】になる',
        effect: (user, target) => {
            const dmg = calculateMagicDamage(user.int * 2.0, target.int);
            target.takeDamage(dmg);
            user.addStatus('poison');
            return { msg: `毒の魔力を撃ち込んだ！ ${dmg}ダメージ！ (自身も毒を受けた)` };
        }
    },
    // 7. 毒蛇の解放
    {
        id: 'skill_venom_release', name: '毒蛇の解放', type: 'skill_custom', cost: 1,
        desc: '【状態異常時限定】敵に大ダメージを与え、自身の【毒】を解除する',
        effect: (user, target) => {
            if (!user.hasStatus('poison') && !user.currentStatus) return { msg: "状態異常ではないため失敗！" };
            const dmg = calculateDamage(user.atk * 2.5, target.def);
            target.takeDamage(dmg);
            if (user.hasStatus('poison')) user.removeStatus('poison');
            return { msg: `体内の毒を攻撃に乗せて放出した！ ${dmg}ダメージ！` };
        }
    },
    // 8. 転禍為福
    {
        id: 'magic_turnaround', name: '転禍為福', type: 'skill_custom', cost: 1,
        desc: 'HPを回復する。自身が状態異常なら回復量が倍になる',
        effect: (user, target) => {
            let rate = 0.2;
            // ▼ 修正: 脱衣(解放の証)も状態異常としてカウントしてボーナスを得る
            if (user.currentStatus || user.hasStatus('undressing')) {
                rate = 0.4;
            }
            const heal = Math.floor(user.maxHp * rate);
            user.heal(heal);
            return { msg: `逆境を力に変えて回復！ +${heal}HP` };
        }
    },
    // 9. 呪いの指輪 (In-Deck)
    {
        id: 'passive_cursed_ring', name: '呪いの指輪', type: 'passive',
        desc: '【デッキ所持】ターン終了時、自身が【毒】になる（使用不可）',
        cost: 0, unplayable: true,
        onTurnEnd: (user) => { user.addStatus('poison'); return "指輪の呪いが蝕む..."; }
    },
    // 10. 魔導の重り (In-Deck)
    {
        id: 'passive_mage_weight', name: '魔導の重り', type: 'passive',
        desc: '【デッキ所持】INT+20%、ATK-20%（使用不可）',
        cost: 0, unplayable: true,
        deckStatBonus: { intRate: 0.2, atkRate: -0.2 }
    },
    // 11. 戦士の重り (In-Deck)
    {
        id: 'passive_warrior_weight', name: '戦士の重り', type: 'passive',
        desc: '【デッキ所持】ATK+20%、INT-20%（使用不可）',
        cost: 0, unplayable: true,
        deckStatBonus: { atkRate: 0.2, intRate: -0.2 }
    },
    // 12. ピンチパワー
    {
        id: 'magic_pinch_power', name: 'ピンチパワー', type: 'skill_custom', cost: 1,
        desc: 'INTダメージ。HPが減っているほど威力アップ',
        effect: (user, target) => {
            const missingHpRate = 1.0 - (user.hp / user.maxHp);
            const multiplier = 1.0 + (missingHpRate * 2.0);
            const dmg = calculateMagicDamage(user.int * multiplier, target.int);
            target.takeDamage(dmg);
            return { msg: `窮地の底力！ ${dmg}ダメージ！` };
        }
    },
    // 13. 繊細な魔弾
    {
        id: 'magic_fragile_bullet', name: '繊細な魔弾', type: 'skill_custom', cost: 2,
        desc: 'INT極大ダメージ。状態異常や縮小化中は威力が激減する',
        effect: (user, target) => {
            let multiplier = 3.5;
            if (user.currentStatus || user.shrinkLevel > 0) multiplier = 0.5;
            const dmg = calculateMagicDamage(user.int * multiplier, target.int);
            target.takeDamage(dmg);
            return { msg: `集中魔力弾！ ${dmg}ダメージ！` };
        }
    },
    // 14. 守りの光
    {
        id: 'magic_protect_light', name: '守りの光', type: 'skill_custom', cost: 2,
        desc: 'HPを回復し、INT値分の防壁を展開する',
        effect: (user, target, battle) => {
            const heal = Math.floor(user.int * 0.5);
            let barrier = Math.floor(user.int * 1.0);
            
            // 装備による防壁補正の適用
            if (battle && battle.equipment && battle.equipment.accessory && battle.equipment.accessory.passive && battle.equipment.accessory.passive.barrierMod) {
                const mod = battle.equipment.accessory.passive.barrierMod;
                barrier = Math.floor(barrier * mod);
            }

            user.heal(heal);
            user.barrier = (user.barrier || 0) + barrier;
            return { msg: `癒やしと加護の光！ HP+${heal}, 防壁+${barrier}` };
        }
    },
    // 15. シールドバッシュ
    {
        id: 'skill_shield_bash', name: 'シールドバッシュ', type: 'skill_custom', cost: 1,
        desc: '防壁の30%を消費し、消費した値の2倍の固定ダメージを与える',
        effect: (user, target) => {
            if (!user.barrier || user.barrier <= 0) return { msg: "防壁がない！（不発）" };
            const cost = Math.floor(user.barrier * 0.3);
            user.barrier -= cost;
            const dmg = cost * 2;
            target.takeDamage(dmg);
            return { msg: `防壁を衝撃に変換！ ${dmg}ダメージ！` };
        }
    },
    // 16. トリプルアタック
    {
        id: 'skill_triple_pre', name: 'トリプルアタック', type: 'skill_custom', cost: 2,
        desc: '次の「通常攻撃」が3連撃になる',
        effect: (user, target) => {
            user.addBuff({ type: 'multi_hit', count: 3, duration: 1, name: '連撃準備' });
            return { msg: "次の一撃に全てを込める構え！" };
        }
    },
    // 17. アサシネイト
    {
        id: 'skill_assassinate', name: 'アサシネイト', type: 'skill_custom', cost: 3,
        desc: 'SPD判定で即死させる。ボスは半減、100層以降無効',
        effect: (user, target, battle) => {
            if (battle.depth >= 100) return { msg: "深層の敵には通用しない！" };
            let chance = (user.spd / target.spd) * 0.5;
            if (target.isBoss) chance *= 0.5;
            if (Math.random() < chance) {
                target.hp = 0;
                return { msg: "一瞬の閃光！ 敵を仕留めた！" };
            } else {
                return { msg: "仕留めそこなった！" };
            }
        }
    },
    // 18. 神秘の欠片 (合成素材)
    {
        id: 'misc_mystery_fragment', name: '神秘の欠片', type: 'misc',
        desc: '効果なし。3枚集めて合成すると……？',
        cost: 0,
        effect: (user) => { return { msg: "ただの欠片だ。これだけでは使えない。" }; },
        synthesisResult: 'magic_miracle_light' 
    },
    // data.js の CARD_DATABASE 内に追加
{ 
    id: 'lust_barrier', 
    name: '魔性の防壁', 
    cost: 0, 
    type: 'buff_lust', 
    desc: '被ダメージ軽減。脱衣/膨張中なら膨張Lv+1、そうでなければ脱衣状態になる。' 
},
{ 
    id: 'lust_strike', 
    name: '膨張の一撃', 
    cost: 0, 
    type: 'attack_lust_atk', 
    desc: 'ATK参照ダメージ(膨張Lv+1倍)。' 
},
{ 
    id: 'lust_charm', 
    name: '豊満な誘惑', 
    cost: 0, 
    type: 'special_charm', 
    desc: '反動50%。膨張Lvに応じた確率で敵を魅了し勝利する(ボス無効)。' 
},
{ 
    id: 'lust_press', 
    name: 'タイタン・プレス', 
    cost: 0, 
    type: 'attack_heavy_press', 
    desc: 'ATK×膨張Lv×1.5の超ダメージ。次ターン行動不可。' 
},
{ 
    id: 'counter_burst', 
    name: 'カウンター・バースト', 
    cost: 0, 
    type: 'attack_vs_intent', 
    targetIntent: 'attack',
    desc: 'INT参照攻撃。敵が攻撃予定ならダメージ大幅増。' 
},
{ 
    id: 'guard_breaker', 
    name: 'ガード・ブレイカー', 
    cost: 0, 
    type: 'attack_vs_intent', 
    targetIntent: 'defend',
    desc: 'INT参照攻撃。敵が防御予定ならダメージ増＆防御解除。' 
},
    // (合成結果) ミラクルライト
    {
        id: 'magic_miracle_light', name: 'ミラクルライト', type: 'skill_custom', rarity: 'legendary',
        desc: 'HP全快、縮小解除、状態異常治癒、敵に特大ダメージ', isSynthesisOnly: true,
        cost: 0,
        effect: (user, target) => {
            user.hp = user.maxHp;
            user.shrinkLevel = 0;
            user.clearAllStatus();
            const dmg = calculateMagicDamage(user.int * 5.0, target.int);
            target.takeDamage(dmg);
            return { msg: `奇跡の光が降り注ぐ！ 完全回復＆${dmg}ダメージ！` };
        }
    }
];

// ドロップアイテムのベース定義
const BASE_ITEMS = [
    { name: '古びた剣', baseAtk: 2, baseDef: 0, type: 'weapon' },
    { name: '鉄の剣', baseAtk: 5, baseDef: 0, type: 'weapon' },
    { name: '魔法の杖', baseAtk: 3, baseDef: 1, type: 'weapon' },
    { name: '皮の盾', baseAtk: 0, baseDef: 3, type: 'armor' },
    { name: '騎士の鎧', baseAtk: 0, baseDef: 5, type: 'armor' },
    { name: '力の指輪', baseAtk: 2, baseDef: 0, type: 'accessory' },
    { name: '守りの指輪', baseAtk: 0, baseDef: 2, type: 'accessory' }
];

// 装飾品のパッシブ効果リスト
const ACCESSORY_EFFECTS = [
    {
        id: 'ring_regen',
        name: '癒やしの指輪',
        desc: '毎ターン終了時、HPを5%回復する',
        type: 'turn_end_heal',
        value: 0.05
    },
    {
        id: 'ring_wizard',
        name: '魔道の契約書',
        desc: 'INTが1.5倍になるが、通常攻撃ができなくなる',
        type: 'stat_mod_restriction',
        stat: 'int',
        multiplier: 1.5,
        restrict: 'attack' // 通常攻撃コマンドを封印
    },
    {
        id: 'ring_berserk',
        name: '狂戦士の紋章',
        desc: 'ATKが1.5倍になるが、魔法(カード)が使えなくなる',
        type: 'stat_mod_restriction',
        stat: 'atk',
        multiplier: 1.5,
        restrict: 'magic' // 魔法コマンドを封印
    },
    {
        id: 'ring_barrier',
        name: '守りの護符',
        desc: '戦闘開始時、1回分のダメージを無効化するバリアを張る',
        type: 'battle_start_buff',
        buffId: 'barrier'
    },
    // --- 新規追加アクセサリー ---
    {
        id: 'ring_unstable',
        name: '不安定な指輪',
        desc: 'ATK/INTが1.3倍になるが、ターン終了時に10%の確率で縮小化する',
        type: 'risk_stat_boost',
        multipliers: { atk: 1.3, int: 1.3 },
        riskChance: 0.1
    },
    {
        id: 'pendant_paradox',
        name: 'あべこべペンダント',
        desc: '恐怖状態でINT1.5倍、放心状態でATK1.5倍になる',
        type: 'conditional_boost'
    },
    {
        id: 'pin_small_1',
        name: '小人の留め針(Lv1)',
        desc: '縮小Lv1固定。INT1.5倍。防壁獲得量80%。',
        type: 'shrink_lock',
        minLevel: 1,
        stats: { int: 1.5 },
        barrierMod: 0.8
    },
    {
        id: 'pin_small_2',
        name: '小人の留め針(Lv2)',
        desc: '縮小Lv2固定。INT2.0倍。防壁獲得量60%。',
        type: 'shrink_lock',
        minLevel: 2,
        stats: { int: 2.0 },
        barrierMod: 0.6
    },
    {
        id: 'pin_small_3',
        name: '小人の留め針(Lv3)',
        desc: '縮小Lv3固定。INT3.0倍。防壁獲得量40%。',
        type: 'shrink_lock',
        minLevel: 3,
        stats: { int: 3.0 },
        barrierMod: 0.4
    },
    // --- 新規追加アクセサリー (Ver.2) ---
    { 
        id: 'ring_draw', name: '知識の指輪', desc: '手札の上限枚数が+1される', 
        type: 'hand_size_up', value: 1 
    },
    { 
        id: 'ring_purify', name: '清めのミサンガ', desc: 'ターン終了時、20%の確率で状態異常を回復', 
        type: 'auto_cure', chance: 0.2 
    },
    { 
        id: 'ring_giant', name: '巨人のベルト', desc: '縮小化しなくなる（無効化）', 
        type: 'immune_shrink' 
    },
    { 
        id: 'bangle_life', name: '生命の腕輪', desc: '最大HPが1.2倍になる', 
        type: 'stat_mult', stat: 'hp', value: 1.2 
    },
    { 
        id: 'bangle_power', name: '剛力の腕輪', desc: 'ATKが1.2倍になる', 
        type: 'stat_mult', stat: 'atk', value: 1.2 
    },
    { 
        id: 'bangle_guard', name: '守護の腕輪', desc: 'DEFが1.2倍になる', 
        type: 'stat_mult', stat: 'def', value: 1.2 
    },
    { 
        id: 'bangle_magic', name: '叡智の腕輪', desc: 'INTが1.2倍になる', 
        type: 'stat_mult', stat: 'int', value: 1.2 
    },    
    // --- Chaos Synergy ---
    { id: 'acc_chaos_reflector', name: '混沌の鏡', desc: '混沌抽選+3。自傷効果を敵へのダメージに反転する', type: 'chaos_reflector' },
    { id: 'acc_chaos_greedy', name: '強欲の杯', desc: '手札上限-3。混沌抽選+5。抽選毎に最大HP20%回復', type: 'chaos_healer' },
    { id: 'acc_curse_attack', name: '呪縛の篭手', type: 'accessory', desc: '通常攻撃時、ATK分の呪いを与える。', curseAtk: true },
    { id: 'acc_curse_boost', name: '増幅の魔石', type: 'accessory', desc: '呪い付与後、その現在値を1.2倍にする。', curseBoost: true },
// data.js - ACCESSORY_EFFECTS 内の該当箇所を書き換え

// data.js - 該当箇所を修正

    // 1. 色欲のペンダント
    {
        id: 'acc_lust_pendant',
        name: '色欲のペンダント',
        desc: '脱衣時のDEF0を無効化し、DEF+20%。色欲の魔法陣と共鳴し、肉体を限界(Lv4)へ導く',
        type: 'lust_pendant',
        isUnique: true, // ★追加: 通常ドロップしない
        ignoreStripPenalty: true // ★修正: フラット化(入れ子解除)
    },

    // 2. 【色欲】解放の証
    {
        id: 'acc_lust_liberation',
        name: '【色欲】解放の証',
        desc: '【解放】状態になる。INT/SPD+50%。脱衣DEF0無効。色欲の魔法陣と共鳴し、肉体を限界(Lv4)へ導く',
        type: 'lust_liberation',
        isUnique: true, // ★追加: 通常ドロップしない
        isLiberationProof: true, // ★修正: フラット化
        ignoreStripPenalty: true // ★修正: フラット化
    },
    
    // --- 膨張関連 ---
    {
        id: 'acc_balloon_guard',
        name: '風船の護符',
        desc: '膨張状態のとき、被ダメージを30%軽減する',
        type: 'expansion_dmg_cut',
        value: 0.7 // 被ダメ倍率
    },
    {
        id: 'acc_growth_striker',
        name: '巨人の指輪',
        desc: '膨張Lv×25%の確率で、通常攻撃がクリティカル(1.5倍)になる',
        type: 'expansion_crit'
    },

    // --- 戦闘開始時効果 ---
    { id: 'acc_start_charge', name: '達人の鞘', desc: '戦闘開始時、必殺技が発動可能になる', type: 'start_charge' },

    // --- 武器シナジー ---
    { id: 'acc_syn_sword', name: '剣士の腕輪', desc: '剣装備時、必殺技の威力が2倍', type: 'weapon_syn_spec', wType: '剣' },
    { id: 'acc_syn_axe', name: '剛斧のベルト', desc: '斧装備時、DEF+30%', type: 'weapon_syn_stat', wType: '斧', stat: 'def', val: 1.3 },
    { id: 'acc_syn_katana', name: '侍のハチマキ', desc: '刀装備時、ATK+30%', type: 'weapon_syn_stat', wType: '刀', stat: 'atk', val: 1.3 },
    { id: 'acc_syn_wand', name: '魔女の帽子', desc: '杖装備時、HP+20%・手札上限+1', type: 'weapon_syn_wand', wType: '杖' },
    { id: 'acc_syn_book', name: '賢者の眼鏡', desc: '書装備時、INT+30%', type: 'weapon_syn_stat', wType: '書', stat: 'int', val: 1.3 },
    { id: 'acc_syn_cannon', name: '砲撃手のゴーグル', desc: '魔導砲装備時、通常攻撃回数+2 / ダメージ-30%', type: 'weapon_syn_cannon', wType: '魔導砲' },
    { id: 'acc_syn_shield', name: '守護者の紋章', desc: '盾装備時、戦闘開始後3ターンDEF+50%', type: 'weapon_syn_shield', wType: '大盾' },

    // --- 防具シナジー ---
    { id: 'acc_syn_armor', name: '騎士の勲章', desc: '鎧装備時、HPとDEF+20%', type: 'armor_syn_heavy', aType: '鎧' },
    { id: 'acc_syn_robe', name: '魔導師のブローチ', desc: 'ローブ装備時、DEFとSPD+20%', type: 'armor_syn_robe', aType: 'ローブ' },
    { id: 'acc_syn_symbol', name: '幻影のアンクレット', desc: '紋章装備時、回避率+15%', type: 'armor_syn_symbol', aType: '紋章' },

    // --- 魔法陣シナジー ---
    { id: 'acc_mc_boost', name: '増幅の水晶', desc: 'ステータス強化魔法陣の効果を2倍にする', type: 'mc_booster' }
,
// --- 連打イベント報酬 ---
{ 
    id: 'acc_click_start', 
    name: '淫魔のチョーカー', 
    type: 'accessory', 
    desc: 'ターン開始時、脱衣状態になる(既に脱衣/膨張なら膨張Lv+1)。', 
    isUnique: true, 
    clickReward: true 
},
{ 
    id: 'acc_click_dmg', 
    name: 'マゾヒストガーター', 
    type: 'accessory', 
    desc: '被ダメージ時、脱衣状態になる(既に脱衣/膨張なら膨張Lv+1)。', 
    isUnique: true, 
    clickReward: true 
},
{ 
    id: 'acc_click_convert', 
    name: '反転のピアス', 
    type: 'accessory', 
    desc: '縮小化する際、代わりに膨張Lvが上がる(脱衣/膨張時のみ)。', 
    isUnique: true, 
    clickReward: true 
}
];

// 状態異常の種類定義
const STATUS_TYPES = {
    // --- Main Statuses (互いに上書き) ---
    POISON: { 
        id: 'poison', 
        name: '毒', 
        img: 'Fairy_poison.png', 
        desc: '行動終了時にダメージを受ける' 
    },
    CONFUSION: { 
        id: 'confusion', 
        name: '混乱', 
        img: 'Fairy_confusion.png', 
        desc: '敵の行動予測(Intent)が見えなくなる' 
    },
    DISTRACTION: { 
        id: 'distraction', 
        name: '放心', 
        img: 'Fairy_distraction.png', 
        desc: '魔法(カード)が使用不能になる' 
    },
    FEAR: { 
        id: 'fear', 
        name: '恐怖', 
        img: 'Fairy_fear.png', 
        desc: '通常攻撃が使用不能になる' 
    },
    PETRIFICATION: { 
        id: 'petrification', 
        name: '石化', 
        img: 'Fairy_petrification.png', 
        desc: '回避と逃走ができなくなる (戦闘終了まで)' 
    },
    UNDRESSING: { 
        id: 'undressing', 
        name: '脱衣', 
        img: 'Fairy_undressing.png', 
        desc: 'DEFが0になる (戦闘終了まで)' 
    },
    EXPANSION: { 
        id: 'expansion', 
        name: '膨張', 
        // 既存のアイコンがあればそれを、なければ脱衣などのアイコンを流用
        img: 'Fairy_undressing.png', 
        desc: '肉体が成長し能力が変化する。ATK増/SPD減。脱衣扱いとなり、他状態異常を無効化する。' 
    },

    // --- Special Status (別枠管理) ---
    SHRINK: { 
        id: 'shrink', 
        name: '縮小', 
        desc: 'ATKが低下、被ダメージが大幅に増加する (最大3段階)' 
    }
};

// 妖精の独り言データ
const FAIRY_DIALOGUE_DATA = {
    idle: [
        "今日も森の空気がおいしいです！ 深呼吸すると、元気が湧いてきますねっ。",
        "羽のお手入れもバッチリです。キラキラしてて、我ながら綺麗かも？",
        "ふあぁ……なんだかお腹が空いてきちゃいました。甘い花の蜜、探しに行こうかな？",
        "次はどんな場所に行けるんでしょう？ 知らない景色を見るの、ワクワクしちゃいます！",
        "ん～っ！ 伸びをすると気持ちいいですね。さあ、次はどこへ行きましょうか！",
        "あー、暇だなぁ。羽を使って空中で宙返りの練習でもしましょうか？",
        "森の奥から、不思議な鳴き声が聞こえます。……お化けじゃないですよね？",
        "今日の髪型、どうでしょう？ 冒険中もオシャレは忘れたくないのですっ。",
        "甘いものが食べたいですぅ……。帰ったらハチミツたっぷりのパンケーキが食べたいなぁ。",
        "昔、おばあちゃん妖精に聞いたんです。「迷った時は、風の吹くほうへ行け」って。",
        "人間さんの世界には、鉄の箱が走ってるって本当ですか？ 一度見てみたいなぁ。"
    ],
    return_victory: [
        "ふぅ～、無事に帰ってこられました！ やっぱりお家が一番落ち着きますねっ。",
        "見てください！ 今回はすごいお宝、たくさん見つけちゃいましたよ！ えへへ、大豊作です！",
        "あんな強い敵にも勝てちゃうなんて……私、ちょっと成長したかもです！",
        "ただいまー！ いやぁ、冒険の後の休憩って、どうしてこんなに幸せなんでしょう？"
    ],
    return_defeat: [
        "うぅ……あたた……。さすがにちょっと無茶しすぎちゃいましたね……。",
        "わーん！ 集めたアイテム、全部落としちゃいました……。また拾いに行かなくちゃ！",
        "負けちゃって悔しいです……。でも、次は負けませんよ！ 準備を整えて、リベンジですっ！",
        "めそめそ……。酷い目に遭いました。次はもっと慎重にいかないとダメですね。"
    ],
    return_empty: [
        "ただいま戻りました……。うーん、今回はめぼしいお宝、ありませんでしたね。",
        "無事に帰れたのはいいんですけど、手ぶらなのはちょっと寂しいかも……。",
        "次はもっと奥まで行ってみましょうか？ きっとすごいお宝が待ってますよ！"
    ],
    afk: [
        "……あのー、もしかして寝ちゃいました？",
        "おーい、聞こえてますかー？ 私、退屈で羽が乾いちゃいそうです……。",
        "じーっ……。動かないなら、今のうちにイタズラしちゃおうかな？",
        "ふあぁ……私も一緒にお昼寝しちゃおうかな……むにゃむにゃ。"
    ],
    high_atk: [
        "今の私なら、岩だって素手で砕けそうな気がします！ ……やりませんけどね？",
        "魔法もいいですけど、やっぱり最後は筋肉……じゃなくて、物理ですよねっ！",
        "力がみなぎってきます！ どんな敵でもドーンと吹き飛ばしちゃいましょう！"
    ],
    high_int: [
        "頭が冴え渡ってます！ 今なら、古代の魔道書だってスラスラ読めちゃいそう！",
        "指先から魔力が溢れて、ビリビリしてます……。次の魔法は、きっと凄いですごよ！",
        "ふふん、筋肉なんて飾りです。賢い妖精は、知恵と魔法で華麗に勝つんですよ。",
        "世界の理（ことわり）が、なんとなく見える気がします……。これが魔道の極意？"
    ],
    equip_sword: [
        "よいしょ……。この武器、私にはちょっと重いかな？ でも、持ってるだけで強そうです！",
        "素振りの練習ですっ！ えいっ！ やあっ！ ……ふぅ、様になってきましたか？",
        "魔法もいいけど、こうやって直接叩くのもスカッとしますね！ 物理最高です！",
        "刃の手入れは慎重に……。指を切らないように気をつけないと。"
    ],
    equip_wand: [
        "この杖の宝石、覗き込むとキラキラしてて綺麗だなぁ……うっとり。",
        "パラパラ……。魔道書のおさらいをしておきましょう。いざという時に噛んだら大変ですから！",
        "杖を振るたびに、光の粉が舞うのが好きなんです。魔法使いって感じがしますよね！",
        "精神統一……。イメージするんです、敵を吹き飛ばす最強の私を……！"
    ],
    equip_shield: [
        "これなら全身すっぽり隠れられそう。ふふ、痛いのはお断りだからね、安全第一でいこう。",
        "よいしょっと……。やっぱり少し重いかな？ でも、この厚みと重量感……すごく頼もしいかも。",
        "ふと思ったけど……この硬さなら、守るよりこれで殴ったほうが早かったりして？ ……なんてね。",
        "守りを固めると、不思議と心にも余裕ができるみたい。これなら落ち着いて戦えそう。"
    ],
    shrink_idle_universal: [
        "スプーンを持つだけで筋トレになっちゃいそうです。よいしょ、よいしょ……。",
        "草の陰に入ると、すっかり夜みたいに暗いですね。迷子にならないようにしなきゃ。",
        "わっ、水たまりが湖に見えます！ 落ちたら溺れちゃうかも……？",
        "ふふっ、かくれんぼなら誰にも負ける気がしませんよ！"
    ],
    shrink_idle_lv1: [
        "あれ？ 机ってこんなに高かったでしたっけ？ 背伸びしないと届きません～。",
        "いつもの服がちょっとブカブカします。萌え袖ってやつですか？ えへへ。",
        "視線が低いと、普段見落としてた小さな花にも気づけますね。新しい発見です！"
    ],
    shrink_idle_lv2: [
        "コップがお風呂みたいに大きいです！ 飛び込んだら気持ちいいかな？",
        "リンゴが岩みたいに大きくて、かじりつくのも一苦労ですね……あーんっ！",
        "ねずみさんが猛獣に見えてきました……。こ、こっちに来ないでくださいね？"
    ],
    shrink_idle_lv3: [
        "ひいっ！ アリさんの顎、あんなに鋭かったんですか！？ 食べられちゃいます！",
        "風に乗ってどこまでも飛んでいけそうです～！ ……って、戻れなくなったらどうしよう！？",
        "砂粒がサッカーボールみたいです。転がってきたら大惨事ですよぉ……！",
        "こ、ここまで小さいと、味方にも踏まれそうで怖いです！ ここにいますよー！"
    ],
    equip_hints: {
        'ring_regen': [
            "この指輪、なんだかポカポカします……。つけてるだけで、傷が自然に治っていくみたい！",
            "まるで温泉に入ってる気分です～。これなら少しくらい怪我しても平気かな？",
            "ん～、リラックス……。この指輪があれば、いつでも元気いっぱいでいられそうです！"
        ],
        'ring_wizard': [
            "魔力が溢れてきます！ すごい魔法が撃てそう……でも、これだと普通の攻撃はできないかな？",
            "頭が冴え渡る感覚……！ 難しい呪文もスラスラ詠唱できちゃいそうですっ！",
            "腕力はからっきしですけど、魔法の威力なら誰にも負ける気がしません！"
        ],
        'ring_berserk': [
            "うがーっ！ なんだか暴れたくなってきました！ もう難しいことは考えられませんっ！",
            "体中が熱いです！ 今なら岩だって素手で砕けそう！ ……あれ、魔法の使い方、忘れちゃった？",
            "細かいことは気にしない！ 目の前の敵をぶっ飛ばす！ それだけですっ！"
        ],
        'ring_unstable': [
            "すごい力がみなぎるんですけど……なんだか時々、体がムズムズして縮んじゃいそうです。",
            "わっ、今の揺れは何！？ ……あ、私の体か。強いけど、制御するのが大変かも～。",
            "強くなったり小さくなったり……忙しい指輪ですね。でも、この強さは魅力的です！"
        ],
        'pendant_paradox': [
            "これがあれば、怖かったりボーッとしてる時こそ、ものすごい力が出せる気がします！ ピンチがチャンス、ですね！",
            "普通なら動けなくなる時でも、このペンダントがあれば逆に強くなれちゃうんです。不思議～！",
            "状態異常なんて怖くない！？ ……いや、やっぱり痛いのは嫌ですけど、反撃のチャンスがあるのは心強いですね。"
        ],
        'pin_small_1': [
            "この留め針、外れなくなっちゃいました……。少し小さいままですけど、魔力は高まってる気がします！",
            "目線がちょっと低いかな？ でも、魔法の集中力は普段よりずっとイイ感じです！",
            "カワイイ留め針ですよね。これをつけてると大きく戻れませんが、魔法使いとしては悪くないかも？"
        ],
        'pin_small_2': [
            "結構小さくなっちゃいました……。でも見てください、体から魔力が溢れてキラキラしてますよ！",
            "小石が漬物石くらいのサイズに見えます。ふふっ、でもこの溢れる魔力なら、吹き飛ばせちゃいますね！",
            "これ以上大きくなれないのは不便ですけど、この魔力の高まり……クセになっちゃいそうです。"
        ],
        'pin_small_3': [
            "わわわ、豆粒サイズです～！ 踏まれたら終わりですけど、魔力だけは最強クラスですよっ！",
            "世界が巨大に見えます……！ でも大丈夫、私の魔法なら、どんな大きな敵もイチコロですから！",
            "極限まで小さいけど、魔力も極限！ まさに「小さな大魔法使い」って呼んでくれませんか？ えへへ。"
        ]
            },
    // --- 合成：装備品 (Synthesis: Equipment) ---
    synthesis_equip: [
        "えいっ、やあっ、とうっ！ 全部入れて、混ぜ混ぜしちゃいましょう！ 何が出るかな？",
        "わぁっ！ 壺が光りました！ これは大当たりの予感ですよっ！ まぶしーっ！",
        "使い込んだ道具たちが、ピカピカの新品に生まれ変わりました！ 壺さん、ありがとう！",
        "ドキドキ……。変なものが出てきたらどうしましょう？ ……あ、意外と強そう！",
        "料理みたいで楽しいですね！ 隠し味に、私の愛情も入れておきましたよっ。"
    ],
    // --- 合成：カード (Synthesis: Card) ---
    synthesis_card: [
        "頭の中のホコリを払って……古い知識をリサイクルです！ 新しい閃き、来いっ！",
        "う～ん、この呪文とあの記憶をくっつけると……わっ！ すごい魔法ができちゃいました！",
        "ふふっ、まるでパズルみたいですね。バラバラの記憶が繋がって、新しい力になりました！",
        "要らないカードも、工夫次第で切り札になるんですね。勉強になりますっ！",
        "頭の中がスッキリしました！ 整理整頓すると、新しいアイデアが湧いてきますね。"
    ],
    // --- 合成：失敗・不満 (Synthesis: Bad/Fail) ---
    synthesis_fail: [
        "あ、あれれ？ 出てきた装備、なんだかボロボロで錆びちゃってます……うぅ。",
        "うーん……材料が足りないみたいです。壺さんが「もっと寄越せ」って顔してますよ？",
        "し、失敗！？ ……いえ、これはこれで「味がある」ってことで、どうでしょう？",
        "むぅ……欲張りすぎちゃったかな？ 次はもっと丁寧に混ぜてみますね。",
        "スカッ……。あれ？ 何も起きませんね。入れ方が悪かったのかな？"
    ],

    // --- 状態異常についての雑談 (Status Ailment Talks) ---
    // 毒: 行動終了時にダメージ
    talk_poison: [
        "動くたびにズキズキするの、本当に嫌ですよね。毒消し草、カバンに入ってますか？",
        "毒の痛みって、じわじわ体力を削られるのが怖いです。気づいたらフラフラ……なんてことにならないように！",
        "毒沼には気をつけてくださいね？ 靴が溶けるだけじゃ済まないですから！"
    ],
    // 混乱: 敵の行動予測(Intent)が見えない
    talk_confusion: [
        "目が回って、敵が次に何をしてくるか全然分からなくなっちゃう……混乱って本当に厄介です。",
        "敵の狙いが読めないなんて、目隠しして戦うようなものですよぉ。ギャンブルは苦手なのに！",
        "頭がグルグル……。混乱してる時って、私、変なこと口走ってたりしませんよね？"
    ],
    // 放心: 魔法(カード)使用不可
    talk_distraction: [
        "放心状態になると、簡単な呪文も思い出せなくなるんです。頭が真っ白って、こういうこと？",
        "魔法使いにとって、呪文が使えないのは死活問題です！ 杖を持って棒立ちなんて恥ずかしすぎますっ！",
        "ボーッとしちゃう時は、深呼吸です。……でも、戦ってる最中に深呼吸する余裕なんてないですよね。"
    ],
    // 恐怖: 通常攻撃不可
    talk_fear: [
        "敵に睨まれると、怖くて足がすくんじゃうんです……。勇気だけじゃどうにもならない時もあります。",
        "手が震えて剣が振れない……！ そんな時は、遠くから魔法でドカン！ といっちゃいましょう！",
        "恐怖で動けない時は、無理しちゃダメです。逃げるのも勇気……あれ、逃げる足は動くかな？"
    ],
    // 石化: 回避・逃走不可
    talk_petrified: [
        "足が石みたいに重くなって……もう逃げられないって悟った時の絶望感、想像したくないなぁ。",
        "石化したら、もう腹を括って正面から殴り合うしかありません！ やられる前にやる、です！",
        "体の一部が石になるなんて……。早く治さないと、そのまま彫像にされちゃいそうで怖いです。"
    ],
    // 脱衣: 防御力0
    talk_stripped: [
        "服が溶ける罠なんて、このダンジョンの製作者は絶対に変態です！ 怒らないから出てきてくださいっ！",
        "防御力がゼロだなんて……紙切れ一枚で戦場に立つようなものです。心細くて泣いちゃいそう……。",
        "きゃっ！ ……あ、想像しただけです。装備が外れるとスースーして、戦いどころじゃなくなっちゃいますね。"
    ],
    // 縮小化: ATK/DEF低下 (段階進行)
    talk_shrink_general: [
        "3回も小さくなったら、もう虫のエサになっちゃいそうです……。踏まれる前に戻らないと！",
        "体が縮むと、力も出ないし守りも弱いし……。小さくて可愛いのは良いんですけど、冒険には不向きですね。",
        "豆粒サイズになったら、敵の靴の裏しか見えなくなっちゃいます。そんな最期は嫌ですよぉ！"
    ],
    // 膨張: ATK増/SPD減/脱衣扱い/他状態異常無効
    talk_expansion: [
        "体が急に大人みたいに成長して……力がみなぎってくる感覚は凄いんです。でも、体が重くてドスドス歩くことになっちゃうのは、妖精としてどうなんでしょう？",
        "膨張すると……その、お洋服がサイズアウトして弾け飛んじゃうのが一番の問題です！ いくら攻撃力が上がっても、あんな破廉恥な姿で戦うなんて……うぅ、思い出すだけで顔から火が出そうです。",
        "あの状態だと、お肌がパンと張ってて毒も麻痺も弾き返しちゃうんです。ある意味無敵ですけど……体が重くて攻撃も避けられないので、まさに「肉を切らせて骨を断つ」ですね。",
        "うぅ……あんなに胸やお尻が大きくなっちゃうなんて。足元が見えなくて怖かったですし、動くたびにボヨンボヨンって……あぁもう、忘れてくださいっ！",
        "服が弾け飛ぶのも恥ずかしいですけど、その……中身が、すごく主張してくるのが……。普段の私とは比べ物にならないくらい「大人」すぎて、鏡を見るのも無理でした……。",
        "あそこまで育っちゃうと、隠そうとしても手で隠しきれないんです。指の隙間から溢れちゃう感じで……。魔力の副作用って、本当にえっちですよね……。"
    ],

    // --- 特殊リザルト：露出狂の目覚め (Exhibitionist Awakening) ---
    result_strip_low: [
        "ふぅ……。背に腹は代えられないとはいえ、やっぱり恥ずかしいです……。",
        "あんな姿で戦うなんて……。誰にも見られてませんよね？ ね？",
        "次はちゃんと服を着て戦いたいです。スースーして落ち着きません……。"
    ],
    result_strip_mid: [
        "風通しが良くて、なんだか魔力が漲る感じ……悪くないかも？",
        "体が軽くて、普段より動けた気がします。これが「解放」ってやつですか？",
        "服がない方が、逆に集中できるなんて……私、新しい扉を開けちゃった？"
    ],
    result_strip_high: [
        "服なんて飾りです！ この開放感こそが最強の証なんですよ！",
        "見てください、この輝く肌！ 防御力なんて捨てて、私は風になりました！",
        "布一枚の重さすら邪魔なんです。今の私なら、神様にだってなれそうです！"
    ],

    // --- 特殊リザルト：プレイスタイル別 (Playstyle) ---
    result_no_magic: [
        "杖は殴るための道具……って、私、魔法使い失格でしょうか？",
        "筋肉痛です……。次はもう少し頭を使って戦いたいなぁ。",
        "魔法？ ああ、そんなのもありましたね。でも、拳の方が早く片付くので！"
    ],
    result_no_attack: [
        "野蛮な暴力は必要ありません。全ては魔法の力です！",
        "指一本触れさせずに勝つ。これぞエレガントな冒険ですね。",
        "私の知略と魔力の前では、どんな怪物もただの的（マト）でしたね！"
    ],
    result_naked: [
        "装備に頼らなくても、意外となんとかなるものですね！ 私、天才かも？",
        "防御力ゼロのヒリヒリする感じ……癖になりそうです。スリル満点でした！",
        "身一つでダンジョン制覇！ 吟遊詩人さんが歌にしてくれそうな冒険でしたねっ！"
    ],
    result_escape_master: [
        "逃げるは恥じゃありません、生き残るための高度な戦術です！",
        "私のスピードについてこれた魔物はいないみたいですね♪ 追いつけるものなら追いついてみなさいっ！",
        "危ない橋は渡らない。これが長生きの秘訣ですよ。ふふん♪"
    ],

    // --- 特殊リザルト：高補正値アイテム獲得 (High Value Loot) ---
    result_loot_20: [ "見てください！ なかなか良い輝きの装備を拾いましたよ！", "おっ！ これは結構な値打ち物じゃないですか？ 懐が温まりますね～。", "キラリと光るこの逸品……。今日の私は運が良いみたいです！" ],
    result_loot_30: [ "わわっ、これは凄いです！ 街の家宝レベルかも！？", "すごい魔力を感じます……！ これがあれば、もっと奥まで行けちゃいますよ！", "鑑定しなくても分かります。これは「大当たり」です！ やったぁ！" ],
    result_loot_40: [ "手が震えてきました……こんな伝説級のアイテム、実在したんですね……。", "まぶしいっ！ 直視できないくらいのオーラが出てます！ 国宝級ですよこれ！", "夢じゃないですよね？ 頬をつねってみてもいいですか？ ……痛っ！ 夢じゃなーい！" ],
    result_loot_50: [
        "こ、これは……世界が滅びちゃうくらいの魔力を感じます……！！",
        "神様が落とし物をしてますよ！？ 私たちが拾っちゃっていいんでしょうか……！？",
        "……言葉が出ません。歴史の教科書に載るレベルのアーティファクトです……！"
    ],

    // --- イベント：解放の覚醒 (Event: Awakening of Exposure) ---
    event_awakening_exposure: [
        "ふぅ、戻ってきました……。でも、なんだか体が熱いんです。冒険の興奮が冷めないのかな？ ううん、もっと奥のほうが、ジンジンして……。",
        "あの時……服を脱ぎ捨てて風を浴びた時、すっごく力が湧いてきたのを覚えてます。隠さないほうが、魔力が肌に馴染むような……。私、変になっちゃったんでしょうか？",
        "ううん、違います。これが、本当の私なのかもしれません。ありのままの姿こそが、最強の魔力を引き出す鍵だったんです！ もう、恥ずかしがる必要なんてなかったんだ……！",
        "あ、見てください！ 溢れ出した魔力が、キラキラ集まって……こんな形になっちゃいました。これが私の『解放の証』……。ふふっ、素敵です。大切に使ってくださいね？"
    ],

    // --- 特殊装備：解放の証 (Idle: Stripped / Naked at Home) ---
    idle_stripped_home: [
        // A. 一人の時の恥じらい (Shyness)
        "うぅ……誰もいないって分かってるんですけど、やっぱり手で隠しちゃいます……。落ち着かないなぁ。",
        "あ、窓に映った……っ！ い、今の見なかったことにしましょう。自分でも直視できないなんて、我ながらどうなんでしょう……。",
        "布一枚ないだけで、こんなに心細いなんて……。あぅ、クッションを抱きしめてないと、恥ずかしくて溶けちゃいそうです。",

        // B. 自然・魔力との一体感 (Nature & Mana)
        "ふふっ、風が肌を撫でるのが分かります。これなら魔力を直に感じられますね。",
        "服の締め付けがないって、こんなに楽だったんですね。お家の中なら、これもありかな？",
        "生まれたままの姿……妖精としては、これが一番自然な形なのかもしれません。",
        "んっ……。空気が肌に触れるたび、魔力が直接染み込んでくるみたい……。すごい効率ですけど、やっぱりスースーして恥ずかしいですぅ。",
        "体の芯からポカポカしてきました。遮るものがないと、世界中のマナと繋がってる気分……。見た目はともかく、感覚は研ぎ澄まされてますね。",
        "ふぅ……深呼吸すると、指先まで力が満ちるのが分かります。これが『解放』の力……。うぅ、代償が『恥ずかしい』なのはキツイですけど。",

        // C. 装備への困惑 (Curse)
        "よいしょ、今度こそ……わわっ！ また服が滑り落ちちゃいました。う～ん、この『解放の証』、絶対に私を着替えさせない気ですね？",
        "ねえ、そろそろ外れませんか？ ……シーン。やっぱりダメですか。性能は良いのに、性格が意地悪なアイテムさんです。",
        "はくしょんっ！ うぅ、やっぱり少し寒いのかな？ 呪いのせいで毛布を被ってもずり落ちちゃうし……どうやって寝ればいいんでしょう？",

        // D. ポジティブな諦め (Acceptance)
        "恥ずかしいのは我慢、我慢……。これも、最強の大妖精になるための修行……なんですよね？ きっとそうです、そう思い込みましょう！",
        "まあ、この姿のおかげで強い魔法が撃てるんですもんね。背に腹は代えられない……いえ、腹も背中も丸見えなんですけど！",
        "ふふっ、お部屋の中なら、この格好も意外と快適かも？ ……はっ！ いけません、私！ ここで羞恥心を捨てたら、何か大事なものを失う気がします！",

        // パターン1: 肌の感触を確かめる (ペタペタ)
        "ペタ、ペタ……。（二の腕や太ももを触っている）……ん～、自分の肌をこうやって直に触るの、なんだか不思議な感じです。ちょっと冷たくて、すべすべしてて……変な気分。",

        // パターン2: 魔力の流れをなぞる (スゥーッ)
        "すぅーっ……。（指先で胸元からお腹をゆっくりなぞる）……っ。指でなぞると、魔力のラインが分かります。ここも、ここも、回路が剥き出しになってるみたいに敏感で……くすぐったい。",

        // パターン3: 柔らかさを気にする (ムニムニ)
        "むに、むに。（お腹のお肉をつまんでいる）……うぅ、夢じゃないですね。お洋服、本当にありません。……それにしても、私のお腹、ちょっとプニプニしすぎじゃありませんか？ 運動不足かなぁ……。",

        // パターン4: 温めようとする (サスサス)
        "さす、さす……。（冷えた肩を自分で抱いて温めている）……肌が外気に触れてると、体温が逃げちゃう気がします。こうやって自分で温めてると、なんだか小動物になった気分です……。",

    // --- 特殊状態：孤独な陶酔 (Solitary Trance) ---
        // 誰の目もない密室で、溢れる魔力と熱に一人で翻弄されている状態

        // A. 制御できない内部の熱 (Internal Heat)
        "はぁ、はぁ……。おかしいな、お部屋の中なのに……体が燃えてるみたい。お腹の奥で、魔力がグルグル渦巻いて……熱いよぉ……。",
        "ふぅ……っ。壁に寄りかかって冷ましても、すぐに熱くなっちゃう。この呪い、私の体の中で暴れてるんですか……？ んくっ……。",
        "……誰もいないのに、なんでこんなにドキドキしてるんだろ。自分の心臓の音がうるさくて……頭が真っ白になりそうです……。",

        // B. 自分の指への過敏反応 (Self-Touch Sensitivity)
        "んっ……。自分の指なのに、なぞるだけで……電気が走ったみたいに痺れます。……ふふ、私、自分の体で遊んでるみたい……変なの。",
        "くすぐったい……。腕を抱きしめてるだけなのに、皮膚がとろけちゃったみたいに敏感で……力が、入らない……。",
        "あ……っ。ダメ、足が勝手に震えちゃう。ちょっと太ももを擦っただけですよ？ ……うぅ、今の私、どこを触ってもダメみたいです……。",

        // C. 孤独な溶解・諦め (Melting Alone)
        "はぁ……。もう、何も考えられない……。このまま床に溶けて、魔力のシミになっちゃってもいいかも……。ふあぁ……気持ちいい……。",
        "鏡の中の私、目がトロンとしてて……知らない子みたい。……ねえ、貴方も熱いの？ ……返事はないか。あはは……。",
        "んぅ……。誰も見てないから、いいですよね？ ……ちょっとだけ、声を我慢するの、やめてみようかな。……はぁっ……んんっ……。"
    ],

// --- 連打・放置時の30%確率用セリフ (Random Mix) ---
    // 段階共通：理性で快感を抑え込もうとしているが、限界が近いセリフ
    touch_random_mix: [
        "んっ……そんなに弄らないでください。体の中で、変なスイッチが入っちゃいそうです……。",
        "はぁ……流れてくる魔力が、熱くて……。体の芯から、トロトロに溶かされちゃいそう……。",
        "くぅ……っ。指先が震えて、止まりません。ねえ、私に何をしてるんですか……？",
        "ダメです、理性で抑えないと……。でも、奥の方が疼いて……言うことを聞いてくれません。",
        "皮膚の下を、電流が走ってるみたい……。触れられるたびに、ビクッてなっちゃいます。",
        "あぅ……。深呼吸しなきゃ……。吸って、吐いて……っ、ダメ、吐息が震えちゃう……。",
        "頭がクラクラします……。これ以上、魔力を注がれたら……私、どうにかなっちゃいそう……。",
        "んくっ……！ 我慢、できます……。これくらいなら、まだ……っ、あぁ、でも……。",
        "……意地悪。私の反応を見て、楽しんでるんでしょう？ ……顔、見られちゃダメ……。",
        "はぁ、はぁ……。体中が敏感になってて……服があっても無くても、もう関係ないかも……。",
        "視界が……チカチカします。世界が回ってるのか、私が回ってるのか……分かりません……。",
        "んぅ……っ。お腹の奥が、ギュッて締め付けられて……甘い痺れが、広がっていくの……。",
        "お願い、少し休ませて……。このままだと、妖精としての理性が……飛んじゃいます……ッ。",
        "魔力の奔流に、流されそう……。気を確かに持たないと……あぁっ、また波が……！",
        "……聞こえてますか？ 私の心臓の音……早鐘みたいに鳴ってて、痛いくらいなんです。",
        "んっ、ぁ……。ダメ、声を出したら負けです……。くちびる、噛んで我慢しないと……。",
        "その手つき……慣れてますね？ 私のどこをどうすれば、おかしくなるか……分かってるんでしょ……？",
        "あぁ……全身の血液が沸騰してるみたい……。熱くて、苦しくて……でも、嫌じゃないの……。",
        "も、もう……許容量ギリギリです……。これ以上は、責任……取ってくださいね……？",
        "くぅっ……！ 頭では「ダメ」って分かってるのに……体が勝手に、次を期待しちゃってる……。"
    ],

    // --- 連打・放置時の70%確率用セリフ (Passive / Situation Dependent) ---
    // タップの刺激に対する反射的な喘ぎや、短い独り言
    touch_passive: {
        // 脱衣・解放時 (Stripped)
        // まだ理性はあるが、肌が過敏になっている状態
        stripped: [
            "ひゃうっ！",
            "んっ……そこ、ダメ……。",
            "ビクッて……した……。",
            "あぅ……肌が、ピリピリする……。",
            "んぅ……見ちゃ、ダメ……。",
            "風が……しみるよぉ……。",
            "くぅっ……敏感に、なってる……？",
            "はぁ……なんか、熱い……。",
            "や……っ、変な感じ……。",
            "んっ、ぁ……！"
        ],
        // 膨張Lv1 (Expansion Lv1)
        // 内部からの突き上げと熱に戸惑い、少し感じ始めている
        expansion_lv1: [
            "あ……っ、膨らんでる……。",
            "んくっ……中、熱い……。",
            "ふぅ……っ、きついよぉ……。",
            "皮膚が……引っ張られて……んっ。",
            "内側から……押さないで……。",
            "あぁ……魔力が、溜まってく……。",
            "ダメ……癖に、なっちゃう……。",
            "んぅ……もっと……？ ううん、ダメ……。",
            "お腹……うずいてる……。",
            "はぁ……っ、大きくなっちゃう……。"
        ],
        // 膨張Lv2 (Expansion Lv2)
        // 重みと揺れに翻弄され、理性が飛びかけている
        expansion_lv2: [
            "あぁっ……！ 重いぃ……っ。",
            "んあぁっ……揺らさないで……♡",
            "たぷんって……言った……。",
            "あひっ……腰、抜けちゃう……。",
            "頭……ぼーっとするぅ……。",
            "んっ、く……溢れちゃうよぉ……。",
            "もう……支えきれない……ッ。",
            "すごい……ジンジンする……。",
            "はぁ……もっと、いじめて……？",
            "あふぅ……っ♡"
        ],
        // 膨張Lv3 (Expansion Lv3)
        // 完全に開発済み。快感に溺れた短い喘ぎ
        expansion_lv3: [
            "あへぇ……♡",
            "んおっ……♡ 突き上げっ……♡",
            "ひグッ……♡ 壊れるぅ……♡",
            "あぁ……っ、パンパンだぁ……♡",
            "も、もっとぉ……膨らませて……♡",
            "ビクッて……止まんない……ッ♡",
            "あ……っ、イッちゃう……♡",
            "中……ドロドロだよぉ……♡",
            "んぅーっ！ ……♡",
            "私……ただの、肉袋ぉ……♡"
        ]
    },

// --- タッチ反応 (Touch Reactions: Nature & Wind Ver.) ---
    
    // A. 通常状態 (Normal)
    touch_normal: {
        // Lv1: 気づき (Notice)
        lv1: [
            "ん？ 今、どこからか風が吹きました？",
            "おや、髪が揺れたような……気のせいかな？",
            "今日は風が少し悪戯っ子ですね。ふふっ。",
            "あら？ 誰かが噂話でもしているんでしょうか。"
        ],
        // Lv2: 楽しむ (Enjoying)
        lv2: [
            "わっ！ ……ふふ、驚かせないでくださいよ、風の精霊さん？",
            "くすぐったいです！ どこから吹いてる風なんでしょう？",
            "おっとっと！ ……バランス感覚のトレーニングには丁度いいかも？",
            "なんだか周りの空気が賑やかですね。踊りだしたくなっちゃいます！"
        ],
        // Lv3: 一体化 (Harmony)
        lv3: [
            "あははっ！ 今日はとっても風が元気！ 嵐の前触れかな？",
            "くるくる～♪ 風に乗って、どこまででも行けそうな気分です！",
            "もう、揺らしすぎですよ～！ ……なんて、ちょっと楽しいですけど。",
            "揺れる世界もまた一興……酔わないように気をつけないとですね。"
        ]
    },

    // B. 脱衣状態 (Stripped / Liberated)
    touch_stripped: {
        // Lv1: 肌感覚 (Sensation)
        lv1: [
            "んっ……。服がないと、風が直接肌を撫でていきますね。",
            "スースーしますけど、自然と一体になってる感じ……嫌いじゃないです。",
            "あら、どこからか葉っぱが飛んできたのかな？",
            "今の風、ちょっと冷たかったです。……でも、目が覚めました！"
        ],
        // Lv2: 開放的な喜び (Openness)
        lv2: [
            "ひゃうっ！？ ……ふふ、風がくすぐってきました。敏感になってるのかな？",
            "わわっ！ ……もう、エッチな風ですねぇ。どこを吹き抜けてるんですか。",
            "全身で風を浴びるのって、こんなに気持ちいいんですね！ 新発見です！",
            "遮るものがないって素晴らしいです！ 森の呼吸を感じます！"
        ],
        // Lv3: 悟り・受容 (Acceptance)
        lv3: [
            "ふふっ、もう好きに吹いてください！ 私は風と友達になりました！",
            "裸ん坊の妖精をからかってるんですか？ 自然って意外と意地悪ですねぇ♪",
            "あはは！ くすぐったい！ ……開放感で、心まで軽くなってきちゃいました。",
            "太陽も風も、私の肌を祝福してくれてるみたい。……なんて、ポジティブすぎますか？"
        ]
    },

    // C. 縮小化 Lv1 (Shrink Lv1 - 小さい)
    touch_shrink_1: {
        // Lv1: 変化への気づき (Notice Change)
        lv1: [
            "体が軽いせいか、そよ風でもよろけちゃいますね。",
            "おっと！ ……ふぅ。小さいと、振動がダイレクトに来ます。",
            "あれ？ 地面が斜めになってませんか？ 気のせい？",
            "わっ、大きな葉っぱが落ちてきたのかと思いました！"
        ],
        // Lv2: アトラクション (Attraction)
        lv2: [
            "わわわっ！ ちょっとした地震です！ ……きゃっ！",
            "ふふっ、ブランコに乗ってるみたい！ 揺れる揺れる～♪",
            "とっとっと……！ あはは、千鳥足になっちゃいます！",
            "小さい体だと、世界がアスレチックみたいで飽きませんね！"
        ],
        // Lv3: 冒険心 (Adventure)
        lv3: [
            "わ～い！ 風の勢いでジャンプしたら、飛べるかもしれません！",
            "もっと揺れても平気ですよ！ バランス感覚なら自信ありますからっ！",
            "スリル満点です！ 小さくなるのも悪くないかも？",
            "さあ、次はどんな風が吹くんでしょう？ どーんと来てください！"
        ]
    },

    // D. 縮小化 Lv2 (Shrink Lv2 - 極小)
    touch_shrink_2: {
        // Lv1: 驚き (Surprise)
        lv1: [
            "ひゃあ！？ 息を吹きかけられたみたいに飛びました！",
            "地面がトランポリンみたいです！ ぽよんぽよん！",
            "わっ、何かの拍子に転がっちゃいました。でんぐり返し！",
            "ただの空気の揺れが、私には台風みたいです～！"
        ],
        // Lv2: 回転 (Spinning)
        lv2: [
            "目が回ります～！ 世界がグルグル～！",
            "わーーっ！ 転がる転がる！ 誰か止めて～！ ……ふふ、面白いっ。",
            "ジェットコースターって、こういう気分なんでしょうか！？",
            "きゃははっ！ 体が軽すぎて、ボールになったみたいです！"
        ],
        // Lv3: 大興奮 (Excitement)
        lv3: [
            "もっと高く！ わぁ～、景色がすごい勢いで変わります！",
            "嵐の中に飛び込んだみたい！ 私、最強のチャレンジャーですね！",
            "揺れろ揺れろ～！ 極小サイズのダンスパーティーですっ！",
            "もう何が起きても驚きませんよ！ この状況、楽しんだ者勝ちです！"
        ]
    },

    // E. 縮小化 Lv3 (Shrink Lv3 - 豆粒)
    touch_shrink_3: {
        // Lv1: 浮遊 (Floating)
        lv1: [
            "ふわわ……足が地につきません。私、浮いてます？",
            "埃と一緒にダンスです。あ、くしゃみ出そう……。",
            "どこへ流されていくんでしょう？ 風の向くまま、気の向くままですね。",
            "ゆらゆら……。水中を漂うプランクトンって、こんな気分？"
        ],
        // Lv2: 一体化 (Drifting)
        lv2: [
            "くるくるくる～！ 竜巻に乗っちゃいました～！",
            "わーい！ 私は綿毛です！ どこかの土に植えてください～！",
            "見えますかー！ 私はここですよー！ ……風の音にかき消されちゃいますね。",
            "空気と私が混ざり合っていくみたい……不思議な感覚です。"
        ],
        // Lv3: 無我の境地 (Zen)
        lv3: [
            "……ふふ、ここまで小さいと、逆に無敵な気がしてきました。",
            "世界中が私のゆりかごです。揺られて眠っちゃいそう……。",
            "風に乗って、このまま世界の果てまで旅行しちゃいましょうか！",
            "ちっぽけな悩みなんて吹き飛びました！ だって私自身が吹き飛んでますから！ あはは！"
        ]
    }
};

// --- ダンジョン内ランダムイベントデータ ---
const DUNGEON_EVENT_DATA = {
    // --- A. 罠・アクシデント (Traps) ---
    event_trap: [
        {
            id: "trap_thorns",
            text: "足元のツタが急に暴れだし、鋭い棘が身体を掠めた！",
            dialogue: "いたたっ！ 棘が刺さりました……。植物だからって油断できませんね。"
        },
        {
            id: "trap_rock",
            text: "天井から握り拳ほどの石が落ちてきて直撃した！",
            dialogue: "あだっ！？ ……も～、タンコブできちゃいましたよぉ。運が悪いです。"
        },
        {
            id: "trap_trip",
            text: "何もない平らな地面で、派手に転んでしまった！",
            dialogue: "きゃっ！ ……うぅ、恥ずかしいです。誰も見てませんよね？ ね？"
        }
    ],

    // --- B. 選択の泉/祭壇 (Choices) ---
    // (今回は簡易実装のため、選択肢ロジックは省略し、即時効果イベントとして扱うか、将来拡張用)
    // ここでは単純なテキストイベントとして定義しておきます

    // --- C. 小さな抜け道 (Reward: Shrink Only) ---
    event_small_hole: [
        {
            id: "hole_crack",
            text: "壁のひび割れの奥から、強い魔力の光が漏れている。",
            dialogue: "今の私のサイズなら、この隙間を通れそうです！ 秘密のお宝、ゲットしちゃいましょう！"
        },
        {
            id: "hole_mouse",
            text: "崩れた瓦礫の下に、小人族の隠し倉庫を発見した。",
            dialogue: "わぁ！ 小さい私専用の入り口です！ 探検、探検～♪"
        }
    ],

    // --- D. 露出への罰 (Penalty: Stripped Only) ---
    event_stripped_penalty: [
        {
            id: "stripped_cold",
            text: "ダンジョンの裂け目から、凍てつくような冷気が吹き抜けた！",
            dialogue: "くしゅんっ！ うぅ、寒いですぅ……！ やっぱり服って偉大だったんですね……。"
        },
        {
            id: "stripped_slime",
            text: "天井から粘着質の樹液が大量に垂れてきた！",
            dialogue: "ひゃっ！ ぬるぬるして気持ち悪いです……！ 服がないから肌に直撃ですよぉ！"
        },
        {
            id: "stripped_gaze",
            text: "暗闇から無数の視線を感じる……。精神的なダメージを受けた！",
            dialogue: "うぅ、ジロジロ見られてる気がします……。隠す布が欲しいです……。"
        }
    ],

    // --- E. 小人の受難 (Penalty: Shrink Lv2+ Only) ---
    event_shrink_penalty: [
        {
            id: "shrink_wind",
            text: "横穴から突風が吹き荒れた！ 体重の軽い体はひとたまりもない！",
            "dialogue": "きゃあああ！ 飛ばされるぅぅぅ！ 小さすぎて踏ん張れませんーっ！"
        },
        {
            id: "shrink_water",
            text: "天井から水滴が落ちてきた。今のサイズでは、それは巨大な水爆弾だ！",
            "dialogue": "上！？ わわっ、水滴が岩みたいに……潰れちゃいますーっ！"
        },
        {
            id: "shrink_step",
            "text": "冒険者の亡霊が現れ、気づかずに踏みつけていった！",
            "dialogue": "ぷちっ！？ ……あぐぅ……。む、虫けらの気分ってこういうことですか……？"
        }
    ]
    /*
    ,

    // --- フレーバーイベント (Flavor Text) ---
    flavor_normal: [
        {
            "text": "カラン、コロン……。蹴っ飛ばした小石の音が、どこまでも響いていく。",
            "dialogue": "……誰もいませんよね？ 自分の足音だけでビックリしちゃいました。"
        },
        {
            "text": "壁に『この先、お宝なし。あるのは絶望だけ』という落書きがある。",
            "dialogue": "うぅ、不吉なこと書かないでくださいよぉ。……実は逆心理で、すごいお宝があるとか？"
        },
        {
            "text": "ぐぅぅ……。お腹の虫が盛大に鳴ってしまった。",
            "dialogue": "はうっ！ ……今の音、敵に聞かれてないかな？ 恥ずかしい……。"
        },
        {
            "text": "天井の隅に、ぼんやりと光る苔が生えている。",
            "dialogue": "綺麗ですねぇ。持って帰ってランプにしたら、高く売れるでしょうか？"
        }
    ],
    flavor_shrink: [
        {
            "text": "巨大な黒い影が目の前を横切った！ ……よく見ると、ただのダンゴムシだ。",
            "dialogue": "ひゃあっ！ ……あ、なんだ、ダンゴムシさんでしたか。今の私といい勝負のサイズですね……。"
        },
        {
            "text": "目の前に階段がある。今のサイズでは、それは巨大な断崖絶壁に見える。",
            "dialogue": "よいしょ、よいしょ……。これ、一段登るだけで日が暮れちゃいそうです！"
        }
    ],
    flavor_stripped: [
        {
            "text": "ヒュオォ……。冷たい隙間風が、無防備な肌を容赦なく撫でていく。",
            "dialogue": "うぅ……。心なしか、防御力が下がった音がしました。風邪ひきそうです。"
        },
        {
            "text": "拘束するものが何もない。不思議なほどの開放感を感じてしまった。",
            "dialogue": "ん～っ！ ……なんだか、ついついスキップしたくなっちゃいます。私、露出狂の才能があるのかな……？"
        }
    ]*/
};

// --- 伝説級イベント用テキスト (Legendary Dialogue) ---
const LEGEND_DIALOGUE = {
    // A. 妖精の加護
    event_get_blessing: [
        "はぁ、はぁ……。あんなに小さな体で、よくぞここまで戻ってきました……！ 怪我はありませんか？",
        "見てください、あなたの体から優しい光が……。これは、ハンデを背負って戦い抜いた、小さな勇者への贈り物ですね。",
        "『妖精の加護』……。この輝きがあれば、もう大きさなんて関係ありません。小さくたって、貴方は誰より大きくて強いんです！"
    ],
    // B. 聖女の御旗
    event_get_saint_flag: [
        "ふぅ……！ 荷物がパンパンです！ これだけの知識と記憶を抱えて、一つも捨てずに生き残るなんて……。",
        "貴方のその「守り抜く力」、まるで伝承に出てくる聖女様のようです。……あっ、空から何かが舞い降りてきました！",
        "この旗は……『聖女の御旗』！ 全てを慈しみ守る、貴方にこそふさわしい旗印です。さあ、高らかに掲げましょう！"
    ],
    // C. 魔王の大斧
    event_get_demon_axe: [
        "深淵の底から、とんでもないものを拾ってしまいましたね……。見てください、この禍々しいオーラ。",
        "『魔王の大斧』……。かつて世界を震わせた暴力の結晶。持っているだけで、心がざわつきます。",
        "でも、今の貴方なら……この強大すぎる力、使いこなせるかもしれません。覚悟はいいですか？"
    ],
    // D. 勇者の紋章
    event_get_hero_emblem: [
        "信じられません……。あの魔王の斧の呪いに飲み込まれず、逆に飼いならしてしまうなんて。",
        "闇を御して光に至る。貴方の魂の輝きに呼応して、新たな力が顕現しようとしています……！",
        "認めましょう。貴方こそが、真の勇者です！ この『勇者の紋章』は、誰あろう貴方のための勲章ですよ！"
    ],
    // E. 大妖精の証
    event_get_grand_proof: [
        "……なんだか、世界が違って見えます。風の流れ、魔力の源流、全てが手に取るように分かるんです。",
        "貴方と一緒に極限を超えたおかげでしょうか？ 私、もうただの妖精じゃありません。殻を破って……進化しちゃいました！",
        "えへへ、これからは『大妖精』って呼んでくださいね？ この『大妖精の証』にかけて、貴方を絶対の勝利へ導いてみせます！"
    ],
    // F. 無双の妖精譚
    event_get_peerless_tale: [
        "999層……。ついに、伝説の果てまで来ちゃいましたね。長かったような、短かったような……。",
        "貴方と歩んだ一歩一歩が、戦いの記憶が、光の粒子になって集まってきます。これは……一冊の本？",
        "『無双の妖精譚』。これは、私達の冒険の記録そのものです！ この物語は、どんな剣よりも鋭く、どんな盾よりも堅い、最強の力になるはずです……！"
    ]
};

// 既存データへのマージ
Object.assign(FAIRY_DIALOGUE_DATA, LEGEND_DIALOGUE);

// --- エンドコンテンツ装備データ ---
const ENDGAME_ITEMS = [
    {
        id: 'acc_fairy_blessing', name: '妖精の加護', category: 'accessory', tier: 'legendary',
        desc: '【常時縮小(Lv3)】DEF/INT大幅増。手札上限+1。',
        type: 'accessory',
        stats: { def: 50, int: 50 },
        passive: { minShrinkLevel: 3, handSizeMod: 1 }
    },
    {
        id: 'acc_saint_flag', name: '聖女の御旗', category: 'accessory', tier: 'legendary',
        desc: '縮小・状態異常無効。最大HP+100。ターン終了時HP回復。',
        type: 'accessory',
        stats: { hp: 100 },
        passive: { nullifyShrink: true, nullifyStatus: true, hpRegen: 0.1 }
    },
    {
        id: 'wpn_demon_axe', name: '魔王の大斧', category: 'weapon', tier: 'legendary',
        desc: 'ATK+100。さらに最終ATKが1.5倍になる。',
        type: 'weapon',
        stats: { atk: 100 },
        passive: { statMultiplier: { atk: 1.5 } }
    },
    {
        id: 'arm_hero_emblem', name: '勇者の紋章', category: 'armor', tier: 'godly',
        desc: '全ステータスが大きく上昇する。',
        type: 'armor',
        stats: { hp: 100, atk: 50, def: 50, int: 50, spd: 20 }
    },
    {
        id: 'acc_grand_fairy_proof', name: '大妖精の証', category: 'accessory', tier: 'godly',
        desc: '状態異常無効。INT/SPD大幅増。ターン終了時、INT分の防壁を得る。',
        type: 'accessory',
        stats: { int: 100, spd: 50 },
        passive: { nullifyStatus: true, shieldGenRate: 1.0 }
    },
    {
        id: 'wpn_peerless_tale', name: '無双の妖精譚', category: 'weapon', tier: 'godly',
        desc: 'INT+200。INTとSPDが2倍。放心(stun)無効。',
        type: 'weapon',
        stats: { int: 200 },
        passive: { statMultiplier: { int: 2.0, spd: 2.0 }, nullifyBadStatus: ['distraction'] }
    }
];

// --- 装備生成用データ ---
const WEAPON_TYPES = {
    SWORD:  { name: '剣',   stat: 'atk', mod: 1.0, sub: {} },
    AXE:    { name: '斧',   stat: 'atk', mod: 1.3, sub: { spd: -0.1 } },
    KATANA: { name: '刀',   stat: 'atk', mod: 0.9, sub: { hp: 0.2 } },
    WAND:   { name: '杖',   stat: 'int', mod: 1.0, sub: {} },
    BOOK:   { name: '書',   stat: 'int', mod: 0.8, sub: { spd: 0.1 } },
    CANNON: { name: '魔導砲', stat: 'int', mod: 1.2, sub: { atk: 0.3, spd: -0.2 } },
    SHIELD: { name: '大盾', stat: 'def', mod: 1.3, sub: { atk: 0.2, spd: -0.2 } }
};

const ARMOR_TYPES = {
    PLATE:  { name: '鎧',     main: ['def', 'hp'], mod: 1.0 },
    ROBE:   { name: 'ローブ', main: ['def', 'spd'], mod: { def: 0.6, spd: 1.5 } },
    CREST:  { name: '紋章',   main: ['hp', 'atk', 'int'], mod: { def: 0.1, others: 1.2 } }
};

// ランク素材 (Tiers)

const MATERIAL_TIERS = [
    // Rank 0 (Power: 5)
    {
        bal: { name: 'ボロボロの', power: 5, bias: { atk: 1.0, def: 1.0, int: 1.0, spd: 1.0 } },
        phy: { name: '錆びた',     power: 5, bias: { atk: 1.2, def: 1.1, int: 0.5, spd: 0.9 } },
        mag: { name: '枯れた',     power: 5, bias: { atk: 0.6, def: 0.8, int: 1.2, spd: 1.1 } }
    },
    // Rank 1 (Power: 10)
    {
        bal: { name: '木の',   power: 10, bias: { atk: 1.0, def: 1.0, int: 1.0, spd: 1.0 } },
        phy: { name: '重石の', power: 10, bias: { atk: 1.3, def: 1.2, int: 0.6, spd: 0.8 } },
        mag: { name: '霊木の', power: 10, bias: { atk: 0.7, def: 0.8, int: 1.3, spd: 1.2 } }
    },
    // Rank 2 (Power: 20)
    {
        bal: { name: '鉄の',   power: 20, bias: { atk: 1.0, def: 1.0, int: 1.0, spd: 1.0 } },
        phy: { name: '重鉄の', power: 20, bias: { atk: 1.3, def: 1.3, int: 0.7, spd: 0.9 } },
        mag: { name: '魔銀の', power: 20, bias: { atk: 0.6, def: 0.8, int: 1.4, spd: 1.3 } }
    },
    // Rank 3 (Power: 35)
    {
        bal: { name: '鋼の',   power: 35, bias: { atk: 1.0, def: 1.0, int: 1.0, spd: 1.0 } },
        phy: { name: '剛鋼の', power: 35, bias: { atk: 1.4, def: 1.4, int: 0.6, spd: 0.8 } },
        mag: { name: '魔晶の', power: 35, bias: { atk: 0.5, def: 0.7, int: 1.5, spd: 1.3 } }
    },
    // Rank 4 (Power: 55)
    {
        bal: { name: 'ミスリルの', power: 55, bias: { atk: 1.0, def: 1.0, int: 1.0, spd: 1.0 } },
        phy: { name: '巨人の',     power: 55, bias: { atk: 1.5, def: 1.5, int: 0.5, spd: 0.7 } },
        mag: { name: '妖精の',     power: 55, bias: { atk: 0.4, def: 0.6, int: 1.6, spd: 1.4 } }
    },
    // Rank 5 (Power: 80)
    {
        bal: { name: 'オリハルコンの', power: 80, bias: { atk: 1.0, def: 1.0, int: 1.0, spd: 1.0 } },
        phy: { name: 'アダマンタイトの', power: 80, bias: { atk: 1.6, def: 1.6, int: 0.5, spd: 0.8 } },
        mag: { name: '世界樹の',       power: 80, bias: { atk: 0.5, def: 0.7, int: 1.7, spd: 1.5 } }
    }
];

// 必殺技ロジック定義 (Weapon Arts)
const WEAPON_ARTS_LOGIC = {
    SWORD:  (player, enemy) => { return { type: 'damage', val: player.atk * 2.0 + (player.def * 2.0), msg: 'シールドバッシュ！' }; },
    AXE:    (player, enemy) => { return { type: 'damage', val: player.atk * 2.0 + (player.maxHp * 0.2), msg: 'グランドブレイカー！' }; },
    KATANA: (player, enemy) => { return { type: 'multi_hit', val: Math.floor(player.atk * 1.4), count: 3, msg: '三段斬り！' }; },
    WAND:   (player, enemy) => { return { type: 'magic_burst', val: Math.floor(player.int * 1.5), msg: 'マジックバースト！' }; },
    BOOK:   (player, enemy) => { return { type: 'damage', val: player.int * 1.2 + (player.spd * 3.0), msg: '高速詠唱！' }; },
    CANNON: (player, enemy) => { return { type: 'damage', val: (player.atk + player.int) * 1.6, msg: '魔導砲発射！' }; },
    SHIELD: (player, enemy) => { return { type: 'damage', val: player.def * 2.5, msg: '鉄壁の突進！' }; },
    NONE:   (player, enemy) => { return { type: 'damage', val: player.atk * 2.0, msg: '正拳突き！' }; }
};

// 敵の思考ルーチン定義
const ENEMY_ROUTINES = {
    // --- 弱い敵 (Weak) : 序盤のみ ---
    WEAK_A: { type: 'weak', id: 'w_basic', desc: '攻撃、様子見のみ' },
    WEAK_B: { type: 'weak', id: 'w_aggressive', desc: '毎ターン攻撃のみ' },
    WEAK_C: { type: 'weak', id: 'w_cycle', desc: '様子見と強撃を交互に行う' },
    WEAK_D: { type: 'weak', id: 'w_guard', desc: '攻撃、防御のみ' },

    // --- ふつうの敵 (Normal) : 中盤以降 ---
    NORMAL_A: { type: 'normal', id: 'n_random', desc: '攻撃、様子見、強撃をランダム' },
    NORMAL_B: { type: 'normal', id: 'n_tough', desc: '毎ターン攻撃（HP補正あり）', statMod: { hp: 1.3 } },
    NORMAL_C: { type: 'normal', id: 'n_status', desc: '2ターン目以降ランダムで状態異常（1種固定）' },
    NORMAL_D: { type: 'normal', id: 'n_shrink_low', desc: '4ターン目に低確率縮小化' },

    // --- 強い敵 (Strong) : 深層以降 ---
    STRONG_A: { type: 'strong', id: 's_heavy', desc: '強撃と様子見（強撃多め）' },
    STRONG_B: { type: 'strong', id: 's_first_status', desc: '1ターン目に確定で状態異常' },
    STRONG_C: { type: 'strong', id: 's_elite', desc: '毎ターン攻撃（HP/ATK補正あり）', statMod: { hp: 1.5, atk: 1.2 } },
    STRONG_D: { type: 'strong', id: 's_shrink_mid', desc: '3ターン目に中確率縮小化' },
    STRONG_E: { type: 'strong', id: 's_guard_heavy', desc: '防御と強撃を交互' },
    STRONG_F: { type: 'strong', id: 's_fixed_combo', desc: '固定コンボ（攻撃→必中縮小→強撃→解除→攻撃...）' }
};

// --- 特殊アイテム定義 ---
const ACCESSORY_PROOF_OF_LIBERATION = {
    id: 'acc_liberation_proof',
    name: '解放の証',
    type: 'accessory', // システム互換用
    category: 'accessory',
    tier: 'legendary',
    plusValue: 0,
    desc: '【常時脱衣】INT/SPD+50%UP。縮小以外の状態異常無効。',
    isLiberationProof: true 
};

// 魔法陣データ定義
const MAGIC_CIRCLE_DATABASE = [
    // --- ステータス強化系 ---
    { id: 'mc_hp_up', name: '生命の魔法陣', desc: '最大HP+20%', type: 'stat_mult', stat: 'hp', value: 1.2 },
    { id: 'mc_atk_up', name: '剛力の魔法陣', desc: 'ATK+20%', type: 'stat_mult', stat: 'atk', value: 1.2 },
    { id: 'mc_def_up', name: '守護の魔法陣', desc: 'DEF+20%', type: 'stat_mult', stat: 'def', value: 1.2 },
    { id: 'mc_int_up', name: '魔導の魔法陣', desc: 'INT+20%', type: 'stat_mult', stat: 'int', value: 1.2 },
    { id: 'mc_spd_up', name: '疾風の魔法陣', desc: 'SPD+50%', type: 'stat_mult', stat: 'spd', value: 1.5 },
    { id: 'mc_evasion', name: '幻影の魔法陣', desc: '回避率+10%', type: 'evasion_add', value: 10 },

    // --- 縮小・INT強化系 (小人の留め針と競合) ---
    { id: 'mc_shrink_int_1', name: '小人の魔法陣(Lv1)', desc: '縮小Lv1下限。INT+20%。(留め針優先)', type: 'shrink_int', minLevel: 1, intMult: 1.2 },
    { id: 'mc_shrink_int_2', name: '小人の魔法陣(Lv2)', desc: '縮小Lv2下限。INT+40%。(留め針優先)', type: 'shrink_int', minLevel: 2, intMult: 1.4 },
    { id: 'mc_shrink_int_3', name: '小人の魔法陣(Lv3)', desc: '縮小Lv3下限。INT+60%。(留め針優先)', type: 'shrink_int', minLevel: 3, intMult: 1.6 },

    // --- ドロップ補正系 ---
    { id: 'mc_loot_plus', name: '鍛冶の魔法陣', desc: 'ドロップする装備の補正値が+1される', type: 'loot_plus_mod', value: 1 },
    { id: 'mc_rate_weapon', name: '剣の魔法陣', desc: '勝利時、武器のドロップ率アップ', type: 'drop_rate_mod', target: 'weapon' },
    { id: 'mc_rate_armor', name: '盾の魔法陣', desc: '勝利時、防具のドロップ率アップ', type: 'drop_rate_mod', target: 'armor' },
    { id: 'mc_rate_accessory', name: '指輪の魔法陣', desc: '勝利時、装飾品のドロップ率アップ', type: 'drop_rate_mod', target: 'accessory' },
    { id: 'mc_rate_mc', name: '星の魔法陣', desc: '勝利時、魔法陣のドロップ率アップ', type: 'drop_rate_mod', target: 'magic_circle' },
    { id: 'mc_win_card', name: 'カードの魔法陣', desc: '勝利時、20%で装備の代わりにカードを入手', type: 'win_card_loot', chance: 0.2 },
    { id: 'mc_skip_floor', name: '転送の魔法陣', desc: '勝利時、10%で階層をさらに+1進む', type: 'win_skip_floor', chance: 0.1 },

    // --- 戦闘開始時: 状態異常付与 ---
    { id: 'mc_start_poison', name: '毒の魔法陣', desc: '戦闘開始時、自身が【毒】になる', type: 'battle_start_status', status: 'poison' },
    { id: 'mc_start_confusion', name: '混沌の魔法陣', desc: '戦闘開始時、自身が【混乱】になる', type: 'battle_start_status', status: 'confusion' },
    { id: 'mc_start_distraction', name: '忘却の魔法陣', desc: '戦闘開始時、自身が【放心】になる', type: 'battle_start_status', status: 'distraction' },
    { id: 'mc_start_fear', name: '恐怖の魔法陣', desc: '戦闘開始時、自身が【恐怖】になる', type: 'battle_start_status', status: 'fear' },
    { id: 'mc_start_petri', name: '石の魔法陣', desc: '戦闘開始時、自身が【石化】になる', type: 'battle_start_status', status: 'petrification' },
    { id: 'mc_start_strip', name: '露出の魔法陣', desc: '戦闘開始時、自身が【脱衣】になる', type: 'battle_start_status', status: 'undressing' },
    
    // --- 戦闘開始時: 縮小操作 ---
    { id: 'mc_start_shrink_plus', name: '縮小の魔法陣', desc: '戦闘開始時、縮小Lv+1', type: 'battle_start_shrink', value: 1 },
    { id: 'mc_start_shrink_minus', name: '拡大の魔法陣', desc: '戦闘開始時、縮小Lv-1', type: 'battle_start_shrink', value: -1 },

    // --- 戦闘開始時: その他 ---
    { id: 'mc_start_barrier', name: '障壁の魔法陣', desc: '戦闘開始時、ATK50%分の防壁を獲得', type: 'start_barrier_atk', value: 0.5 },
    { id: 'mc_start_heal', name: '治癒の魔法陣', desc: '戦闘開始時、HPが50%回復', type: 'start_heal', value: 0.5 },

    // --- 特殊効果・デメリット ---
    { id: 'mc_status_atk_plus', name: '逆境の魔法陣', desc: '状態異常中、通常攻撃回数+1', type: 'status_attack_plus' },
    { id: 'mc_trade_regen', name: '代償の魔法陣', desc: '最大HP-50%、ターン終了時HP10%回復', type: 'trade_off_regen', hpMult: 0.5, regen: 0.1 },
    { id: 'mc_discard', name: '忘却の魔法陣', desc: 'ターン終了時、手札をランダムに1枚捨てる', type: 'turn_end_discard' },
    { id: 'mc_gamble_atk', name: '賭博の魔法陣', desc: '通常攻撃時、50%でダメ0、50%でダメ2倍', type: 'attack_gamble' },

    // --- 武器シナジー ---
    { id: 'mc_syn_sword', name: '剣聖の魔法陣', desc: '剣装備時、ATK+30%', type: 'weapon_synergy', wType: '剣', stats: { atkMult: 1.3 } },
    { id: 'mc_syn_axe', name: '狂戦士の魔法陣', desc: '斧装備時、攻撃が確率でクリティカル(1.5倍)になる', type: 'weapon_synergy', wType: '斧', effect: 'critical' },
    { id: 'mc_syn_katana', name: '侍の魔法陣', desc: '刀装備時、回避成功時にATK反撃', type: 'weapon_synergy', wType: '刀', effect: 'counter' },
    { id: 'mc_syn_wand', name: '魔女の魔法陣', desc: '杖装備時、INT+50%/HP-10%/回避-10%', type: 'weapon_synergy', wType: '杖', stats: { intMult: 1.5, hpMult: 0.9, evasionAdd: -10 } },
    { id: 'mc_syn_book', name: '賢者の魔法陣', desc: '書装備時、防壁がないなら20%で被ダメ0', type: 'weapon_synergy', wType: '書', effect: 'barrier_chance' },
    { id: 'mc_syn_cannon', name: '砲手の魔法陣', desc: '魔導砲装備時、ATKとINT+20%', type: 'weapon_synergy', wType: '魔導砲', stats: { atkMult: 1.2, intMult: 1.2 } },
    { id: 'mc_syn_shield', name: '城壁の魔法陣', desc: '盾装備時、DEF+30%、ターン終了時防壁1.2倍', type: 'weapon_synergy', wType: '大盾', stats: { defMult: 1.3 }, effect: 'shield_boost' },

    // --- 装備なしシナジー ---
    { id: 'mc_naked_atk', name: '野性の魔法陣', desc: '武器・防具未装備時、ATK/INT+100%', type: 'naked_synergy', mode: 'offensive' },
    { id: 'mc_naked_def', name: '鉄皮の魔法陣', desc: '武器・防具未装備時、HP/DEF+100%', type: 'naked_synergy', mode: 'defensive' },
    
    // --- 完全ソロシナジー ---
    { id: 'mc_solo_god', name: '孤高の魔法陣', desc: 'これ以外全未装備時、状態異常無効/HP.INT+200%/ATK.DEF-100%/手札+1', type: 'solo_synergy' },

    // --- Chaos Synergy ---
    { id: 'mc_chaos_free', name: '無秩序の魔法陣', desc: 'HP-30%。混沌抽選+3。混沌魔法のHP消費コストが0になる', type: 'chaos_cost_zero', stats: { hpMult: 0.7 } },
    { id: 'mc_chaos_death', name: '終焉の魔法陣', desc: 'DEF-100%。混沌抽選+8。「何も起こらない」時、低確率で敵を即死させる', type: 'chaos_death_gamble', stats: { defMult: 0 } },

    { id: 'mc_curse_heal', name: '報復の泉', type: 'magic_circle', desc: 'HP回復時、回復量分の呪いを付与する。', curseOnHeal: true },
{ id: 'mc_curse_arts', name: '怨念の刃', type: 'magic_circle', desc: '必殺技ダメージの0.5倍の呪いを与える。', curseOnArts: 0.5 },
    // --- 膨張関連 ---
    {
        id: 'mc_auto_expand',
        name: '育成の魔法陣',
        desc: 'ターン終了時、脱衣状態なら膨張Lv+1',
        type: 'auto_expand'
    },
    {
        id: 'mc_expand_multi_hit',
        name: '千手観音の魔法陣',
        desc: '通常攻撃回数が膨張Lv分だけ追加される',
        type: 'expansion_multi_hit'
    },
    {
        id: 'mc_prevent_expansion',
        name: '抑制の魔法陣',
        desc: '脱衣時、回避率+20%。ただし膨張状態にならなくなる',
        type: 'prevent_expansion',
        evasionAdd: 20
    }
,
// --- 連打イベント報酬 ---
{ 
    id: 'mc_click_swap', 
    name: '反転の魔法陣', 
    type: 'magic_circle', 
    desc: 'ATKとINTの値を入れ替える(最終計算時)。', 
    isUnique: true, 
    clickReward: true 
},
{ 
    id: 'mc_click_fixed', 
    name: '固定の魔法陣', 
    type: 'magic_circle', 
    desc: '変性Lv下限3固定。縮小/膨張/脱衣のステータスデメリットを無効化。', 
    isUnique: true, 
    clickReward: true 
}
];

// ==========================================
// 縮小化関連 (要: 縮小Lv > 0)
// ==========================================
CARD_DATABASE.push(
    {
        id: 'magic_shrink_grow_atk',
        name: 'リトルパワー',
        type: 'skill_custom',
        cost: 1,
        desc: '縮小化Lv-1。3ターンの間ATKが上昇(大)。(縮小化していないと不発)',
        effect: (user, target) => {
            if (user.shrinkLevel <= 0) return { msg: "縮小化していないため不発！" };
            
            user.shrinkLevel = Math.max(0, user.shrinkLevel - 1);
            
            user.addBuff({
                type: 'stat_up',
                buffStats: { atkScale: 0.5 }, // +50%
                duration: 3,
                name: '巨大化の余韻',
                desc: 'ATK大幅上昇'
            });
            
            return { msg: "体を戻し、溢れるエネルギーを攻撃力に変えた！" };
        }
    },
    {
        id: 'magic_shrink_barrier',
        name: 'マナコクーン',
        type: 'skill_custom',
        cost: 2,
        desc: '縮小化を全解除し、ATKとレベルに応じた防壁を獲得。(縮小化していないと不発)',
        effect: (user, target) => {
            if (user.shrinkLevel <= 0) return { msg: "縮小化していないため不発！" };
            
            const lv = user.shrinkLevel;
            const barrierVal = Math.floor(user.atk * lv * 1.5); // ATK x Lv x 1.5
            user.shrinkLevel = 0;
            user.barrier = (user.barrier || 0) + barrierVal;
            
            return { msg: `縮小化を解除し、魔力の繭を展開！ 防壁+${barrierVal}` };
        }
    },
    {
        id: 'magic_shrink_heal',
        name: 'メタボリズム',
        type: 'skill_custom',
        cost: 3,
        desc: '縮小化を全解除し、HP大回復＆状態異常解除。(縮小化していないと不発)',
        effect: (user, target) => {
            if (user.shrinkLevel <= 0) return { msg: "縮小化していないため不発！" };
            
            const healVal = Math.floor(user.maxHp * 0.5); // 50%回復
            user.shrinkLevel = 0;
            user.heal(healVal);
            
            if (user.currentStatus) {
                user.clearAllStatus();
                return { msg: `代謝を活性化！ HP+${healVal}、状態異常を克服した！` };
            }
            return { msg: `代謝を活性化！ HP+${healVal}` };
        }
    },
    {
        id: 'magic_shrink_deep_dodge',
        name: 'ミクロ回避',
        type: 'skill_custom',
        cost: 2,
        desc: '縮小化Lv+1。次のターンまで回避率+100%。(縮小化していないと不発)',
        effect: (user, target) => {
            if (user.shrinkLevel <= 0) return { msg: "縮小化していないため不発！" };
            
            user.shrinkLevel = Math.min(3, user.shrinkLevel + 1);
            
            user.addBuff({
                type: 'evasion_up',
                val: 100,
                duration: 1,
                name: 'ミクロ回避',
                desc: '回避率+100%'
            });
            
            return { msg: "さらに小さくなり、攻撃の隙間に入り込んだ！ (回避率+100%)" };
        }
    },

    // ==========================================
    // 混沌 (Chaos)
    // ==========================================
    {
        id: 'magic_chaos_1',
        name: 'カオス・ワン',
        type: 'skill_custom',
        cost: 1,
        desc: '何が起こるか分からない「混沌」の効果が1つ発生する',
        effect: (user, target, battle) => {
            battle.executeChaos(1);
            return { msg: "混沌の扉が開く……！" };
        }
    },
    {
        id: 'magic_chaos_2',
        name: 'カオス・ブラッド',
        type: 'skill_custom',
        cost: 0,
        desc: 'HP5%を消費し、「混沌」の効果が2つ発生する',
        effect: (user, target, battle) => {
            const cost = Math.floor(user.maxHp * 0.05);
            
            // ▼ 追加: コスト踏み倒し判定
            let payCost = true;
            if (battle.equipment.magic_circle && battle.equipment.magic_circle.passive.type === 'chaos_cost_zero') {
                payCost = false;
            }

            if (payCost) {
                if (user.hp <= cost) return { msg: "HPが足りない！" };
                user.takeDamage(cost);
            } else {
                // コストなし演出
            }
            
            battle.executeChaos(2);
            return { msg: payCost ? `血を代償に、より深い混沌を招く！ (HP-${cost})` : `魔法陣が代償を肩代わりした！ (コスト0)` };
        }
    },
    {
        id: 'magic_chaos_3',
        name: 'カオス・アビス',
        type: 'skill_custom',
        cost: 0,
        desc: 'HP10%を消費し、「混沌」の効果が3つ発生する',
        effect: (user, target, battle) => {
            const cost = Math.floor(user.maxHp * 0.10);

            let payCost = true;
            if (battle.equipment.magic_circle && battle.equipment.magic_circle.passive.type === 'chaos_cost_zero') {
                payCost = false;
            }

            if (payCost) {
                if (user.hp <= cost) return { msg: "HPが足りない！" };
                user.takeDamage(cost);
            }
            
            battle.executeChaos(3);
            return { msg: payCost ? `命を削り、深淵の混沌を解き放つ！ (HP-${cost})` : `魔法陣が代償を飲み込んだ！ (コスト0)` };
        }
    },

    // ==========================================
    // 膨張 (Expansion)
    // ==========================================
    // 1. エクスパンション・ボルト (INT攻撃 + 膨張/脱衣)
    {
        id: 'magic_expand_bolt',
        name: 'エクスパンション・ボルト',
        type: 'skill_custom',
        cost: 1,
        desc: 'INTダメージ。【脱衣/膨張】なら膨張Lv+1。それ以外なら【脱衣】になる',
        effect: (user, target, battle) => {
            const dmg = Math.floor(user.int * 1.5);
            target.takeDamage(dmg);

            // ▼ 修正: 解放状態(isLiberated)も明示的に条件に加える
            if (user.hasStatus('undressing') || user.isLiberated) {
                battle.processExpansion(1);
                return { msg: `魔力が身体に充填される！ ${dmg}ダメージ！` };
            } else {
                battle.processForceStrip();
                return { msg: `衣服を弾き飛ばして攻撃！ ${dmg}ダメージ！` };
            }
        }
    },
    // 2. マッシブ・ブレイク (ATK防御無視 + 膨張)
    {
        id: 'skill_massive_break',
        name: 'マッシブ・ブレイク',
        type: 'skill_custom',
        cost: 2,
        desc: '防御無視ダメージ。【脱衣/膨張】なら膨張Lv+1。(それ以外は不発)',
        effect: (user, target, battle) => {
            // ▼ 修正
            if (!user.hasStatus('undressing') && !user.isLiberated) return { msg: "脱衣状態ではないため力が十分に出ない……" };
            const dmg = Math.floor(user.atk * 1.5);
            target.takeDamage(dmg, true); // true=防御無視
            battle.processExpansion(1);
            return { msg: `質量を乗せた重い一撃！ ${dmg}ダメージ！` };
        }
    },
    // 3. 転換：縮小→膨張
    {
        id: 'magic_convert_shrink_to_grow',
        name: '反転術式：膨張',
        type: 'skill_custom',
        cost: 0,
        desc: '縮小Lvを全て解除し、その分だけ膨張Lvを加算する',
        effect: (user, target, battle) => {
            if (user.shrinkLevel <= 0) return { msg: "縮小化していない！" };
            const lv = user.shrinkLevel;
            user.shrinkLevel = 0;
            if (!user.hasStatus('undressing') && !user.isLiberated) battle.processForceStrip();
            battle.processExpansion(lv);
            return { msg: `縮小の呪いを反転させ、肉体を成長させた！` };
        }
    },
    // 4. 転換：膨張→縮小
    {
        id: 'magic_convert_grow_to_shrink',
        name: '反転術式：縮小',
        type: 'skill_custom',
        cost: 0,
        desc: '膨張Lvを全て解除し、その分だけ縮小Lvを加算する',
        effect: (user, target, battle) => {
            if (user.expansionLevel <= 0) return { msg: "膨張していない！" };
            const lv = user.expansionLevel;
            user.expansionLevel = 0; // 一旦0に
            battle.updateCharacterSprite(); // 解除更新
            if (!user.hasStatus('undressing') && !user.isLiberated) battle.processForceStrip();
            
            user.shrinkLevel = Math.min(3, user.shrinkLevel + lv);
            return { msg: `過剰なエネルギーを圧縮し、体を小さくした！` };
        }
    },
    // 5. 肉体活性
    {
        id: 'skill_body_activate',
        name: '肉体活性',
        type: 'skill_custom',
        cost: 1,
        desc: '膨張Lv × ATK30%分の防壁とHP回復を行う',
        effect: (user, target, battle) => {
            const lv = user.expansionLevel;
            if (lv <= 0) return { msg: "膨張していないため効果が薄い……" };

            const val = Math.floor(user.atk * lv * 0.3);
            user.heal(val);
            user.barrier = (user.barrier || 0) + val;
            return { msg: `活性化した肉体が再生する！ HP+${val}, 防壁+${val}` };
        }
    },
    // 6. ギガント・バースト (フィニッシャー)
    {
        id: 'skill_gigant_burst',
        name: 'ギガント・バースト',
        type: 'skill_custom',
        cost: 3,
        desc: '膨張を全解除し、ATK特大ダメージを与える',
        effect: (user, target, battle) => {
            if (user.expansionLevel <= 0) return { msg: "膨張していない！" };
            
            const lv = user.expansionLevel;
            const dmg = Math.floor(user.atk * (2.0 + lv)); // 倍率: 3倍, 4倍, 5倍
            
            user.expansionLevel = 0;
            battle.updateCharacterSprite();
            // 脱衣は維持(仕様)

            target.takeDamage(dmg);
            return { msg: `膨張したエネルギーを一気に放出！ ${dmg}のダメージ！` };
        }
    }
);

const FLAVOR_EVENT_DATA = {
    // --- A. 汎用・日常：ポジティブ (Normal: Positive) ---
    flavor_normal_expansion_positive: [
        {
            "text": "軽快な足取りでダンジョンの通路を進む。妖精の機嫌はすこぶる良さそうだ。",
            "dialogue": "ふふ～ん♪ ……あ、鼻歌が出てました。今日のダンジョンはなんだか冒険日和ですねっ！"
        },
        {
            "text": "立ち止まって大きく息を吸い込む。淀んだ空気の中にも、微かな自然の息吹を感じ取った。",
            "dialogue": "深呼吸すると、森の香りがする気がします。よし、今日も張り切っていきましょう！"
        },
        {
            "text": "通路の曲がり角からそっと顔を覗かせる。妖精特有の勘が働いたようだ。",
            "dialogue": "この角を曲がったら、すごいお宝がある予感！ ……私の勘、たまに当たるんですよ？"
        },
        {
            "text": "羽をパタパタと羽ばたかせ、キラキラと輝く光の粒子を周囲に振りまく。",
            "dialogue": "羽の調子もバッチリです。キラキラの鱗粉を撒きながら、優雅に進みましょう～。"
        }
    ],

    // --- B. 縮小化・全体：ポジティブ (Shrink: Positive) ---
    flavor_shrink_general_positive: [
        {
            "text": "空中でくるりと宙返りをする。体が小さくなった分、風を切る感覚が心地よい。",
            "dialogue": "体が小さいと、空気抵抗が少なくてスイスイ動けますね！ スピードなら誰にも負けません！"
        },
        {
            "text": "敵の攻撃が大振りに見える。今のサイズなら、ほんの少し動くだけで回避できそうだ。",
            "dialogue": "敵の攻撃なんて、今の私にはスローモーションに見えます。……当たらなければどうということはない、です！"
        },
        {
            "text": "落ちていた木の実のかけらを見つめる。今のサイズなら、これ一つで満腹になれそうだ。",
            "dialogue": "このサイズなら、食費も少なくて済みそうですね。コスパ最強の冒険者かも？"
        },
        {
            "text": "壁に空いた小さなひび割れを覗き込む。普段なら気にも留めない隙間が、今は立派な道に見える。",
            "dialogue": "普段は見えない隙間も、今の私には立派な隠し通路です。探検隊、出発ーっ！"
        }
    ],

    // --- C. 縮小化・レベル別：ポジティブ (Shrink Levels: Positive) ---
    
    // Lv1: 小人 (Small)
    flavor_shrink_lv1_positive: [
        {
            "text": "足元に生える雑草が、今の視点では腰の高さまである。植物の間を縫うように歩く。",
            "dialogue": "お花畑の中を歩いてるみたいで、ちょっとメルヘンな気分です♪"
        },
        {
            "text": "地面に落ちていた小さな石英が、目線の高さでキラリと光った。",
            "dialogue": "背伸びしなくても、地面のキラキラした石を見つけられました。ラッキー！"
        },
        {
            "text": "ショーウィンドウを見るように自分の手足を確認する。ミニチュアのような可愛らしさがある。",
            "dialogue": "小さくて可愛いって言われるのも、悪くないかな？ えへへ。"
        }
    ],

    // Lv2: 手のひら (Tiny)
    flavor_shrink_lv2_positive: [
        {
            "text": "巨大な葉っぱの上に飛び乗り、その弾力を楽しむようにジャンプした。",
            "dialogue": "わぁっ！ 葉っぱの上がトランポリンみたいです！ ぽよん、ぽよんっ！"
        },
        {
            "text": "徘徊するモンスターの足の間を、風のように素早く駆け抜ける。",
            "dialogue": "敵の足元をすり抜けるなんて、忍者みたいでカッコイイかも！ ニンニン！"
        },
        {
            "text": "葉先に溜まった水滴が、今のサイズでは巨大な水晶玉のように輝いて見える。",
            "dialogue": "見てください（誰もいないけど）、水滴が宝石みたいに輝いてます！ 特等席で見放題ですね！"
        }
    ],

    // Lv3: 豆粒 (Micro)
    flavor_shrink_lv3_positive: [
        {
            "text": "あまりに小さいため、敵はおろかダンジョンの罠すらも彼女を感知できていないようだ。",
            "dialogue": "ここまで小さいと、逆に無敵な気がしてきました。誰にも見つからない「ステルス妖精」です！"
        },
        {
            "text": "ダンジョンの微かな空気の流れに身を任せ、綿毛のようにふわふわと漂う。",
            "dialogue": "風に乗ってふわふわ～♪ 自分で歩かなくていいから楽ちんですねっ！"
        },
        {
            "text": "床の細かな凸凹すらも、今の彼女にとっては壮大な山脈や渓谷に見えている。",
            "dialogue": "世界の全てが巨大なアトラクションです！ さあ、次はどの大冒険に挑みましょうか！"
        }
    ],

    // --- D. 解放の証・脱衣：ポジティブ (Liberation: Positive) ---
    flavor_liberation_stripped_positive: [
        {
            "text": "衣服を一切纏わぬ体で、思い切り手足を伸ばす。空気が肌を直接撫でていく。",
            "dialogue": "ん～っ！ 手足を思いっきり伸ばして深呼吸！ 服がないって、こんなに自由なんですね！"
        },
        {
            "text": "汚れる服がないことを前向きに捉え、剥き出しの肌で堂々と歩き出す。",
            "dialogue": "洗濯物の心配をしなくていいのは、ある意味エコかもしれません。……ポジティブすぎますか？"
        },
        {
            "text": "遮るものがない肌が、ダンジョンの魔力に反応して微かに発光しているように見える。",
            "dialogue": "肌が輝いて見えます……。これが「解放」の効果？ 私、今が一番キレイかも！"
        },
        {
            "text": "ありのままの姿で自然と調和する。その姿は妖精というより、野山を駆ける獣に近いかもしれない。",
            "dialogue": "自然体こそ最強のスタイル。野生動物さんが服を着ない理由が、なんとなく分かった気がします。"
        }
    ],

    // --- E. 膨張・汎用：ポジティブ (Expansion: Positive) ---
    flavor_expansion_general_positive: [
        {
            "text": "部分的に巨大化した体は重いが、その重量感が逆に頼もしい安定感を生んでいる。",
            "dialogue": "体が重いのは、それだけ魔力が詰まってる証拠です。今の私、タンク役もできちゃうかも？"
        },
        {
            "text": "たぷん、と膨らんだ柔らかい肢体を誇示するように、胸を張って（そして揺らして）歩く。",
            "dialogue": "ちょっとやそっとの攻撃じゃ、この「お肉」の鎧は貫けませんよ！ どーんと来てください！"
        },
        {
            "text": "自身の豊満すぎる体を触りながら、その柔らかさと包容力に満ちた感触を確かめる。",
            "dialogue": "ふふっ、なんだか包容力がアップした気がします。迷子のスライムがいれば、抱きしめてあげたい気分♪"
        },
        {
            "text": "身長は変わらないものの、体のボリュームが増したことで、精神的に大きく強くなった気がしている。",
            "dialogue": "視界が高い……わけじゃないのに、なんだか自分が大きくて強い存在になった自信が湧いてきます！"
        }
    ],

    // --- F. ダンジョン脱衣＋膨張：ポジティブ変換 (Accident: Positive Thinking) ---
    flavor_accident_expansion_lv1_positive: [
        {
            "text": "弾け飛んだ服の残骸を気にすることなく、一回り大きく育った肢体を見下ろす。",
            "dialogue": "わわっ、弾けちゃいました……。でも、窮屈な思いをするよりは、のびのび育ったほうが良いですよねっ！"
        },
        {
            "text": "急激な発育によって露わになった肌を、驚きと感心の入り混じった眼差しで見つめる。",
            "dialogue": "見てください、この成長期！ 私、まだまだ大きくなれるポテンシャルがあったんですね！"
        },
        {
            "text": "服を失った軽快さと、魔力で満ちた体の充実感に、思わず笑みがこぼれる。",
            "dialogue": "服はなくなっちゃいましたけど……その分、身軽になって魔力も全開です！ ピンチはチャンス！"
        }
    ],

    flavor_accident_expansion_lv2_positive: [
        {
            "text": "歩くたびに豊満な肉体が大きく揺れ、その質量が周囲の空気を震わせる。",
            "dialogue": "歩くたびにボヨンボヨンして……これ、敵を威嚇する効果とかないですかね？ 「迫力がすごいぞ！」みたいな！"
        },
        {
            "text": "バランスを崩して壁にぶつかるが、膨らんだ脂肪が衝撃を優しく吸収した。",
            "dialogue": "恥ずかしいですけど……この柔らかいクッションがあれば、転んでも痛くないのはメリットかも？"
        },
        {
            "text": "過剰なまでに育った体から、抑えきれない魔力の波動が陽炎のように立ち昇る。",
            "dialogue": "すごい……体の中から力が溢れてきます。見た目はアレですけど、今の私はスーパー妖精ですよっ！"
        }
    ],

    flavor_accident_expansion_lv3_positive: [
        {
            "text": "もはや隠すことも不可能なほどの巨大な肉体を、堂々と晒して闊歩する。",
            "dialogue": "ええい、もう恥ずかしがってる場合じゃありません！ このわがままボディで、ダンジョンを制圧しちゃいます！"
        },
        {
            "text": "身長よりも横幅がありそうなその姿は、豊穣を司る土着神のような威厳すら感じさせる。",
            "dialogue": "ここまで大きいと、逆に堂々としてるほうがカッコイイ気がしてきました。私は豊穣の女神様……なんてね♪"
        },
        {
            "text": "誰も見ていないダンジョンの奥底で、自身の肉体が揺れ動く感触を存分に楽しんでいる。",
            "dialogue": "誰にも見られてないなら、この姿を楽しむしかありません！ 揺れ動くお肉は、強者の証ですっ！"
        }
    ],

    // --- G. 解放の証＋膨張：超ポジティブ・陶酔 (Liberation+Expansion: Euphoria) ---
    flavor_liberation_expansion_lv1_positive: [
        {
            "text": "元より衣服を持たない体が、魔力を吸って素直に膨らんでいく様を愛おしそうに撫でる。",
            "dialogue": "ふふっ、遮るものがないから、体が喜んで大きくなってるみたい。もっと育っていいんですよ？"
        },
        {
            "text": "露わになった肌と、そこに蓄えられた膨大な魔力。その全てを自身の力として肯定する。",
            "dialogue": "最高の気分です！ 魔力も、この膨らんだ体も、全部私のもの。隠すなんてもったいない！"
        },
        {
            "text": "ダンジョンの風が、大きく育った胸や腰のカーブを優しく撫でるように吹き抜ける。",
            "dialogue": "風が肌を撫でて、膨らんだ胸やお尻を祝福してくれてます……。私、愛されてるなぁ♪"
        }
    ],

    flavor_liberation_expansion_lv2_positive: [
        {
            "text": "たぷん、と重たい音を立てて肉体が揺れる。その重さを、彼女は恍惚とした表情で受け入れる。",
            "dialogue": "たぷん、たぷん……♪ この重みを感じるたびに、自分が特別な存在になった気がしてゾクゾクします。"
        },
        {
            "text": "アンバランスなまでに肥大化した自身のシルエットを、まるで美術品のように見せつける。",
            "dialogue": "見て（誰もいないけど）！ この完璧なカーブ！ 芸術作品みたいで、うっとりしちゃいませんか？"
        },
        {
            "text": "物理的には支えきれないほどの質量を、溢れ出る魔力が内側から支えている。",
            "dialogue": "重力なんて気にしません。この溢れる魔力が、巨大な私を支えてくれてるんですから！"
        }
    ],

    flavor_liberation_expansion_lv3_positive: [
        {
            "text": "身長の倍ほどに膨れ上がった肉塊ごとき体で、ダンジョンの通路を我が物顔で進む。",
            "dialogue": "あはは！ 私、ダンジョンで一番大きくて強い存在になっちゃったかも！ 魔王様もビックリですよ！"
        },
        {
            "text": "歩くたびに巨大な腹部や臀部が地面や壁を擦るが、彼女はそれを誇らしげに感じている。",
            "dialogue": "地面を引きずるほどの質量……これぞ「大妖精」の極致！ 触れるもの皆、私の魅力で吹き飛ばしちゃえ～！"
        },
        {
            "text": "衣服にも、常識にも、物理法則にすら縛られず、ただ欲望のままに膨張する快感に浸る。",
            "dialogue": "幸せです……。服にも常識にも縛られず、ただ欲望のままに膨れ上がる……これ以上の快感なんてありませんっ！"
        }
    ]
};

const FLAVOR_EVENT_DATA_MIXED = {
    // ----------------------------------------------------------------
    // S:Lv1 (小人サイズ - 草花目線)
    // ----------------------------------------------------------------
    
    // S:Lv1 x E:Lv1 (程よい肉付き・マスコット的)
    flavor_shrink_lv1_expansion_lv1: [
        {
            "text": "少し背が縮んだことで、道端の花がパラソルのように見える。程よく育った肢体は、このサイズ感に見事に調和しているようだ。",
            "dialogue": "ふふっ、今の私、お人形さんみたいにバランスが良いかも？ 小さくてもメリハリがあるって、素敵ですよね。"
        },
        {
            "text": "肌に直接触れる風が心地よい。コンパクトになった体に、魔力がギュッと詰まって充実しているのを感じる。",
            "dialogue": "体が小さくなると、魔力の巡りが早くなる気がします。この可愛らしいフォルム、我ながら傑作かもしれません♪"
        }
    ],

    // S:Lv1 x E:Lv2 (重量感・安定)
    flavor_shrink_lv1_expansion_lv2: [
        {
            "text": "ダンジョンの隙間風が吹き抜けるが、低くなった重心と増した質量のおかげで、足元は驚くほど安定している。",
            "dialogue": "おっと、突風ですね。でも今の私には効きません！ このたっぷたぷの重みが、天然のアンカーになってくれてますから！"
        },
        {
            "text": "歩くたびに体が大きく揺れるが、小さくなった体にはそのリズムが心地よいゆりかごのように感じられる。",
            "dialogue": "小さくなったのに、歩くときの「ドスン」という感覚は倍増してます。ふふ、小さき巨人って感じで頼もしいですね。"
        }
    ],

    // S:Lv1 x E:Lv3 (過剰・厚み)
    flavor_shrink_lv1_expansion_lv3: [
        {
            "text": "草の間を通り抜けようとするが、規格外に育った胸と腰が草木を押し分けて進む形になる。",
            "dialogue": "あらら、ちょっと狭いですね。でも大丈夫、私の体は柔らかいので……むにゅっと通れば、道は開けるのです！"
        },
        {
            "text": "身長に対して横幅のボリュームが圧倒的だ。転んでも自身の肉体が分厚いクッションとなり、痛みなど皆無だろう。",
            "dialogue": "これだけお肉がついていると、防御力は最強かもしれません。小人サイズの柔らか戦車、出撃ですっ！"
        }
    ],

    // ----------------------------------------------------------------
    // S:Lv2 (手のひらサイズ - 昆虫目線)
    // ----------------------------------------------------------------

    // S:Lv2 x E:Lv1 (フィギュア・造形美)
    flavor_shrink_lv2_expansion_lv1: [
        {
            "text": "葉の上に溜まった水滴に、自身の姿が映り込む。精巧なフィギュアのような、完璧なプロポーションに見惚れてしまう。",
            "dialogue": "見てください（誰もいないけど）、この曲線美！ 小さいサイズの中に、美しさが凝縮されてます……芸術的だなぁ。"
        },
        {
            "text": "小さくなった手足に対し、女性的なラインが強調されている。ミニチュアサイズならではの愛らしさと妖艶さが同居している。",
            "dialogue": "小さいからって侮れませんよ？ このサイズだからこそ、体のラインが際立って……小悪魔的な魅力があると思いませんか？"
        }
    ],

    // S:Lv2 x E:Lv2 (重戦車・質量)
    flavor_shrink_lv2_expansion_lv2: [
        {
            "text": "進路上の小石にぶつかるが、膨張した肉体の質量が勝り、小石のほうが弾き飛ばされた。",
            "dialogue": "あはは！ 邪魔な小石も、今の私の「わがままボディ」の前では敵じゃありません。重いって強いことなんですね！"
        },
        {
            "text": "小さな羽では支えきれないほどの重さだが、地に足をつけて進む感覚には不思議な安心感がある。",
            "dialogue": "飛ぶのは諦めましたけど、この地面を踏みしめる感触も悪くありません。一歩一歩が、確かな前進です！"
        }
    ],

    // S:Lv2 x E:Lv3 (丸み・バウンド)
    flavor_shrink_lv2_expansion_lv3: [
        {
            "text": "手足の長さよりも体の厚みが勝っている。歩くよりも、その柔らかさを利用して弾むように移動するほうが効率的だ。",
            "dialogue": "よいしょ、よいしょ……あ、歩くより跳ねたほうが早いかも？ ぽよん、ぽよんっ！ ……これ、楽しいです！"
        },
        {
            "text": "苔むした岩の上で転がってみる。柔らかな肉体が衝撃を吸収し、どこまでも転がっていけそうだ。",
            "dialogue": "もう手足を使うのも面倒になっちゃいました。私はゴムボールの妖精……転がるだけで移動できるなんて、画期的すぎます！"
        }
    ],

    // ----------------------------------------------------------------
    // S:Lv3 (豆粒サイズ - 微細)
    // ----------------------------------------------------------------

    // S:Lv3 x E:Lv1 (水滴・プリッと感)
    flavor_shrink_lv3_expansion_lv1: [
        {
            "text": "極小サイズでありながら、その体はパンと張り詰めている。葉の上の水滴のように、表面張力で形を保っているかのようだ。",
            "dialogue": "今の私、指でつっついたら「ぷるん」って弾けちゃいそう。魔力が極限まで濃縮された、最高の一粒ですねっ。"
        },
        {
            "text": "風に乗ろうとするが、予想以上の密度があるため、ふわふわと漂うのではなく、ストンと着地する。",
            "dialogue": "おっとっと。小さいのに意外と重い……。中身が詰まってる証拠ですね。実の詰まった果実みたいで、美味しそうかも？"
        }
    ],

    // S:Lv3 x E:Lv2 (高密度・フィット)
    flavor_shrink_lv3_expansion_lv2: [
        {
            "text": "床の細かなひび割れに足を取られるが、柔らかく膨らんだ体が隙間にムギュッとフィットして、心地よいハマり具合だ。",
            "dialogue": "わぁ……この窪み、私の体型にジャストフィットです。包まれてる安心感がすごくて……ここを私の家にしちゃおうかな？"
        },
        {
            "text": "砂粒のようなサイズだが、その存在感は鉄球のように重い。ダンジョンの微細な塵を押しのけて進む。",
            "dialogue": "小さくても、私はここにいますよー！ ……この圧倒的な質量感、豆粒サイズになっても存在感が消せなくて困っちゃいますね。"
        }
    ],

    // S:Lv3 x E:Lv3 (肉球・球体)
    flavor_shrink_lv3_expansion_lv3: [
        {
            "text": "もはや手足のついた小さな肉球か、あるいはボールのようだ。重力に従ってコロコロと転がるのが最も自然な姿に見える。",
            "dialogue": "世界中が坂道に見えます～！ ころころ～っと。……ふふ、丸いって素晴らしいです。どこへでも滑らかに行けちゃいますから！"
        },
        {
            "text": "地面に吸い付くような圧倒的な接地感。どんな強風が吹いても、この球体状の妖精が吹き飛ばされることはないだろう。",
            "dialogue": "地面とお友達になっちゃいました。今の私は、ダンジョンの一部と言っても過言じゃありません。……動くのが億劫なわけじゃないですよ？"
        }
    ]
};

// ==========================================
// ▼ 追加データ: 興奮状態突入時フレーバー (Expansion Lv4 + Excited)
// ==========================================
const FLAVOR_EVENT_DATA_EXCITED = {
    // 興奮状態でダンジョンに突入した際の専用フレーバーイベント
    // text: 状況描写（客観） / dialogue: 妖精のセリフ（喘ぎ・独り言）
    excited_entry: {
        
        // ----------------------------------------------------------------
        // Lv0: 通常サイズ (Normal ~45cm)
        // 重力と戦いながら、壁や床に巨大な肉体を引きずって歩く
        // ----------------------------------------------------------------
        lv0: [
            {
                "text": "限界まで膨れ上がった胸が重力に引かれ、歩くたびにボヨンと大きく波打つ。",
                "dialogue": "あぅっ、んあぁっ♡ ……歩くだけで、揺れて……中身が、暴れちゃう……！"
            },
            {
                "text": "視界のほとんどが自身の肉色で埋め尽くされている。足元など到底見えない。",
                "dialogue": "はぁ、はぁ……。前が見えません……。でも、見えるのは……はち切れそうな私のお肉だけ……幸せぇ……♡"
            },
            {
                "text": "通路の壁に手をつくが、体の方が幅をとってしまい、擦れながら進むしかない。",
                "dialogue": "んくっ♡ 壁が……冷たくて……。擦れるたびに、ビクッてなっちゃう……。"
            },
            {
                "text": "限界まで薄くなった皮膚が、ダンジョンの空気の流れだけで過敏に反応し、細かく震えている。",
                "dialogue": "風が……痛い……っ。こんなに薄くなってるのに……触らないでぇ……イッちゃう……♡"
            },
            {
                "text": "重たい質量を引きずるように、よろめきながら通路を徘徊する。",
                "dialogue": "ズルッ、ズルッて……。私、引きずってる……。妖精なのに……ただの肉の塊みたい……。"
            },
            {
                "text": "体内に充満した魔力が逃げ場を求めて暴れ回り、全身が常に明滅している。",
                "dialogue": "熱い、熱いよぉ……！ 誰か、中身を出して……。このままだと、パンッて……弾けちゃう……！"
            },
            {
                "text": "モンスターの気配を感じるが、逃げるどころか、自分から晒すように胸を突き出す。",
                "dialogue": "あへぇ……。魔物さん……いますか？ 見て……今の私、こんなに無様で……美味しそうですよぉ……？"
            },
            {
                "text": "何もない平坦な道でつまずき、巨大な胸がクッションとなってボヨヨンと弾んだ。",
                "dialogue": "ひゃうっ！？ ……すごい、弾力……。転んでも痛くない……でも、振動で……頭がトロけそう……♡"
            },
            {
                "text": "自身の重みに耐えきれず、その場にへたり込む。床に肉が広がり、卑猥な音を立てた。",
                "dialogue": "ダメ……もう歩けない……。重すぎて……腰が抜けちゃった……。ここで休憩……しちゃお……♡"
            },
            {
                "text": "汗ばんだ肌同士が密着し、動くたびにヌチャ、と濡れた音が響く。",
                "dialogue": "んぅ……っ。自分の汗と、愛液で……ヌルヌルです……。気持ち悪いのに……ゾクゾクする……。"
            },
            {
                "text": "張り詰めた乳房の先端が、通路の壁にコツンと当たってしまった。",
                "dialogue": "あﾞっ♡ ……ぶつかった……っ！ 先っぽ、硬くなってるから……衝撃が、脳天まで……ッ！"
            },
            {
                "text": "ダンジョンの冷たい床に、火照りきった巨大な肉体を押し付けて涼をとる。",
                "dialogue": "ジューッて……音がしそう……。床、冷たくて気持ちいい……。もっと、押し付けたい……。"
            },
            {
                "text": "理性の光は瞳になく、ただ快楽と魔力の奔流に身を任せてフラフラと進む。",
                "dialogue": "次は……どっち？ こっちに行けば……もっと気持ちいいこと……あるかなぁ……？"
            },
            {
                "text": "巨大化した体はバランスが悪く、まるで酔っ払いのように千鳥足になっている。",
                "dialogue": "おっとっと……♡ 世界が回ってるぅ……。ふふ、私、魔力に酔っ払ってるみたい……。"
            },
            {
                "text": "あふれ出る母乳のような魔力が、ポタポタと地面に軌跡を描いている。",
                "dialogue": "あぁ……垂れてる……。勿体ない……。誰か、舐めとってくれませんか……？"
            }
        ],

        // ----------------------------------------------------------------
        // Lv1: 一回り小さい (Small ~30cm)
        // 草花が障害物となり、少しの段差が体を揺らす
        // ----------------------------------------------------------------
        lv1: [
            {
                "text": "腰ほどの高さの草が、膨張して敏感になった下腹部をカサカサと撫でる。",
                "dialogue": "ひゃんっ♡ 草が……股間をこすって……！ ダメ、そこは……薄くなってるのにぃ……！"
            },
            {
                "text": "少し小さくなった体に対し、膨張率は変わらないため、アンバランスさが際立っている。",
                "dialogue": "体が縮んだのに……胸だけ、そのまま……。これじゃ、歩く性器みたいですぅ……。"
            },
            {
                "text": "通路に突き出た木の枝が、パンパンに張った胸に食い込みそうになる。",
                "dialogue": "あぶなっ……！ ……んぅ、枝が……めり込んでる……。破れちゃう……突っつかないでぇ……。"
            },
            {
                "text": "段差を降りるだけで、全身の肉が大きく波打ち、彼女の思考を揺さぶる。",
                "dialogue": "ドスンッて……衝撃が……っ♡ ただの段差なのに……責められてるみたい……。"
            },
            {
                "text": "狭い通路を通ろうとするが、横幅がつかえてしまい、ムギュウと音を立てて押し通る。",
                "dialogue": "んぐぐ……っ♡ 狭い……壁が、お肉を搾り上げて……っ！ あぁっ、これ、イイッ♡"
            },
            {
                "text": "自分の足元が見えないため、小さな石ころを踏んでしまい、大きく体勢を崩した。",
                "dialogue": "あぁんっ！ ……もう、何も見えないの……。ただの肉風船が、ふわふわ浮いてるだけ……。"
            },
            {
                "text": "垂れ下がったツタが、張り詰めた肌に絡みつき、まるで拘束するように這う。",
                "dialogue": "やぁっ……ツタさん、離して……！ そんなに締め付けたら……中身が出ちゃうぅ……！"
            },
            {
                "text": "小さくなったことで、地面からの湿気や冷気をより身近に感じ、体が震える。",
                "dialogue": "下から……スースーする……。隠すものがないから……全部、曝け出しちゃってる……。"
            },
            {
                "text": "花の香りに混じって、自身の体から立ち昇る甘ったるい魔力の匂いに酔いしれる。",
                "dialogue": "ん～……♡ 私の匂い……すごい。熟しきった果実みたい……。食べごろ、ですよ？"
            },
            {
                "text": "風に吹かれると、体ごともっていかれそうになるが、重たい胸がアンカーになっている。",
                "dialogue": "ふわぁ……っ。飛ばされそう……でも、重たい……。このお肉が、私を縛り付けてる……。"
            },
            {
                "text": "水たまりに映る自分の姿を見る。それは妖精というより、異形の肉人形のようだ。",
                "dialogue": "見て……水鏡に映ってる……。あれが私？ ……ふふ、淫らな形……かわいい……♡"
            },
            {
                "text": "茂みの陰に隠れようとするが、巨大なピンク色の塊は到底隠れきれていない。",
                "dialogue": "隠れなきゃ……。でも、お尻も胸も……はみ出ちゃう。……見つかったら、犯されちゃうかな？"
            },
            {
                "text": "歩くのを諦め、四つん這いで進む。乳房が地面を擦り、新たな刺激を生む。",
                "dialogue": "ズルズル……っ♡ 地面とお友達……。擦れるたびに、ジンジンして……止まらないぃ……。"
            },
            {
                "text": "周囲の景色が少し大きく見えるが、それ以上に自身の体の主張が激しい。",
                "dialogue": "世界が大きいのか……私が大きいのか……もう分かんない。……気持ちいいから、どうでもいいか……♡"
            },
            {
                "text": "ふらふらと、何かに導かれるようにダンジョンの奥へと進んでいく。",
                "dialogue": "奥に行けば……もっと凄いことが待ってる……。本能が、そう言ってるの……。"
            }
        ],

        // ----------------------------------------------------------------
        // Lv2: 手のひらサイズ (Tiny ~12cm)
        // 質量のある物体として転がる。小石や水滴が刺激になる
        // ----------------------------------------------------------------
        lv2: [
            {
                "text": "小石が転がる砂利道。今の彼女には、その一つ一つが敏感な肌を攻める突起物に変わる。",
                "dialogue": "あひぃっ、んっ、くぅっ♡ ……石ころが……肌に食い込んで……っ！ 天然のマッサージ機だぁ……♡"
            },
            {
                "text": "バランスを崩し、ボールのようにコロコロと転がる。地面と全身が接吻する。",
                "dialogue": "きゃあぁっ～♡ 回る、回るぅ……！ 全身こすられて……目が回って……イッちゃうぅ！"
            },
            {
                "text": "天井から落ちてきた水滴が、張り詰めた胸の上で弾け、冷たい刺激を与える。",
                "dialogue": "ビクッてしたぁ♡ ……水滴、冷たいっ……。熱い体に、ジュッて染みるぅ……。"
            },
            {
                "text": "小さな虫が、巨大な肉の山（妖精）を見て、餌だと思って近寄ってきた。",
                "dialogue": "ん？ ……虫さん……？ 私のお肉、甘い匂いがする？ ……ふふ、齧ってみる……？"
            },
            {
                "text": "苔むした岩の上に乗り上げる。ヌルヌルとした感触が、粘膜のような肌に絡みつく。",
                "dialogue": "んぁ……っ。苔、ヌルヌルして……。まるで、ローション遊びしてるみたい……。"
            },
            {
                "text": "手足の短さと体の巨大さが相まって、起き上がりこぼしのように揺れ続ける。",
                "dialogue": "ゆらゆら……。起き上がれないよぉ……。誰か、突っついて……転がしてぇ……♡"
            },
            {
                "text": "隙間風が通り抜けるたび、手のひらサイズの肉体が小刻みに震える。",
                "dialogue": "寒い……熱い……っ。風が吹くだけで、乳首が立っちゃう……。見て、カチカチ……。"
            },
            {
                "text": "巨大なキノコの傘の下で雨宿りをするが、自身の体の方がよほどキノコのように見える。",
                "dialogue": "どっちがキノコか……分かりませんね。……私の方が、ずっと柔らかくて……えっちですよぉ？"
            },
            {
                "text": "自分の重みで、柔らかい土の地面に少しめり込んでいる。",
                "dialogue": "埋まっちゃう……。地面が、私を飲み込もうとしてる……。ふふ、地球とセックスしてるみたい……。"
            },
            {
                "text": "蜘蛛の巣が引っかかるが、今の彼女の質量と魔力熱の前では、糸など容易く溶けてしまう。",
                "dialogue": "んっ……ネバネバする……。蜘蛛さん、私を捕まえたいの？ ……残念、今の私は、もっとドロドロだよぉ……。"
            },
            {
                "text": "小さな体になっても、膨張した部分の感度は変わらず、むしろ凝縮されている。",
                "dialogue": "小さいのに……お肉いっぱい……。矛盾してる……。頭がおかしくなりそう……あへぇ♡"
            },
            {
                "text": "葉っぱの上を滑り台のように滑り落ちる。摩擦熱が股間を直撃した。",
                "dialogue": "シュルルって……っ♡ お股が……熱いっ！ 摩擦で……火がついちゃうぅ……！"
            },
            {
                "text": "遠くでモンスターの足音が聞こえる。震動が地面を伝わり、敏感な体を愛撫する。",
                "dialogue": "ドスン、ドスンって……響くぅ……♡ もっと……もっと強く足踏みしてぇ……！"
            },
            {
                "text": "自分の手では抱えきれない胸を、地面を使って支えながら這いずり回る。",
                "dialogue": "重たい荷物……運んでますぅ……。中身は、たっぷりの魔力と……欲求不満です……。"
            },
            {
                "text": "完全に理性が飛び、自身を「愛玩用の肉人形」だと認識し始めている。",
                "dialogue": "拾ってください……。手のひらサイズの、あぶらみな妖精……いりませんかぁ……？"
            }
        ],

        // ----------------------------------------------------------------
        // Lv3: 豆粒サイズ (Micro ~3cm)
        // 世界が巨大。埃や床の溝が、強烈な責め苦（快楽）に変わる
        // ----------------------------------------------------------------
        lv3: [
            {
                "text": "床の細かなひび割れに、膨らんだ肉の一部がムギュッと挟まってしまった。",
                "dialogue": "あぁっ♡ 挟まった……っ！ 床の溝に……お肉が吸われて……抜けないぃ……ッ！"
            },
            {
                "text": "舞い上がった埃が全身に付着する。微細な粒子のひとつひとつが、敏感な神経を刺激する。",
                "dialogue": "んくぅ……っ。埃が……くすぐったい……。全身、モゾモゾする……。誰か、舐めとってぇ……。"
            },
            {
                "text": "ダンジョンの冷たい風も、このサイズでは暴風となり、敏感な肌を叩きつける。",
                "dialogue": "風が……鞭みたいに……っ！ 痛い、けど……乳首、ビンビンに感じちゃう……！"
            },
            {
                "text": "一粒の砂利が、彼女にとっては巨大な岩のように、柔らかい腹部に食い込む。",
                "dialogue": "んグッ♡ ……石が、お腹にめり込んで……。内臓まで届きそう……あぁっ、深いぃ……。"
            },
            {
                "text": "巨大な（普通サイズの）アリの行列に遭遇する。彼らの触角が、興味深そうに彼女を撫でた。",
                "dialogue": "ひゃうっ！？ アリさん……触らないで……っ！ 私、餌じゃないよ……ただの、肉便器だよぉ……。"
            },
            {
                "text": "もはや歩くことは不可能。魔力を帯びたピンク色の肉球として、地面を転がり続ける。",
                "dialogue": "コロコロ……ころころ……。私、ボール……。快感を撒き散らす、汚いボールですぅ……♡"
            },
            {
                "text": "水たまりが、彼女にとっては巨大な湖。浅瀬で体が半分浸かり、ふやけていく。",
                "dialogue": "ちゃぷちゃぷ……。お水、冷たい……。火照った体……冷やしてぇ……ジュッてしてぇ……。"
            },
            {
                "text": "自分の心臓の音が、体内で反響して、それだけでイキそうになっている。",
                "dialogue": "トクン、トクンって……うるさいの……。自分が生きてるだけで……気持ちいいなんて……っ。"
            },
            {
                "text": "極小の体積に圧縮された魔力が、逃げ場を失って高熱を発している。",
                "dialogue": "小さいのに……中身パンパン……。密度すごいの……。爆発しちゃいそう……あへぇ……。"
            },
            {
                "text": "床のタイルの継ぎ目を、平均台のようにバランスを取りながら（肉を揺らしながら）進む。",
                "dialogue": "おっとっと……♡ 落ちたら……イッちゃうゲーム……。あ、落ちるっ……んあぁっ♡"
            },
            {
                "text": "遠くの松明の熱気だけで、皮膚が炙られるような刺激を感じる。",
                "dialogue": "熱い風……来るぅ……。焼かれちゃう……。トロトロに溶けちゃうよぉ……。"
            },
            {
                "text": "何かの種子が体に張り付いた。異物感が、狂った神経をさらに逆撫でする。",
                "dialogue": "んっ……何かツイてる……。取らないで……。ずっと、そこを刺激してて……。"
            },
            {
                "text": "自分が豆粒サイズであるという事実が、被虐的な興奮を極限まで高める。",
                "dialogue": "こんなに小さくて……こんなに淫乱で……。踏み潰されたら……中身、全部出ちゃうね……♡"
            },
            {
                "text": "地面の微細な振動から、ダンジョン全体の「呼吸」を感じ取っている。",
                "dialogue": "聞こえる……迷宮の鼓動……。私と、リズム合わせてる……？ ドクン、ドクン……。"
            },
            {
                "text": "完全に思考が融解し、ただの「反応する肉片」として、痙攣しながら存在している。",
                "dialogue": "あ、あ、あ……♡ もう、わかんない……。気持ちいい……それだけ……あはぁっ♡"
            }
        ]
    }
};

// ==========================================
// ▼ 追加データ: 連打イベント・膨張差分用
// ==========================================

// 連打イベント用データ (10回刻み)
const CLICK_EVENT_DIALOGUE = {
    // Phase 1: Normal
    count_10: { text: ["んっ？ ……今、空気がビリビリ震えたような……気のせいでしょうか？", "ひゃうっ！ ……なんだか、背筋がゾクゾクしました。風邪かな……？"], action: "shake" },
    count_20: { text: ["はぁ……っ。急に、体が熱くなって……。魔力の流れが、乱れてる……？", "くぅっ……お腹の奥が、熱い……。何かが溜まっていくみたいで……怖いです。"], action: "shake_strong" },

    // Phase 2: Strip (30回)
    count_30: { text: ["きゃあああっ！？ ふ、服が……弾け飛んじゃいました……ッ！ ま、魔力が溢れて……っ！"], event: "strip" },
    count_40: { text: ["うぅ……裸ん坊になっちゃった……。空気が肌に刺さるみたいに敏感で……じっとしてられません……。", "ダメ、見ないで……。肌が赤くなってる……。熱くて、ヒリヒリして……変な感じです……。"], action: "shake" },
    count_50: { text: ["んぐっ……！ まだ、まだ魔力が流れ込んでくる……！ 体が……きしんでる……！？", "はぁ、はぁ……っ！ 許容量オーバーです……ッ！ 中から突き上げられて……膨らいじゃう……ッ！"], action: "shake_strong" },

    // Phase 3: Expansion Lv1 (60回)
    count_60: { text: ["あ……っ！？ 胸が……お尻が……熱を持って、膨らんで……！ うそ、大きくなってる……！？"], event: "expand_1" },
    count_70: { text: ["皮膚が……パツパツに張って……痛い、でも……気持ちいい……。私、どうなっちゃうの……？", "んっ……。膨らんだところが、熱い……。魔力が詰まって、硬くなってる……。"], action: "shake" },
    count_80: { text: ["まだ……止まらない……！ もっと、もっと大きくなるって……体が疼いてる……！", "ふぅ……んっ……！ 膨張感が……快感に変わって……頭が、クラクラする……！"], action: "shake_strong" },

    // Phase 4: Expansion Lv2 (90回)
    count_90: { text: ["あぁぁ……ッ！ 重い、ドンッて……！ 急に、こんなに大きく……！ 立ってられないよぉ……！"], event: "expand_2" },
    count_100: { text: ["たぷん、たぷんって……揺れるたびに、中身が暴れて……んぁっ♡ ……変な声、出ちゃう……。", "もう、支えきれません……。魔力の重さで……私、潰されちゃいそう……あはっ……。"], action: "shake" },
    count_110: { text: ["熱い……熱いよぉ……。魔力が、指先までパンパンで……触れたら、弾けちゃいそう……。", "もう……どうにでもして……。膨らむのが……気持ちよすぎて……おかしくなるぅ……っ！"], action: "shake_strong" },

    // Phase 5: Expansion Lv3 (120回)
    count_120: { text: ["ひグッ！？ ……まんまる……。私、ボールみたいに……。視界が全部、お肉で埋まっちゃう……！"], event: "expand_3" },
    count_130: { text: ["はぁ……あぁ……。自分の胸に埋もれて……息ができない……。甘い匂いで、脳みそが溶ける……。", "ズンッ、ズンッて……子宮に響くの……。もっと……もっと膨らませて……魔力、注ぎ込んでぇ……♡"], action: "shake" },
    count_140: { text: ["あヒッ、イッ、イくっ……！ 皮が裂けちゃう……！ 限界、もう限界だよぉ……ッ！", "ダメ、もう入らない……ッ！ これ以上膨らんだら……私、弾けて死んじゃう……あぁッ、でもイイッ♡"], action: "shake_strong" },

    // Phase 6: Limit (150回)
    count_150: { text: ["あﾞあﾞあﾞぁぁぁーーッ♡♡♡ ……壊れ、ちゃった……。私、こんなに……おっきく……あはぁ……♡"], event: "expand_4" },

    // 打ち止めループ (10回ごと)
    limit_loop: [
        "はぁ、はぁ……。すごぉい……。顔より大きいおっぱいに埋もれて……私、世界一幸せな妖精かも……。",
        "んぅ……っ。ピクピクしてる……。これ以上膨らめないのに……体はまだ「欲しい」って言ってる……。",
        "もう動けません……。一生このまま、魔力の苗床になります……。だから、もっと……愛でて……？",
        "あへぇ……。見て、先端から……魔力がポタポタ垂れてるの……。搾ってください……誰かぁ……。",
        "トクン、トクン……。全身が心臓みたい……。触るだけでイッちゃいそう……あ、イッちゃう、イッちゃうっ♡",
        "重い……熱い……んふっ。この質量全部が、私の性感帯……。妖精の尊厳なんて、もういらないぁ……。",
        "頭がトロトロです……。何も考えられない……。ただ、揺らされて、喘ぐだけの……肉袋ですぅ……。",
        "……まだ、刺激するの？ ……鬼畜。……でも、そんな貴方も……好きぃ……んあぁっ♡"
    ]
};

//新コード
const RESET_DIALOGUE = {
    lv0: [
        "ふぅ……。今の、なんだったんでしょう？ 体の奥がちょっとだけ……疼いてます。",
        "もう……焦らさないでください。……え？ 私、今なんて……。",
        "あー、ドキドキした……。魔力の流れが止まって……少し、残念かも？"
    ],
    lv1: [
        "んっ……ふぅ。戻りましたけど……皮膚がまだ、引っ張られてる気がします……。",
        "はぁ……。体から熱が引いていく感覚……なんだか、ゾクゾクしました。",
        "よかった、元通りです。……でも、膨らんだ時の「張り」も、嫌いじゃなかった、かな……？"
    ],
    lv2: [
        "あぅ……んっ。体が縮むとき、内側をこすられるみたいで……変な声、出ちゃいました……。",
        "はぁ、はぁ……。急に萎（しぼ）んだから……力が入りません。腰が、カクカクしてます……。",
        "んんっ……。お肉が引き締まりましたけど……魔力の回路が、まだジンジン痺れてます……。"
    ],
    lv3: [
        "ぷはぁっ……！ ……あぁ、軽くなった……。でも、なんだか……胸にぽっかり穴が空いたみたいに寂しいです。",
        "……夢、じゃないですよね？ 体が熱くて……自分の形がまだ思い出せません……。",
        "すごかったです……。空気が抜けるみたいに、シュルシュルって……中身を搾り取られた気分……。"
    ],
    lv4: [
        "あひぃっ、んあぁっ……♡ ……はっ！ わ、私……戻ってる？ ……あんなにイッてたのに……嘘、嫌だ……。",
        "はぁ、はぁ、はぁ……。中身、空っぽになっちゃった……。まだ、あんなに熱かったのに……もっと、膨らんでたかった……。",
        "……信じられません。あんな破裂寸前の姿が……私の本当の形だったんじゃ……？ うぅ、体が……疼いて止まらないよぉ……。"
    ]
};

const LIMIT_BREATH_DIALOGUE = [
    "あぁっ♡",
    "んくっ♡ 突き上げっ……♡",
    "ひグッ♡ 壊れるぅ♡",
    "あはぁ……♡ もっとぉ……♡",
    "んぅっ！ ビクッてしたぁ♡",
    "中、熱いぃ……♡",
    "んオッ♡ 膨らむぅ♡",
    "あﾞっ♡ イッちゃう♡",
    "ひぃンッ♡",
    "どぷッて……来たぁ♡"
];

const FAIRY_TALK_EXPANSION = {
    // 1. 通常の膨張事故 (Accident)
    accident_lv1: [
        "うぅ、服が着られないのでタオルを巻いてるんですけど……はみ出ちゃいます。これじゃ隠してる意味がないですよぉ。",
        "拠点で休む時くらい、普通の体型に戻りたいです……。体が重くて肩が凝りそうですし、バランス取るのも一苦労です。",
        "鏡を見るのが怖いです。私、ちゃんと妖精の形をしてますか？ ……ただのピンク色の風船になってませんか？"
    ],
    accident_lv2: [
        "動くたびにボヨンボヨンして……落ち着かないです。誰も見てないはずなのに、音だけで恥ずかしくなっちゃいます。",
        "この体、クッションとしては優秀かもしれませんけど……自分がなるのはちょっと……。寝返りを打つのも大変なんですよ？",
        "うぅ……床に座ると、お肉がムニュッて広がる感覚が……。お願いですから、早く元のサイズに戻してください……。"
    ],
    accident_lv3: [
        "もう、動くのが面倒になっちゃいました。私、ここで一生転がってます……。妖精廃業ですね、ふふ……。",
        "鏡を見ました……？ いえ、見ないでください！ 今の私はただの「お肉」ですっ！ 見世物じゃありませんっ！",
        "自分の体が邪魔で、本を読むのも大変です。腕が前に回らないなんて……生活に支障が出まくりですよぉ。"
    ],
    accident_lv4: [
        "あぁっ♡",
        "んくっ♡ 突き上げっ……♡",
        "ひグッ♡ 壊れるぅ♡",
        "あはぁ……♡ もっとぉ……♡",
        "んぅっ！ ビクッてしたぁ♡",
        "中、熱いぃ……♡",
        "んオッ♡ 膨らむぅ♡",
        "あﾞっ♡ イッちゃう♡",
        "ひぃンッ♡",
        "どぷッて……来たぁ♡"
    ],

    // 2. 解放状態での膨張 (Liberation)
    liberation_lv1: [
        "ふふ、魔力が体に満ちていく……。服なんて邪魔なだけですよね？ この張り詰めた肌こそが、最強の鎧なんです。",
        "見てください、このハリ！ 拠点の空気が肌に触れて気持ちいいです♪ 成長期って、素晴らしいですね！",
        "あえて隠さず、堂々としていれば恥ずかしくありません。……というか、今の私、ちょっと魅力的すぎませんか？"
    ],
    liberation_lv2: [
        "たぷん、たぷん……♪ 歩くたびに重さを感じるのが、たまらなく幸せなんです。私が「女」として完成していく音……。",
        "休憩中も、この豊満なボディを見せつけたい気分……。私、変わっちゃったのかな？ いえ、これが本来の姿なのかも。",
        "重たい……でも、愛おしい重さです。たっぷりと蓄えた魔力が、私の中で脈打っているのが分かります……うっとり。"
    ],
    liberation_lv3: [
        "あはは！ 私、拠点ごと飲み込んじゃいそうなくらい大きいです！ ……世界で一番、私が大きい……気持ちいい……♡",
        "重力も、常識も、今の私を縛ることはできません。このわがままボディが正義です！ さあ、崇めてもいいんですよ？",
        "もう手足なんて飾りです。この圧倒的な質量の塊こそが私……。ふふっ、ベッドが壊れちゃいそうですね♪"
    ],
    
    // 3. 複合 (縮小 x 膨張)
    mixed_s1_e1: [
        "少し縮んで、少し膨らんで……今の私、マスコットキャラとして需要ありますか？ ぬいぐるみに紛れててもバレないかも？",
        "小さくなった分、体のラインが強調されてますね。……ふふ、SDキャラみたいで可愛いかもしれません。"
    ],
    mixed_s1_e2: [
        "体は小さいのに、胸の重さだけ一人前……バランス取るのが大変です。油断すると前につんのめっちゃいそう！",
        "重心が低くてドッシリしてます。これなら扇風機の風でも飛ばされませんね！ 無敵の要塞ですっ。"
    ],
    mixed_s1_e3: [
        "前が見えません！ 小さくなったせいで、自分のお肉の壁に埋もれちゃってます！ 誰か、誘導してください～！",
        "狭いところを通ろうとすると、お腹がつっかえちゃいます。……私が太ってるんじゃありません、通路が狭いんです！"
    ],

    // S2:手のひら
    mixed_s2_e1: [
        "このサイズでこのプロポーション……高級フィギュアみたいでしょ？ 机の上に飾ってもいいですよ？ えへへ。",
        "精巧な作り物みたい……。自分で自分の体を眺めてても飽きません。芸術点、高くないですか？"
    ],
    mixed_s2_e2: [
        "重たいですぅ……。羽ばたこうとしても、体が重すぎて墜落しちゃいます。飛べない妖精は、ただの……なんでしょう？",
        "小さいのにズッシリ重い……文鎮（ぶんちん）代わりに使えそうですね。書類が飛ばないように押さえてあげましょうか？"
    ],
    mixed_s2_e3: [
        "手足が短くて、お腹がつっかえて……起き上がこぼしみたいになっちゃいました。押しても倒れませんよ！",
        "歩くよりも、弾んで移動したほうが早いです。ぽよーん、ぽよーん♪ ……これ、新しい移動手段として流行るかも？"
    ],

    // S3:豆粒
    mixed_s3_e1: [
        "ぷるんっとしてて、葉っぱの上の水滴みたいですよね。間違って拭き取らないでくださいよ？ 私ですからね！",
        "指先に乗っちゃうサイズですけど、存在感は抜群です。弾力なら誰にも負けませんっ！"
    ],
    mixed_s3_e2: [
        "豆粒サイズなのに、質量がすごいです。床にめり込んじゃいそう……。ブラックホールになりかけかも？",
        "小さい体に魔力が圧縮されて、カチカチに硬いかもしれません。……パチンコ玉みたいに飛ばさないでくださいね？"
    ],
    mixed_s3_e3: [
        "コロコロ……。もう、歩くより転がったほうが速いです。私はボール……ピンク色のスーパーボールです……。",
        "ここまで来ると、自分が生き物なのかどうかも怪しいですね。……でも、この丸いフォルム、意外と気に入ってます♪"
    ],

    refuse_cure: [
        "泉の水に浸かれば、元の体に戻れるって知ってます。……知ってますけど、もうちょっとだけ、この重みを感じていたいんです。",
        "デバフ（悪い状態）じゃないなら、急いで治す必要もありませんよね？ ……ふふ、私、今の自分を結構気に入ってるのかも。",
        "浄化の泉……。今の私が入ったら、水が全部濁っちゃいそうですね。体の中に溜まった「熱」が凄すぎて……。",
        "「治す」だなんて……。これが私の「進化」だとしたら、戻るなんてもったいないと思いませんか？"
    ],

    // --- 5. 膨張ボディ・自己接触 (タッチ反応) ---
    touch_expansion_lv1: [
        "つん、つん。（張りのある胸をつつく）……うぅ、反発力がすごいです。指先が沈まないくらいパンパンで……熱い。",
        "なぞるだけで、皮膚がピリピリします。急に膨らんだせいで、神経が過敏になってるのかな……んっ……。",
        "（そっと自分の体を抱きしめる）……うん、確実に大きくなってます。腕の中に収まりきらないボリューム……ドキドキしちゃう。"
    ],
    touch_expansion_lv2: [
        "むにゅ……。（豊満な肉を両手で揉む）……あぁ、柔らかい。自分で触ってるだけなのに、頭がトロンとして……変な声が出ちゃいそうです。",
        "持ち上げてみると、ずっしり重たいです。……手を離すと「たぷん」って落ちて……ふふ、お餅みたい。",
        "（太ももやお腹をさする）……すごい。どこを触っても、指が吸い付くように沈んでいきます。私、全身が性感帯になっちゃったかも……？"
    ],
    touch_expansion_lv3: [
        "すーっ……。（指先で敏感な肌をなぞる）……ひゃうっ！ だ、ダメです、表面積が広すぎて、どこを触っても刺激が……っ！",
        "（巨大な胸に顔を埋める）……んーっ。自分の体に顔を埋めるなんて変ですけど……匂いと熱気で、クラクラします……。",
        "あはぁ……。ちょっと揺らしただけで、全身に波紋みたいに快感が広がるんです。……ねえ、これ、もう戻れない体になってませんか？"
    ]
};