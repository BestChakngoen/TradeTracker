  // --- FILE 3: MARKET SERVICE ---
export class MarketService {
    constructor() {
        this.symbols = {
            'BTC/USD': 'BTCUSDT',
            'XAU/USD': 'PAXGUSDT',
            'EUR/USD': 'EURUSDT'
        };
        this.prevPrice = 0;
        this.thbCache = null;
        this.thbCacheTime = 0;
        this.thbCacheDuration = 300000; // 5 minutes
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
        // Check cache first
        const now = Date.now();
        if(this.thbCache && now - this.thbCacheTime < this.thbCacheDuration) {
            return this.thbCache;
        }

        try {
            const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=THB', {
                signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : null
            });
            if(res.ok) {
                const d = await res.json();
                const rate = d?.rates?.THB || null;
                if(rate) {
                    this.thbCache = rate;
                    this.thbCacheTime = now;
                }
                return rate;
            }
        } catch (e) {
            console.warn('fetchTHB error:', e.message);
        }

        // Return cached value if available, even if stale
        return this.thbCache;
    }
}
