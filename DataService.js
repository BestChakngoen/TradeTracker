    import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, updateDoc, setDoc, getDoc, runTransaction, increment } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// --- FILE 2: DATA SERVICE (FIRESTORE & CSV) ---

// Helper: normalize date to YYYY-MM-DD string
function normalizeDateString(dateValue) {
    if(typeof dateValue === 'string') {
        return dateValue; // Already a string
    }
    if(dateValue instanceof Date) {
        return dateValue.toISOString().split('T')[0];
    }
    if(dateValue && typeof dateValue === 'object') {
        // Try to handle Firebase Timestamp
        if(typeof dateValue.toDate === 'function') {
            return dateValue.toDate().toISOString().split('T')[0];
        }
        // Fallback: convert to string and extract date if possible
        const str = String(dateValue);
        if(str.match(/^\d{4}-\d{2}-\d{2}/)) {
            return str.match(/^\d{4}-\d{2}-\d{2}/)[0];
        }
    }
    return '1970-01-01'; // Fallback for invalid dates
}

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

    getMetaDoc(uid) {
        if (this.useCustomConfig) return doc(this.db, 'users', uid, 'meta', 'summary');
        return doc(this.db, 'artifacts', this.appId, 'users', uid, 'meta', 'summary');
    }

    subscribeTrades(uid, callback, errorCallback) {
        if (this.unsubscribe) this.unsubscribe();
        // Listen to trades collection
        const tradesUnsub = onSnapshot(this.getCollectionPath(uid), (snapshot) => {
            const trades = [];
            snapshot.forEach(doc => {
                const data = { firestoreId: doc.id, ...doc.data() };
                // Normalize date to string format YYYY-MM-DD
                if(data.date) {
                    data.date = normalizeDateString(data.date);
                }
                trades.push(data);
            });
            trades.sort((a, b) => new Date(a.date) - new Date(b.date));
            // Also fetch meta doc once and then call callback with both. If meta missing, create it from current trades.
            const metaRef = this.getMetaDoc(uid);
            getDoc(metaRef).then(mdoc => {
                // Always recalculate counts and totalTrades from current trades
                const counts = {};
                let total = 0;
                trades.forEach(t => {
                    const type = t.type || (t.amount >= 0 ? 'WIN' : 'LOSS');
                    if(type !== 'DEPOSIT' && type !== 'WITHDRAW') {
                        const dateStr = t.date || '1970-01-01'; // Safe fallback
                        counts[dateStr] = (counts[dateStr] || 0) + 1;
                        total++;
                    }
                });
                
                let meta = mdoc.exists() ? mdoc.data() : null;
                // Update meta if it doesn't exist or has stale totalTrades
                if(!meta || meta.totalTrades !== total) {
                    meta = { totalTrades: total, counts };
                    setDoc(metaRef, { ...meta, lastUpdated: new Date().toISOString() }, { merge: true }).catch(e => console.error('Failed to update meta doc', e));
                }
                callback(trades, meta);
            }).catch((e) => { console.error('Failed to read meta doc', e); callback(trades, null); });
        }, errorCallback);
        // keep reference to unsubscribe both if needed
        this.unsubscribe = () => { tradesUnsub(); };
    }

    async addTrade(uid, trade) {
        // Ensure date is always a proper string
        const normalizedTrade = { ...trade, date: normalizeDateString(trade.date) };
        const ref = await addDoc(this.getCollectionPath(uid), normalizedTrade);
        // Update meta summary: increment totalTrades and counts.<date>
        const metaRef = this.getMetaDoc(uid);
        const dateKey = normalizedTrade.date || '1970-01-01';
        try {
            await updateDoc(metaRef, { totalTrades: increment(1), ['counts.' + dateKey]: increment(1) });
        } catch (err) {
            // If update fails (doc doesn't exist), create it
            try {
                await setDoc(metaRef, { totalTrades: 1, counts: { [dateKey]: 1 }, lastUpdated: new Date().toISOString() }, { merge: true });
            } catch (e) {
                console.error('Failed to set meta doc', e);
            }
        }
        return ref;
    }

    // docId: firestore document id. tradeObj optional, if provided will be used to decrement counts
    async deleteTrade(uid, docId, tradeObj = null) {
        let docPath;
        if (this.useCustomConfig) docPath = doc(this.db, 'users', uid, 'trades', docId);
        else docPath = doc(this.db, 'artifacts', this.appId, 'users', uid, 'trades', docId);

        // If tradeObj not provided, try to fetch the doc to read its date
        let tradeData = tradeObj;
        if(!tradeData) {
            try {
                const snapshot = await getDoc(docPath);
                if(snapshot.exists()) tradeData = snapshot.data();
            } catch(e) {
                console.error('Failed to read trade for delete meta update', e);
            }
        }

        await deleteDoc(docPath);

        // Update meta to decrement counts if we have the date
        if(tradeData && tradeData.date) {
            const metaRef = this.getMetaDoc(uid);
            const dateKey = normalizeDateString(tradeData.date) || '1970-01-01';
            try {
                await updateDoc(metaRef, { totalTrades: increment(-1), ['counts.' + dateKey]: increment(-1) });
            } catch (err) {
                // best-effort: if fails, ignore
                console.error('Failed to update meta on delete', err);
            }
        }
    }

    async resetAll(uid, trades) {
        const promises = trades.map(t => this.deleteTrade(uid, t.firestoreId, t));
        await Promise.all(promises);
        // Reset meta doc
        const metaRef = this.getMetaDoc(uid);
        try {
            await setDoc(metaRef, { totalTrades: 0, counts: {} }, { merge: true });
        } catch (e) {
            console.error('Failed to reset meta', e);
        }
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
