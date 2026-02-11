  import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// --- FILE 2: DATA SERVICE (FIRESTORE & CSV) ---
export class DataService {
    constructor(authApp, config, appId = 'default-app-id') {
        this.db = getFirestore(authApp);
        this.useCustomConfig = !!config.apiKey;
        this.appId = appId;
        this.unsubscribe = null;
    }

    getCollectionPath(uid) {
        if (this.useCustomConfig) return collection(this.db, 'users', uid, 'trades');
        return collection(this.db, 'artifacts', this.appId, 'users', uid, 'trades');
    }

    subscribeTrades(uid, callback, errorCallback) {
        if (this.unsubscribe) this.unsubscribe();
        this.unsubscribe = onSnapshot(this.getCollectionPath(uid), (snapshot) => {
            const trades = [];
            snapshot.forEach(doc => trades.push({ firestoreId: doc.id, ...doc.data() }));
            trades.sort((a, b) => new Date(a.date) - new Date(b.date));
            callback(trades);
        }, errorCallback);
    }

    async addTrade(uid, trade) {
        await addDoc(this.getCollectionPath(uid), trade);
    }

    async deleteTrade(uid, docId) {
        let docPath;
        if (this.useCustomConfig) docPath = doc(this.db, 'users', uid, 'trades', docId);
        else docPath = doc(this.db, 'artifacts', this.appId, 'users', uid, 'trades', docId);
        await deleteDoc(docPath);
    }

    async resetAll(uid, trades) {
        const promises = trades.map(t => this.deleteTrade(uid, t.firestoreId));
        await Promise.all(promises);
    }

    parseCSV(text) {
        const lines = text.split('\n');
        if(lines.length < 2) return null;
        
        const isBroker = lines[0].includes('closing_time_utc');
        const parsedTrades = [];

        for(let i=1; i<lines.length; i++) {
            const line = lines[i].trim();
            if(!line) continue;
            const cols = line.split(',');
            let date, asset, amount, type = 'WIN';

            if(isBroker) {
                if(!cols[2] || !cols[13]) continue;
                date = cols[2].split('T')[0];
                let rawType = cols[3];
                let rawProfit = parseFloat(cols[13]);
                
                if (rawType === 'balance') {
                    type = rawProfit >= 0 ? 'DEPOSIT' : 'WITHDRAW';
                    asset = 'CASH';
                    amount = rawProfit;
                } else {
                    let rawSym = cols[6] ? cols[6].replace('m','') : 'Unknown';
                    asset = rawSym.includes('USD') ? rawSym.replace('USD', '/USD') : rawSym;
                    amount = rawProfit;
                    type = amount >= 0 ? 'WIN' : 'LOSS';
                }
            } else {
                // Standard Format
                date = cols[0];
                asset = cols[1];
                type = cols[2] || (parseFloat(cols[3]) >= 0 ? 'WIN' : 'LOSS');
                amount = parseFloat(cols[3]);
            }

            if(date && !isNaN(amount)) {
                parsedTrades.push({
                    id: Date.now() + i,
                    date, asset, type, amount,
                    timestamp: new Date().toISOString()
                });
            }
        }
        return parsedTrades;
    }
}
