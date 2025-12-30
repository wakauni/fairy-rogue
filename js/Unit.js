/**
 * ユニットの基底クラス
 * プレイヤーと敵の共通プロパティを管理
 */
class Unit {
    constructor(name, maxHp, atk, def, int, spd, isBoss = false, isPlayer = false) {
        this.name = name;
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.atk = atk;
        this.def = def;
        this.int = int;
        this.spd = spd;
        this.isBoss = isBoss; // ボスフラグ
        this.isPlayer = isPlayer; // プレイヤーかどうかのフラグ
        this.isDefending = false; // 防御状態フラグ
        this.isLiberated = false; // 解放の証フラグ
        this.buffs = []; // バフ管理配列
        this.skipTurn = false; // 行動スキップフラグ
        this.barrier = 0; // ダメージ軽減バリア (耐久値)
        this.weaponCharge = false; // 必殺技チャージフラグ
        this.dropQualityBonus = 0; // ドロップ品質ボーナス
        this.battleStatsMod = { atk: 0, def: 0, int: 0, spd: 0 }; // 戦闘中の一時ステータス補正
        this.currentStatus = null; // 現在のメイン状態異常
        this.statusTurn = 0;       // 状態異常の残りターン
        this.shrinkLevel = 0;      // 縮小レベル (0-2)
        this.routineId = null;     // 敵の思考ルーチンID
        this.uniqueStatus = null;  // 敵が使用する固有状態異常
        
        this.counterStance = null; // カウンター待機状態
        this.minShrinkLevel = 0;   // 縮小化の下限
        this.dungeonBonus = { atk: 0, int: 0, dmgRate: 1.0 }; // ダンジョン内ボーナス
        this.expansionLevel = 0; // 膨張レベル (0:なし, 1~3:段階)

        // 統計データ (Stats Tracking)
        this.runStats = {
            magicUse: 0,       // 魔法使用回数
            attackUse: 0,      // 攻撃使用回数
            selfStripCount: 0, // 脱衣状態になった回数
            escapeCount: 0,    // 逃走成功回数
            maxFloor: 0,       // 到達階層
            everEquipped: false // 一度でも装備を変更したか
        };

        // イベントフラグ
        this.flags = {};
    }

    // ダメージを受ける処理
    takeDamage(amount, ignoreDef = false) {
        // 無敵判定 (Invincible)
        const invincibleBuff = this.buffs.find(b => b.type === 'invincible');
        if (invincibleBuff) {
            return 0;
        }

        // 防御中はダメージ半減
        if (this.isDefending) {
            amount = Math.floor(amount * 0.5);
        }
        // DEFによる軽減（簡易計算: ダメージ - DEF/2、最低1ダメージ）
        let reducedDmg = amount;
        if (!ignoreDef) {
            reducedDmg = Math.max(1, amount - Math.floor(this.def / 2));
        }

        // プロテクション (被ダメージ軽減バフ)
        const protectBuff = this.buffs.find(b => b.buffId === 'dmg_cut');
        if (protectBuff) {
            reducedDmg = Math.floor(reducedDmg * (1.0 - protectBuff.value));
        }

        this.hp = Math.max(0, this.hp - reducedDmg);
        return reducedDmg;
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    isDead() {
        return this.hp <= 0;
    }

    // --- 拡張メソッド ---
    applyBarrier(damage) {
        let absorbed = 0;
        if (this.barrier > 0) {
            absorbed = Math.min(this.barrier, damage);
            this.barrier -= absorbed;
            damage -= absorbed;
        }
        // BattleSystem側で { damage, absorbed } を期待しているためオブジェクトを返す
        return { damage, absorbed };
    }

    addBuff(buff) {
        // durationプロパティをremainingとして設定
        if (buff.duration) {
            // プレイヤーの場合、発動ターン消費分を補填して +1 する
            let bonus = (this.isPlayer) ? 1 : 0;
            // ただし、永続バフ(50ターン以上など)はそのままにする
            if (buff.duration >= 50) bonus = 0;
            buff.remaining = buff.duration + bonus;
        }
        this.buffs.push(buff);
    }

    addStatus(statusId, duration = 3) {
        // ▼ 追加: 膨張中は、縮小(shrink)以外の状態異常を無効化
        if (this.isPlayer && this.expansionLevel > 0) {
            if (statusId !== 'shrink') {
                // 無効化
                return;
            }
        }

        // ▼ 変更: 解放の証装備中は、縮小(shrink)以外の全ステータス変化を無効化する
        // (hasStatusで偽装するため、undressingすらも付与する必要がない)
        if (this.isPlayer && this.isLiberated) {
            if (statusId !== 'shrink') {
                // ここで無効化
                // BattleSystem側でメッセージを出したい場合は、戻り値で成否を返しても良い
                console.log("解放の証により状態異常を無効化");
                return;
            }
        }

        const status = STATUS_TYPES[statusId.toUpperCase()];
        if (status) {
            // ▼ 追加: 脱衣カウントの更新 ▼
            if (statusId === 'undressing' && this.isPlayer) {
                // runStats（探索中の統計情報）が存在することを確認して加算
                if (!this.runStats) this.runStats = {};
                if (!this.runStats.selfStripCount) this.runStats.selfStripCount = 0;
                
                this.runStats.selfStripCount++;
                console.log(`脱衣カウント: ${this.runStats.selfStripCount}`);
            }

            this.currentStatus = status;
            this.statusTurn = duration;
        }
    }

    hasStatus(statusId) {
        // ▼ 追加: 膨張中は 'undressing' (脱衣) を常に true とする
        if (this.isPlayer && this.expansionLevel > 0 && statusId === 'undressing') {
            return true;
        }

        // ▼ 追加: 解放の証(isLiberated)装備中は、'undressing' は常にtrueとして扱う
        if (this.isPlayer && this.isLiberated && statusId === 'undressing') {
            return true;
        }

        // 既存の判定
        return this.currentStatus && this.currentStatus.id === statusId;
    }

    removeStatus(statusId) {
        if (this.hasStatus(statusId)) {
            this.currentStatus = null;
            this.statusTurn = 0;
        }
    }

    clearAllStatus() {
        this.currentStatus = null;
        this.statusTurn = 0;
    }
}