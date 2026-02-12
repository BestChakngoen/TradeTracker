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
        Chart.register(ChartDataLabels);
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Net P&L',
                        data: [],
                        backgroundColor: c => c.raw >= 0 ? '#22c55e' : '#ef4444',
                        borderRadius: 4,
                        yAxisID: 'pnl',
                        order: 1,
                        barPercentage: 0.7,
                        datalabels: {
                            color: function (context) {
                                const value = context.dataset.data[context.dataIndex];
                                if (value < 0) return '#ff0000';
                                return '#22c55e';
                            }
                        }
                    },
                    {
                        label: 'Orders',
                        data: [],
                        backgroundColor: '#f59e0b',
                        borderColor: '#fbbf24',
                        borderWidth: 0,
                        borderRadius: 2,
                        yAxisID: 'trades',
                        order: 2,
                        barPercentage: 0.7,
                        datalabels: {
                            color: '#f59e0b'
                        }
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 40,
                        right: 10,
                        bottom: 10,
                        left: 10
                    }
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        font: { size: 12, weight: 'bold', family: 'Rajdhani' },
                        formatter: function (value, context) {
                            if (value === 0 || value === null) return '';
                            if (context.dataset.label.includes('Orders')) {
                                return value + '';
                            }
                            return value.toFixed(2);
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                if (label.includes('Orders')) {
                                    return label + ': ' + value + ' orders';
                                }
                                return label + ': ' + value.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        offset: true,
                        categoryPercentage: 1.0
                    },
                    pnl: {
                        position: 'left',
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        title: { display: true, text: 'P&L (USD)' }
                    },
                    trades: {
                        position: 'right',
                        grid: { display: false },
                        ticks: { color: '#f59e0b', stepSize: 1, beginAtZero: true, font: { size: 11, weight: 'bold' } },
                        beginAtZero: true,
                        title: { display: true, text: 'Orders' }
                    }
                }
            }
        });
    }

    initTradesChart() {
        // Trades chart no longer needed - data is now on main pnl chart
        // This method kept for backward compatibility but does nothing
        return;
    }

    showLogin(show) {
        if (show) {
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
        if (isDomainError) {
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
        if (rate && this.dom.displays && this.dom.displays.thb) {
            this.dom.displays.thb.style.color = '#4ade80';
            this.dom.displays.thb.innerText = `${parseFloat(rate).toFixed(2)} ฿`;
            setTimeout(() => {
                if (this.dom.displays.thb) this.dom.displays.thb.style.color = 'white';
            }, 500);
        }
    }


    renderTradeList(trades, onDelete) {
        this.dom.list.innerHTML = '';
        if (trades.length === 0) {
            this.dom.list.innerHTML = '<div class="text-center text-slate-500 py-10 text-sm">No data found.</div>';
            return;
        }

        // Reverse clone to show newest first
        [...trades].sort((a, b) => b.id - a.id).forEach(t => {
            let borderClass = 'border-green-500', textClass = 'text-green-400', label = 'WIN';
            let type = t.type || (t.amount >= 0 ? 'WIN' : 'LOSS'); // Backward compat
            // Ensure date is a valid string
            const dateStr = (t.date && typeof t.date === 'string' && t.date.match(/^\d{4}-\d{2}-\d{2}/)) ? t.date : 'N/A';

            if (type === 'LOSS') { borderClass = 'border-red-500'; textClass = 'text-red-400'; label = 'LOSS'; }
            else if (type === 'DEPOSIT') { borderClass = 'border-blue-500'; textClass = 'text-blue-400'; label = 'DEPOSIT'; }
            else if (type === 'WITHDRAW') { borderClass = 'border-orange-500'; textClass = 'text-orange-400'; label = 'WITHDRAW'; }

            const div = document.createElement('div');
            div.className = `bg-slate-800/50 p-3 rounded-lg border-l-4 flex justify-between items-center group hover:bg-slate-800 transition ${borderClass}`;
            div.innerHTML = `
                <div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold font-mono text-slate-200">${t.asset}</span>
                        <span class="text-xs text-slate-500 bg-slate-900 px-1 rounded">${dateStr}</span>
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
        try {
            let net = 0, dep = 0, wd = 0, wins = 0, losses = 0, best = -Infinity, worst = Infinity;
            const daily = {};
            const counts = {};

            // Process trades and build daily/counts maps
            for (let i = 0; i < trades.length; i++) {
                const t = trades[i];

                // Extract and validate date
                let dateStr = '1970-01-01';
                if (t.date) {
                    const dateType = typeof t.date;
                    if (dateType === 'string') {
                        const match = String(t.date).match(/^\d{4}-\d{2}-\d{2}/);
                        if (match) dateStr = match[0];
                    } else if (dateType === 'object' && typeof t.date.toISOString === 'function') {
                        dateStr = t.date.toISOString().split('T')[0];
                    }
                }

                const type = t.type || (t.amount >= 0 ? 'WIN' : 'LOSS');
                const amount = Number(t.amount) || 0;

                if (type === 'DEPOSIT') dep += amount;
                else if (type === 'WITHDRAW') wd += Math.abs(amount);
                else {
                    net += amount;
                    if (amount > 0) wins++; else losses++;
                    daily[dateStr] = (daily[dateStr] || 0) + amount;
                    counts[dateStr] = (counts[dateStr] || 0) + 1;
                }
            }

            const fund = dep - wd;
            const roi = fund > 0 ? (net / fund) * 100 : 0;

            for (const v of Object.values(daily)) {
                if (v > best) best = v;
                if (v < worst) worst = v;
            }
            if (best === -Infinity) best = 0;
            if (worst === Infinity || worst > 0) worst = 0;

            // DOM Updates
            document.getElementById('summary-balance').innerText = (fund + net).toFixed(2);
            document.getElementById('summary-fund').innerText = fund.toFixed(2);
            const pEl = document.getElementById('summary-profit');
            pEl.innerText = (net >= 0 ? '+' : '') + net.toFixed(2);
            pEl.className = `text-2xl font-mono font-bold ${net >= 0 ? 'text-green-400' : 'text-red-400'}`;

            const roiEl = document.getElementById('summary-roi');
            roiEl.innerText = `${roi.toFixed(1)}% ROI`;
            roiEl.className = `text-xs ${roi >= 0 ? 'text-green-400' : 'text-red-400'}`;

            document.getElementById('summary-winrate').innerText = (wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : 0) + '%';
            document.getElementById('summary-wincount').innerText = `${wins}W - ${losses}L`;

            // Build chart labels and data arrays - ensure all are primitives (strings/numbers)
            const dateLabels = [];
            const pnlData = [];
            const tradesData = [];

            Object.keys(daily).forEach(key => {
                // Only include valid date strings
                if (typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
                    dateLabels.push(key);
                    pnlData.push(Number(daily[key]) || 0);
                    tradesData.push(Number(counts[key]) || 0);
                }
            });

            // Sort by date
            const indices = dateLabels.map((d, i) => ({ d, i }))
                .sort((a, b) => new Date(a.d) - new Date(b.d))
                .map(x => x.i);

            const sortedLabels = indices.map(i => dateLabels[i]);
            const sortedPnl = indices.map(i => pnlData[i]);
            const sortedTrades = indices.map(i => tradesData[i]);

            // Update PnL chart with clean data
            if (this.chart && this.chart.data) {
                this.chart.data.labels = sortedLabels;
                if (this.chart.data.datasets) {
                    // Update P&L data (dataset 0)
                    if (this.chart.data.datasets[0]) {
                        this.chart.data.datasets[0].data = sortedPnl;
                    }
                    // Update Trades count data (dataset 1)
                    if (this.chart.data.datasets[1]) {
                        this.chart.data.datasets[1].data = sortedTrades;
                    }
                }
                this.chart.update();
            }

            // Total trades
            const totalTrades = wins + losses;
            const totalEl = document.getElementById('summary-totaltrades');
            if (totalEl) totalEl.innerText = totalTrades;
        } catch (e) {
            console.error('Error in updateStats:', e);
        }
    }

    // Apply cloud-provided meta (optional). Expected shape: { totalTrades: number, counts: { date: number } }
    updateCloudStats(meta) {
        console.log('updateCloudStats called with meta:', meta);
        if (!meta) return;
        const totalEl = document.getElementById('summary-totaltrades');
        if (!totalEl) return;
        // Accept numbers or numeric strings from cloud
        const val = (meta && meta.totalTrades != null) ? Number(meta.totalTrades) : NaN;
        if (isNaN(val)) return;
        const cur = Number(totalEl.innerText) || 0;
        // Use Firebase value only if it's greater than current (prefer live calculation)
        if (val > cur) {
            totalEl.innerText = val;
            totalEl.style.color = '#38bdf8';
            setTimeout(() => totalEl.style.color = 'white', 500);
        }
        // if meta.counts exists we could choose to prefer it for tradesChart data, but current implementation
        // uses live trades array for plotting; meta is used here mainly to reflect cloud-synced totals.
    }


    switchTab(tabName) {
        ['journal', 'market', 'calc'].forEach(name => {
            const panel = document.getElementById(`${name}-panel`);
            const tab = document.getElementById(`tab-${name}`);
            if (!panel || !tab) return;

            if (name === tabName) {
                panel.classList.remove('hidden');
                if (name === 'journal' || name === 'calc') panel.classList.add('flex');
                tab.classList.add('nav-active', 'text-cyan-400');
                tab.classList.remove('text-slate-500');
            } else {
                panel.classList.add('hidden');
                if (name === 'journal' || name === 'calc') panel.classList.remove('flex');
                tab.classList.remove('nav-active', 'text-cyan-400');
                tab.classList.add('text-slate-500');
            }
        });
    }

    toggleInputStyle() {
        const type = this.dom.inputs.type.value;
        const amt = this.dom.inputs.amount;
        const asset = this.dom.inputs.asset;

        if (type === 'WIN') amt.className = "w-full px-3 py-2 rounded-lg font-mono text-green-400 font-bold";
        else if (type === 'LOSS') amt.className = "w-full px-3 py-2 rounded-lg font-mono text-red-400 font-bold";
        else if (type === 'DEPOSIT') amt.className = "w-full px-3 py-2 rounded-lg font-mono text-blue-400 font-bold";
        else if (type === 'WITHDRAW') amt.className = "w-full px-3 py-2 rounded-lg font-mono text-orange-400 font-bold";

        if (type === 'DEPOSIT' || type === 'WITHDRAW') {
            asset.disabled = true;
            asset.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            asset.disabled = false;
            asset.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}
