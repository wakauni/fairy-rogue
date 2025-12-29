/**
 * デッキ管理クラス
 * 山札、手札、捨て札を管理
 */
class DeckManager {
    constructor() {
        this.drawPile = [];   // 山札
        this.hand = [];       // 手札
        this.discardPile = []; // 捨て札
        
        // 初期デッキ生成（適当にカードを10枚入れる）
        this.initializeDeck();
    }

    initializeDeck(customDeck = null) {
        if (customDeck) {
            // 外部からデッキリストが渡された場合
            this.drawPile = [...customDeck];
        } else {
            // デフォルト構成（初期化用）
            const initialCards = [
                'fire', 'fire', 'fire', 'fire',
                'thunder', 'thunder',
                'heal', 'heal', 'heal',
                'barrier'
            ];
            this.drawPile = initialCards.map(id => CARD_DATABASE.find(c => c.id === id));
        }
        
        this.hand = [];
        this.discardPile = [];
        this.shuffle(this.drawPile);
    }

    // 配列をシャッフルする（フィッシャー–イェーツ）
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // 手札が4枚になるまで引く
    fillHand(limit = 4) {
        while (this.hand.length < limit) {
            if (this.drawPile.length === 0) {
                if (this.discardPile.length === 0) break; // 完全にカードがない
                this.reshuffle(); // 捨て札を山札に戻す
            }
            const card = this.drawPile.pop();
            this.hand.push(card);
        }
    }

    // カードを使用（手札から削除し、捨て札へ）
    useCard(index) {
        const card = this.hand.splice(index, 1)[0];
        this.discardPile.push(card);
        return card;
    }

    // リシャッフル処理
    reshuffle() {
        // 捨て札を山札に移動してシャッフル
        this.drawPile = [...this.discardPile];
        this.discardPile = [];
        this.shuffle(this.drawPile);
        // 本来はUIに「シャッフル！」と出したいがログで代用
        game.log("山札再構築！捨て札を切り直しました。");
    }

    // 手札を全て捨てて、その枚数分引き直す
    reloadHand() {
        const count = this.hand.length;
        this.discardPile.push(...this.hand);
        this.hand = [];
        for (let i = 0; i < count; i++) {
            if (this.drawPile.length === 0) {
                if (this.discardPile.length === 0) break;
                this.reshuffle();
            }
            this.hand.push(this.drawPile.pop());
        }
    }

    // デッキをリセット（手札・捨て札を山札に戻してシャッフル）
    reset() {
        this.drawPile = this.drawPile.concat(this.hand, this.discardPile);
        this.hand = [];
        this.discardPile = [];
        this.shuffle(this.drawPile);
    }
}