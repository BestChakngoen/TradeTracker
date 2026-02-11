  // --- FILE 3: MARKET SERVICE ---
export class MarketService {
    constructor() {
        this.symbols = {
            'BTC/USD': 'BTCUSDT',
            'XAU/USD': 'PAXGUSDT',
            'EUR/USD': 'EURUSDT'
        };
        this.prevPrice = 0;
    }

    async fetchPrice(asset) {
        if(!this.symbols[asset]) return null;
        // Primary: Binance
        try {
            const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${this.symbols[asset]}&t=${Date.now()}`);
            const d = await res.json();
            if(d && d.price) return parseFloat(d.price);
        } catch (e) {
            // continue to fallback
        }

        // Fallbacks: CoinGecko for crypto/gold tokens, exchangerate for fiat
        try {
            if(asset === 'BTC/USD') {
                const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
                const j = await r.json();
                return j?.bitcoin?.usd ? parseFloat(j.bitcoin.usd) : null;
            }
            if(asset === 'XAU/USD') {
                // PAX Gold (pax-gold) price in USD
                const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd');
                const j = await r.json();
                return j?.['pax-gold']?.usd ? parseFloat(j['pax-gold'].usd) : null;
            }
            if(asset === 'EUR/USD') {
                // Exchange rate EUR -> USD
                const r = await fetch('https://api.exchangerate.host/latest?base=EUR&symbols=USD');
                const j = await r.json();
                return j?.rates?.USD ? parseFloat(j.rates.USD) : null;
            }
        } catch (e) {
            return null;
        }
        return null;
    }

    async fetchTHB() {
        try {
            const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=thb');
            const data = await res.json();
            return data?.tether?.thb || null;
        } catch {
            try {
                const res2 = await fetch('https://api.frankfurter.app/latest?from=USD&to=THB');
                const d2 = await res2.json();
                return d2?.rates?.THB || null;
                    } catch { return null; }
        }
    }
}
