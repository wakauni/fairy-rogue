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
    ]
    ,

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
    ]
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
    { name: 'ボロボロの', power: 5 },
    { name: '木の',       power: 10 },
    { name: '鉄の',       power: 20 },
    { name: '鋼の',       power: 35 },
    { name: 'ミスリルの', power: 55 },
    { name: 'オリハルコンの', power: 80 }
];

// 必殺技ロジック定義 (Weapon Arts)
const WEAPON_ARTS_LOGIC = {
    SWORD:  (player, enemy) => { return { type: 'damage', val: player.atk + (player.def * 2.0), msg: 'シールドバッシュ！' }; },
    AXE:    (player, enemy) => { return { type: 'damage', val: player.atk + (player.maxHp * 0.2), msg: 'グランドブレイカー！' }; },
    KATANA: (player, enemy) => { return { type: 'multi_hit', val: Math.floor(player.atk * 0.8), count: 3, msg: '三段斬り！' }; },
    WAND:   (player, enemy) => { return { type: 'magic_burst', val: Math.floor(player.int * 1.5), msg: 'マジックバースト！' }; },
    BOOK:   (player, enemy) => { return { type: 'damage', val: player.int + (player.spd * 3.0), msg: '高速詠唱！' }; },
    CANNON: (player, enemy) => { return { type: 'damage', val: (player.atk + player.int) * 1.5, msg: '魔導砲発射！' }; },
    SHIELD: (player, enemy) => {
        return { type: 'damage', val: player.def * 2.5, msg: '鉄壁の突進（シールドチャージ）！' };
    },
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
    }
);