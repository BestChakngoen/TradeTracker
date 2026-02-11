 import { AuthService } from './AuthService.js';
import { DataService } from './DataService.js';
import { MarketService } from './MarketService.js';
import { UIManager } from './UIManager.js';

// --- FILE 5: MAIN APP CONTROLLER ---
export class TradeApp {
    constructor(userFirebaseConfig, appId = 'default-app-id') {
        this.auth = new AuthService(userFirebaseConfig);
        this.data = new DataService(this.auth.app, userFirebaseConfig, appId);
        this.market = new MarketService();
        this.ui = new UIManager();
        
        this.trades = [];
        this.initListeners();
    }

    initListeners() {
        // Auth Events
        this.auth.onStateChange((user) => {
            if(user) {
                this.ui.showLogin(false);
                document.getElementById('user-display-name').innerText = `// ${user.email}`;
                this.data.subscribeTrades(user.uid, (data) => {
                    this.trades = data;
                    this.ui.renderTradeList(data, (id) => this.handleDelete(id));
                    this.ui.updateStats(data);
                }, (err) => console.error(err));
                this.startMarketLoops();
            } else {
                this.ui.showLogin(true);
            }
        });

        // Button Clicks
        document.getElementById('btn-login').onclick = () => this.handleLogin();
        document.getElementById('btn-logout').onclick = () => this.auth.logout();
        document.getElementById('btn-copy-domain').onclick = () => this.copyDomain();
        document.getElementById('btn-add-trade').onclick = () => this.handleAddTrade();
        document.getElementById('btn-reset').onclick = () => this.handleReset();
        document.getElementById('btn-export').onclick = () => this.handleExport();
        document.getElementById('btn-import-trigger').onclick = () => document.getElementById('file-import').click();
        document.getElementById('file-import').onchange = (e) => this.handleImport(e);
        
        // Tabs
        document.getElementById('tab-journal').onclick = () => this.ui.switchTab('journal');
        document.getElementById('tab-market').onclick = () => {
            this.ui.switchTab('market');
            this.initTradingView('BINANCE:BTCUSDT');
        };

        // Inputs
        document.getElementById('input-type').onchange = () => {
            this.ui.toggleInputStyle();
        };
        document.getElementById('input-asset').onchange = () => { this.ui.toggleInputStyle(); };

        // Quick Actions
        document.getElementById('btn-quick-deposit').onclick = () => this.setQuickType('DEPOSIT');
        document.getElementById('btn-quick-withdraw').onclick = () => this.setQuickType('WITHDRAW');

        // Market Assets Buttons
        const marketAssets = [
            {s:'BINANCE:BTCUSDT', n:'BTC/USDT', c:'border-cyan-500 text-cyan-400'},
            {s:'OANDA:XAUUSD', n:'GOLD (XAU)', c:'border-slate-600 text-slate-500'},
            {s:'FX:EURUSD', n:'EUR/USD', c:'border-slate-600 text-slate-500'}
        ];
        const container = document.getElementById('market-assets-container');
        marketAssets.forEach(m => {
            const b = document.createElement('button');
            b.className = `asset-btn btn-press px-4 py-2 rounded-lg font-mono text-sm border hover:border-cyan-500 transition-all ${m.c}`;
            b.innerText = m.n;
            b.onclick = () => {
                document.querySelectorAll('.asset-btn').forEach(x => {
                    x.classList.remove('border-cyan-500','text-cyan-400');
                    x.classList.add('border-slate-600','text-slate-500');
                });
                b.classList.remove('border-slate-600','text-slate-500');
                b.classList.add('border-cyan-500','text-cyan-400');
                this.initTradingView(m.s);
            };
            container.appendChild(b);
        });

        // Initial UI
        document.getElementById('input-date').valueAsDate = new Date();
        this.updateTHB();
    }

    // --- Handlers ---

    async handleLogin() {
        const status = document.getElementById('login-status');
        status.innerText = "Contacting Identity Provider...";
        document.getElementById('auth-error-box').classList.add('hidden');
        try {
            await this.auth.login();
        } catch (error) {
            if (error.code === 'auth/unauthorized-domain' || error.message.includes('unauthorized-domain')) {
                this.ui.showAuthError(true);
            } else {
                this.ui.showAuthError(false);
            }
        }
    }

    async handleAddTrade() {
        if(!this.auth.currentUser) return;
        const dom = this.ui.dom.inputs;
        const date = dom.date.value;
        const asset = dom.asset.disabled ? 'CASH' : dom.asset.value;
        const type = dom.type.value;
        let amount = parseFloat(dom.amount.value);

        if(!date || isNaN(amount)) { alert("Check inputs"); return; }
        
        amount = Math.abs(amount);
        if(type === 'LOSS' || type === 'WITHDRAW') amount = -amount;

        const trade = {
            id: Date.now(),
            date, asset, type, amount,
            timestamp: new Date().toISOString()
        };

        await this.data.addTrade(this.auth.currentUser.uid, trade);
        dom.amount.value = '';
    }

    async handleDelete(id) {
        if(confirm('Delete record?')) {
            await this.data.deleteTrade(this.auth.currentUser.uid, id);
        }
    }

    async handleReset() {
        if(confirm('Wipe ALL data?')) {
            await this.data.resetAll(this.auth.currentUser.uid, this.trades);
        }
    }

    handleExport() {
        if(this.trades.length === 0) return;
        let csv = "Date,Asset,Type,Amount\n" + this.trades.map(t => `${t.date},${t.asset},${t.type},${t.amount}`).join('\n');
        const link = document.createElement("a"); 
        link.href = encodeURI("data:text/csv;charset=utf-8," + csv); 
        link.download = "trades.csv";
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }

    handleImport(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const items = this.data.parseCSV(event.target.result);
            if(items && confirm(`Import ${items.length} items?`)) {
                for(const item of items) {
                    await this.data.addTrade(this.auth.currentUser.uid, item);
                }
                alert("Import Complete");
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    }

    // --- Market & Helpers ---

    // Live price removed: no updatePrice method

    async updateTHB() {
        const rate = await this.market.fetchTHB();
        this.ui.updateTHB(rate);
    }

    startMarketLoops() {
        setInterval(() => this.updateTHB(), 15000);
    }

    copyDomain() {
        const d = document.getElementById('domain-display').innerText;
        navigator.clipboard.writeText(d);
        alert("Copied: " + d);
    }

    setQuickType(type) {
        document.getElementById('input-type').value = type;
        this.ui.toggleInputStyle();
        document.getElementById('input-amount').focus();
    }

    initTradingView(symbol) {
        document.getElementById('tv-chart-container').innerHTML = '';
        const sc = document.createElement('script'); 
        sc.src = 'https://s3.tradingview.com/tv.js'; 
        sc.async = true;
        sc.onload = () => { 
            new TradingView.widget({ 
                "width":"100%","height":"100%","symbol":symbol,"interval":"D","timezone":"Asia/Bangkok","theme":"dark","style":"1","locale":"en","toolbar_bg":"#f1f3f6","enable_publishing":false,"container_id":"tv-chart-container","backgroundColor":"rgba(15, 23, 42, 1)" 
            }); 
        };
        document.head.appendChild(sc);
    }
}
