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
        this.notes = { title: '', items: [] }; // Local state for notes
        this.initListeners();
    }

    // Helper: Get current date as YYYY-MM-DD string in Thai Time (UTC+7)
    getThaiDateString() {
        return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    }

    initListeners() {
        // Auth Events
        this.auth.onStateChange((user) => {
            if (user) {
                this.ui.showLogin(false);
                document.getElementById('user-display-name').innerText = `// ${user.email}`;
                
                // 1. Subscribe to Trades
                this.data.subscribeTrades(user.uid, (data, meta) => {
                    this.trades = data;
                    this.ui.renderTradeList(data, (id) => this.handleDelete(id));
                    this.ui.updateStats(data);
                    console.log('subscribeTrades meta:', meta);
                    if (meta) this.ui.updateCloudStats(meta);
                }, (err) => console.error(err));

                // 2. Subscribe to Notes (Learning Log)
                this.data.subscribeNotes(user.uid, (notesData) => {
                    // Update local state and UI
                    this.notes = notesData || { title: 'My Trading Rules', items: [] };
                    this.ui.renderNotes(this.notes, (index) => this.handleDeleteNoteItem(index));
                });

                this.startMarketLoops();
            } else {
                this.ui.showLogin(true);
            }
        });


        // Risk Calculator Listeners
        ['risk-balance', 'risk-percent', 'risk-leverage', 'risk-asset', 'risk-entry', 'risk-sl', 'risk-tp'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.oninput = () => this.calculateRisk();
                el.onchange = () => this.calculateRisk();
            }
        });

        // เพิ่ม Listener สำหรับ Radio Buttons (Buy/Sell)
        document.querySelectorAll('input[name="risk-side"]').forEach(radio => {
            radio.onchange = () => this.calculateRisk();
        });

        document.getElementById('btn-calc-position').onclick = () => this.calculateRisk();

        // Button Clicks
        document.getElementById('btn-login').onclick = () => this.handleLogin();
        document.getElementById('btn-logout').onclick = () => this.auth.logout();
        document.getElementById('btn-copy-domain').onclick = () => this.copyDomain();
        document.getElementById('btn-add-trade').onclick = () => this.handleAddTrade();
        document.getElementById('btn-reset').onclick = () => this.handleReset();
        document.getElementById('btn-export').onclick = () => this.handleExport();
        document.getElementById('btn-import-trigger').onclick = () => document.getElementById('file-import').click();
        document.getElementById('file-import').onchange = (e) => this.handleImport(e);

        // --- NEW: NOTE LISTENERS ---
        document.getElementById('btn-add-note').onclick = () => this.handleAddNoteItem();
        document.getElementById('btn-save-note').onclick = () => this.handleSaveNotes();
        document.getElementById('note-input').onkeypress = (e) => {
            if(e.key === 'Enter') this.handleAddNoteItem();
        };

        // Date Manual Reset Button (New Feature) - Adjusted for Thai Time
        document.getElementById('btn-set-today').onclick = () => {
            this.ui.dom.inputs.date.value = this.getThaiDateString();
        };

        // Tabs
        document.getElementById('tab-journal').onclick = () => this.ui.switchTab('journal');
        document.getElementById('tab-market').onclick = () => {
            this.ui.switchTab('market');
            this.initTradingView('BINANCE:BTCUSDT');
        };

        document.getElementById('tab-calc').onclick = () => this.ui.switchTab('calc');
        // ADDED: News Tab Handler
        document.getElementById('tab-news').onclick = () => this.ui.switchTab('news');

        document.getElementById('btn-calculate-compound').onclick = () => this.calculateCompoundInterest();
        this.calculateCompoundInterest(); // สั่งรันครั้งแรกเมื่อโหลดแอปเพื่อตั้งค่า Default

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
            { s: 'BINANCE:BTCUSDT', n: 'BTC/USDT', c: 'border-cyan-500 text-cyan-400' },
            { s: 'OANDA:XAUUSD', n: 'GOLD (XAU)', c: 'border-slate-600 text-slate-500' },
            { s: 'FX:EURUSD', n: 'EUR/USD', c: 'border-slate-600 text-slate-500' }
        ];
        const container = document.getElementById('market-assets-container');
        marketAssets.forEach(m => {
            const b = document.createElement('button');
            b.className = `asset-btn btn-press px-4 py-2 rounded-lg font-mono text-sm border hover:border-cyan-500 transition-all ${m.c}`;
            b.innerText = m.n;
            b.onclick = () => {
                document.querySelectorAll('.asset-btn').forEach(x => {
                    x.classList.remove('border-cyan-500', 'text-cyan-400');
                    x.classList.add('border-slate-600', 'text-slate-500');
                });
                b.classList.remove('border-slate-600', 'text-slate-500');
                b.classList.add('border-cyan-500', 'text-cyan-400');
                this.initTradingView(m.s);
            };
            container.appendChild(b);
        });

        // Initial UI - Adjusted for Thai Time
        document.getElementById('input-date').value = this.getThaiDateString();
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

    // --- NEW: NOTE HANDLERS ---
    handleAddNoteItem() {
        const input = document.getElementById('note-input');
        const text = input.value.trim();
        if(!text) return;
        
        if(!this.notes.items) this.notes.items = [];
        this.notes.items.push(text);
        
        // Optimistic UI Update
        this.ui.renderNotes(this.notes, (i) => this.handleDeleteNoteItem(i));
        input.value = '';
        input.focus();
    }

    handleDeleteNoteItem(index) {
        if(!this.notes.items) return;
        this.notes.items.splice(index, 1);
        this.ui.renderNotes(this.notes, (i) => this.handleDeleteNoteItem(i));
    }

    async handleSaveNotes() {
        if (!this.auth.currentUser) return;
        const btn = document.getElementById('btn-save-note');
        const originalText = btn.innerHTML;
        
        btn.innerText = 'SAVING...';
        btn.disabled = true;

        // Get current title from input
        this.notes.title = document.getElementById('note-title').value;

        try {
            await this.data.saveNotes(this.auth.currentUser.uid, this.notes);
            btn.innerText = 'SAVED!';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 1500);
        } catch(e) {
            console.error(e);
            btn.innerText = 'ERROR';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 1500);
        }
    }

    async handleAddTrade() {
        if (!this.auth.currentUser) return;
        const dom = this.ui.dom.inputs;
        const date = dom.date.value;
        const asset = dom.asset.disabled ? 'CASH' : dom.asset.value;
        const type = dom.type.value;
        let amount = parseFloat(dom.amount.value);

        if (!date || isNaN(amount)) { alert("Check inputs"); return; }

        amount = Math.abs(amount);
        if (type === 'LOSS' || type === 'WITHDRAW') amount = -amount;

        const ts = Date.now();
        const trade = {
            id: ts,
            order_index: ts, // ADDED: Index for sorting consistency
            date, asset, type, amount,
            timestamp: new Date().toISOString()
        };

        await this.data.addTrade(this.auth.currentUser.uid, trade);
        dom.amount.value = '';
        
        // Auto-Update Date to Today (Thai Time) after successful record
        dom.date.value = this.getThaiDateString(); 
    }

    async handleDelete(id) {
        if (confirm('Delete record?')) {
            // find trade object to allow meta update
            const trade = this.trades.find(t => t.firestoreId === id);
            await this.data.deleteTrade(this.auth.currentUser.uid, id, trade);
        }
    }

    async handleReset() {
        if (confirm('Wipe ALL data?')) {
            await this.data.resetAll(this.auth.currentUser.uid, this.trades);
        }
    }

    handleExport() {
        if (this.trades.length === 0) return;
        let csv = "Date,Asset,Type,Amount\n" + this.trades.map(t => `${t.date},${t.asset},${t.type},${t.amount}`).join('\n');
        const link = document.createElement("a");
        link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
        link.download = "trades.csv";
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }

    handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const items = this.data.parseCSV(event.target.result);
            if (items && confirm(`Import ${items.length} items?`)) {
                for (const item of items) {
                    await this.data.addTrade(this.auth.currentUser.uid, item);
                }
                alert("Import Complete");
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    }
    // --- Calculator Logic ---
    calculateCompoundInterest() {
        const principal = parseFloat(document.getElementById('calc-principal').value) || 0;
        const monthly = parseFloat(document.getElementById('calc-monthly').value) || 0;
        const rate = parseFloat(document.getElementById('calc-rate').value) || 0;
        const years = parseFloat(document.getElementById('calc-years').value) || 0;

        const r = rate / 100 / 12; // monthly interest rate
        const n = years * 12; // total months

        let futureValue = 0;
        let totalInvested = principal + (monthly * n);

        if (r === 0) {
            futureValue = totalInvested;
        } else {
            futureValue = principal * Math.pow(1 + r, n) + monthly * ((Math.pow(1 + r, n) - 1) / r);
        }

        const totalInterest = futureValue - totalInvested;

        // อัปเดต UI
        document.getElementById('calc-result-total').innerText = futureValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('calc-result-invested').innerText = totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('calc-result-interest').innerText = totalInterest.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // อัปเดต Progress Bar
        const principalPercent = totalInvested > 0 ? (totalInvested / futureValue) * 100 : 0;
        const interestPercent = totalInvested > 0 ? (totalInterest / futureValue) * 100 : 0;

        document.getElementById('calc-bar-principal').style.width = `${principalPercent}%`;
        document.getElementById('calc-bar-interest').style.width = `${interestPercent}%`;
    }

    calculateRisk() {
        const dom = {
            bal: document.getElementById('risk-balance'),
            pct: document.getElementById('risk-percent'),
            lev: document.getElementById('risk-leverage'),
            asset: document.getElementById('risk-asset'),
            entry: parseFloat(document.getElementById('risk-entry').value) || 0,
            sl: parseFloat(document.getElementById('risk-sl').value) || 0,
            tp: parseFloat(document.getElementById('risk-tp').value) || 0,
            side: document.querySelector('input[name="risk-side"]:checked').value, // รับค่า LONG หรือ SHORT
            // Outputs
            oLot: document.getElementById('res-lot'),
            oMargin: document.getElementById('res-margin'),
            oRisk: document.getElementById('res-risk-amt'),
            oReward: document.getElementById('res-reward-amt'),
            oRR: document.getElementById('res-rr'),
            oEval: document.getElementById('res-rr-eval')
        };

        // 1. Get Balance
        let balance = parseFloat(dom.bal.value);
        if (isNaN(balance) || balance === 0) {
            const currentBalText = document.getElementById('summary-balance').innerText;
            balance = parseFloat(currentBalText) || 0;
            if (balance === 0) balance = 1000;
        }

        // 2. Calculate Risk Amount ($)
        const riskPct = parseFloat(dom.pct.value) || 2;
        const riskAmt = balance * (riskPct / 100);

        // 3. Asset Config
        const contractSize = parseFloat(dom.asset.options[dom.asset.selectedIndex].dataset.size) || 1;

        // 4. Logic & Validation based on Direction
        let isValidSetup = true;
        let setupError = "";

        // ตรวจสอบเงื่อนไขราคาตามทิศทาง
        if (dom.entry > 0 && dom.sl > 0) {
            if (dom.side === 'LONG') {
                if (dom.sl >= dom.entry) {
                    isValidSetup = false;
                    setupError = "Invalid Long: SL ≥ Entry";
                }
            } else { // SHORT
                if (dom.sl <= dom.entry) {
                    isValidSetup = false;
                    setupError = "Invalid Short: SL ≤ Entry";
                }
            }
        }

        // คำนวณระยะห่าง (Distance) เป็น Absolute เสมอสำหรับการคำนวณ Lot
        const distSL = Math.abs(dom.entry - dom.sl);
        const distTP = Math.abs(dom.tp - dom.entry);

        let lots = 0;
        let rewardAmt = 0;
        let margin = 0;
        let rr = 0;

        if (dom.entry > 0 && distSL > 0 && isValidSetup) {
            // Formula: RiskAmt / (Distance * Contract)
            lots = riskAmt / (distSL * contractSize);

            // Calculate Reward
            rewardAmt = lots * contractSize * distTP;

            // Calculate Margin
            const leverage = parseFloat(dom.lev.value) || 100;
            margin = (lots * contractSize * dom.entry) / leverage;

            // Calculate R:R
            rr = distTP / distSL;
        }

        // 5. Update UI
        if (!isValidSetup && dom.entry > 0 && dom.sl > 0) {
            // กรณี Setup ผิดพลาด
            dom.oLot.innerText = "ERROR";
            dom.oLot.classList.add('text-red-500');
            dom.oLot.classList.remove('text-white');

            dom.oEval.innerText = setupError;
            dom.oEval.className = "text-[10px] text-red-500 mt-1 font-bold animate-pulse";

            dom.oRisk.innerText = "$0.00";
            dom.oReward.innerText = "$0.00";
            dom.oMargin.innerText = "$0.00";
            dom.oRR.innerText = "- : -";
        } else {
            // กรณีปกติ
            dom.oLot.classList.remove('text-red-500');
            dom.oLot.classList.add('text-white');
            dom.oLot.innerText = lots > 0 ? lots.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";

            dom.oRisk.innerText = "$" + riskAmt.toLocaleString('en-US', { minimumFractionDigits: 2 });
            dom.oReward.innerText = "$" + rewardAmt.toLocaleString('en-US', { minimumFractionDigits: 2 });
            dom.oMargin.innerText = "$" + margin.toLocaleString('en-US', { minimumFractionDigits: 2 });

            if (dom.entry > 0 && dom.sl > 0 && dom.tp > 0) {
                dom.oRR.innerText = `1 : ${rr.toFixed(2)}`;

                if (rr < 1) {
                    dom.oRR.className = "text-xl font-mono font-bold text-red-400";
                    dom.oEval.innerText = "Poor Risk/Reward";
                    dom.oEval.className = "text-[10px] text-red-500 mt-1";
                } else if (rr < 2) {
                    dom.oRR.className = "text-xl font-mono font-bold text-yellow-400";
                    dom.oEval.innerText = "Moderate";
                    dom.oEval.className = "text-[10px] text-yellow-500 mt-1";
                } else {
                    dom.oRR.className = "text-xl font-mono font-bold text-green-400";
                    dom.oEval.innerText = "Excellent Setup!";
                    dom.oEval.className = "text-[10px] text-green-500 mt-1";
                }
            } else {
                dom.oRR.innerText = "0 : 0";
                dom.oRR.className = "text-xl font-mono font-bold text-slate-500";
                dom.oEval.innerText = "Waiting for inputs...";
                dom.oEval.className = "text-[10px] text-slate-600 mt-1";
            }
        }
    }
    // --- Market & Helpers ---

    // Live price removed: no updatePrice method

    async updateTHB() {
        try {
            const rate = await this.market.fetchTHB();
            if (rate) this.ui.updateTHB(rate);
        } catch (e) {
            console.warn('updateTHB error:', e);
        }
    }

    startMarketLoops() {
        // Fetch THB rate every 5 minutes instead of 15 seconds to avoid rate limiting
        this.updateTHB(); // Initial fetch
        setInterval(() => this.updateTHB(), 300000);
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
                "width": "100%", "height": "100%", "symbol": symbol, "interval": "D", "timezone": "Asia/Bangkok", "theme": "dark", "style": "1", "locale": "en", "toolbar_bg": "#f1f3f6", "enable_publishing": false, "container_id": "tv-chart-container", "backgroundColor": "rgba(15, 23, 42, 1)"
            });
        };
        document.head.appendChild(sc);
    }
}