// --- FILE 4: UI MANAGER ---
export class UIManager {
    constructor() {
        this.dom = {
            loginScreen: document.getElementById('login-screen'),
            appContent: document.getElementById('app-content'),
            displayName: document.getElementById('user-display-name'),
            errorBox: document.getElementById('auth-error-box'),
            domainDisplay: document.getElementById('domain-display'),
            loginStatus: document.getElementById('login-status'),
            panels: {
                journal: document.getElementById('journal-panel'),
                market: document.getElementById('market-panel')
            },
            inputs: {
                date: document.getElementById('input-date'),
                asset: document.getElementById('input-asset'),
                type: document.getElementById('input-type'),
                amount: document.getElementById('input-amount')
            },
            displays: {
                thb: document.getElementById('thb-rate')
            },
            list: document.getElementById('history-list')
        };
        this.chart = null;
        this.tradesChart = null;
        this.initChart();
        this.initTradesChart();
    }

    initChart() {
        const ctx = document.getElementById('pnlChart').getContext('2d');
        Chart.defaults.font.family = 'Rajdhani';
        Chart.defaults.color = '#64748b';
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    { label: 'Net P&L', data: [], backgroundColor: c => c.raw>=0 ? '#22c55e' : '#ef4444', borderRadius: 4, yAxisID: 'pnl', order: 1 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    pnl: { position: 'left', grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

    initTradesChart() {
        const ctx2 = document.getElementById('tradesChart').getContext('2d');
        this.tradesChart = new Chart(ctx2, {
            type: 'line',
            data: { labels: [], datasets: [ { label: 'Trades', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.15)', tension: 0.25, pointRadius: 4, borderWidth: 2 } ] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { position: 'right', grid: { display: false }, ticks: { color: '#f59e0b', stepSize: 1, beginAtZero: true }, beginAtZero: true, suggestedMax: 5 }
                },
                elements: { line: { fill: false } }
            }
        });
    }

    showLogin(show) {
        if(show) {
            this.dom.loginScreen.classList.remove('hidden');
            this.dom.appContent.classList.add('hidden');
            this.dom.appContent.classList.remove('flex');
        } else {
            this.dom.loginScreen.classList.add('hidden');
            this.dom.appContent.classList.remove('hidden');
            this.dom.appContent.classList.add('flex');
        }
    }

    showAuthError(isDomainError) {
        if(isDomainError) {
            this.dom.errorBox.classList.remove('hidden');
            this.dom.domainDisplay.innerText = window.location.hostname;
            this.dom.loginStatus.innerText = "";
        } else {
            this.dom.loginStatus.innerText = "ACCESS DENIED";
            this.dom.loginStatus.classList.add('text-red-500');
        }
    }

    // Live price removed — no-op placeholder to avoid errors
    updatePriceDisplay(/*price*/) {
        return;
    }

    updateTHB(rate) {
        if(rate) {
            this.dom.displays.thb.style.color = '#4ade80';
            this.dom.displays.thb.innerText = `${rate.toFixed(2)} ฿`;
            setTimeout(() => this.dom.displays.thb.style.color = 'white', 500);
        }
    }

    
    renderTradeList(trades, onDelete) {
        this.dom.list.innerHTML = '';
        if(trades.length === 0) {
            this.dom.list.innerHTML = '<div class="text-center text-slate-500 py-10 text-sm">No data found.</div>';
            return;
        }

        // Reverse clone to show newest first
        [...trades].sort((a,b) => b.id - a.id).forEach(t => {
            let borderClass = 'border-green-500', textClass = 'text-green-400', label = 'WIN';
            let type = t.type || (t.amount >= 0 ? 'WIN' : 'LOSS'); // Backward compat

            if(type === 'LOSS') { borderClass = 'border-red-500'; textClass = 'text-red-400'; label = 'LOSS'; }
            else if(type === 'DEPOSIT') { borderClass = 'border-blue-500'; textClass = 'text-blue-400'; label = 'DEPOSIT'; }
            else if(type === 'WITHDRAW') { borderClass = 'border-orange-500'; textClass = 'text-orange-400'; label = 'WITHDRAW'; }

            const div = document.createElement('div');
            div.className = `bg-slate-800/50 p-3 rounded-lg border-l-4 flex justify-between items-center group hover:bg-slate-800 transition ${borderClass}`;
            div.innerHTML = `
                <div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold font-mono text-slate-200">${t.asset}</span>
                        <span class="text-xs text-slate-500 bg-slate-900 px-1 rounded">${t.date}</span>
                    </div>
                    <div class="text-xs ${textClass} font-bold">${label}</div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="font-mono font-bold text-lg ${textClass}">${t.amount > 0 ? '+' : ''}${t.amount.toFixed(2)}</span>
                    <button class="delete-btn opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition" data-id="${t.firestoreId}">✕</button>
                </div>`;
            
            div.querySelector('.delete-btn').onclick = () => onDelete(t.firestoreId);
            this.dom.list.appendChild(div);
        });
    }

    updateStats(trades) {
        let net=0, dep=0, wd=0, wins=0, losses=0, best=-Infinity, worst=Infinity;
        const daily = {};
        const counts = {};

        trades.forEach(t => {
            let type = t.type || (t.amount >= 0 ? 'WIN' : 'LOSS');
            if (type === 'DEPOSIT') dep += t.amount;
            else if (type === 'WITHDRAW') wd += Math.abs(t.amount);
            else {
                net += t.amount;
                if(t.amount > 0) wins++; else losses++;
                daily[t.date] = (daily[t.date] || 0) + t.amount;
                counts[t.date] = (counts[t.date] || 0) + 1;
            }
        });

        const fund = dep - wd;
        const roi = fund > 0 ? (net/fund)*100 : 0;
        
        for(const v of Object.values(daily)) {
            if(v > best) best = v;
            if(v < worst) worst = v;
        }
        if(best === -Infinity) best = 0;
        if(worst === Infinity || worst > 0) worst = 0;

        // DOM Updates
        document.getElementById('summary-balance').innerText = (fund+net).toFixed(2);
        document.getElementById('summary-fund').innerText = fund.toFixed(2);
        const pEl = document.getElementById('summary-profit');
        pEl.innerText = (net>=0?'+':'')+net.toFixed(2);
        pEl.className = `text-2xl font-mono font-bold ${net>=0?'text-green-400':'text-red-400'}`;
        
        const roiEl = document.getElementById('summary-roi');
        roiEl.innerText = `${roi.toFixed(1)}% ROI`;
        roiEl.className = `text-xs ${roi>=0?'text-green-400':'text-red-400'}`;

        document.getElementById('summary-winrate').innerText = (wins+losses > 0 ? ((wins/(wins+losses))*100).toFixed(1) : 0) + '%';
        document.getElementById('summary-wincount').innerText = `${wins}W - ${losses}L`;

        // Chart
        const dates = Object.keys(daily).sort((a,b)=>new Date(a)-new Date(b));
        this.chart.data.labels = dates;
        this.chart.data.datasets[0].data = dates.map(d => daily[d]);
        this.chart.update();

        if(this.tradesChart) {
            this.tradesChart.data.labels = dates;
            const dataArr = dates.map(d => counts[d] || 0);
            this.tradesChart.data.datasets[0].data = dataArr;

            // Dynamically adjust y-axis max so the trades line fits and is visible
            const maxCount = dataArr.length ? Math.max(...dataArr) : 0;
            const padding = Math.ceil(maxCount * 0.25) || 1;
            const suggested = Math.max(5, maxCount + padding);
            if(!this.tradesChart.options) this.tradesChart.options = {};
            if(!this.tradesChart.options.scales) this.tradesChart.options.scales = {};
            this.tradesChart.options.scales.y = this.tradesChart.options.scales.y || {};
            this.tradesChart.options.scales.y.suggestedMax = suggested;
            this.tradesChart.options.scales.y.ticks = this.tradesChart.options.scales.y.ticks || {};
            this.tradesChart.options.scales.y.ticks.stepSize = maxCount > 10 ? Math.ceil((suggested) / 10) : 1;

            this.tradesChart.update();
        }

        // Total trades (count of WIN/LOSS entries)
        const totalTrades = Object.values(counts).reduce((s,v)=>s+v, 0);
        const totalEl = document.getElementById('summary-totaltrades');
        if(totalEl) totalEl.innerText = totalTrades;
    }

    switchTab(tabName) {
        const j = this.dom.panels.journal;
        const m = this.dom.panels.market;
        const bj = document.getElementById('tab-journal');
        const bm = document.getElementById('tab-market');

        if(tabName === 'journal') {
            j.classList.remove('hidden'); m.classList.add('hidden');
            bj.classList.add('nav-active','text-cyan-400'); bm.classList.remove('nav-active','text-cyan-400');
        } else {
            j.classList.add('hidden'); m.classList.remove('hidden');
            bm.classList.add('nav-active','text-cyan-400'); bj.classList.remove('nav-active','text-cyan-400');
        }
    }

    toggleInputStyle() {
        const type = this.dom.inputs.type.value;
        const amt = this.dom.inputs.amount;
        const asset = this.dom.inputs.asset;

        if(type === 'WIN') amt.className = "w-full px-3 py-2 rounded-lg font-mono text-green-400 font-bold";
        else if(type === 'LOSS') amt.className = "w-full px-3 py-2 rounded-lg font-mono text-red-400 font-bold";
        else if(type === 'DEPOSIT') amt.className = "w-full px-3 py-2 rounded-lg font-mono text-blue-400 font-bold";
        else if(type === 'WITHDRAW') amt.className = "w-full px-3 py-2 rounded-lg font-mono text-orange-400 font-bold";

        if(type === 'DEPOSIT' || type === 'WITHDRAW') {
            asset.disabled = true;
            asset.classList.add('opacity-50','cursor-not-allowed');
        } else {
            asset.disabled = false;
            asset.classList.remove('opacity-50','cursor-not-allowed');
        }
    }
}
