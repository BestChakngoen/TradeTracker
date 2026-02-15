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
                market: document.getElementById('market-panel'),
                // Added calc panel to dom tracking
                calc: document.getElementById('calc-panel'), 
                // ADDED: News Panel
                news: document.getElementById('news-panel')
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
            list: document.getElementById('history-list'),
            // NEW: Notes Elements
            notes: {
                title: document.getElementById('note-title'),
                list: document.getElementById('note-list'),
                input: document.getElementById('note-input'),
                btnAdd: document.getElementById('btn-add-note'),
                btnSave: document.getElementById('btn-save-note')
            },
            // NEW: Chart Navigation
            chartControls: {
                prev: document.getElementById('chart-prev'),
                next: document.getElementById('chart-next')
            },
            // NEW: History Tabs
            historyTabs: {
                trades: document.getElementById('hist-tab-trades'),
                transfers: document.getElementById('hist-tab-transfers')
            }
        };
        this.chart = null;
        this.tradesChart = null;
        this.periodStatsEl = null; // Element to show period summary

        // NEW: Chart State
        this.chartState = {
            pageIndex: 0, // 0 = Latest Page, 1 = Previous Page, ...
            limit: 7, // Show 7 days per page
            data: null
        };

        // NEW: History State
        this.historyState = {
            filter: 'TRADES', // 'TRADES' | 'TRANSFERS'
            data: [],
            onDelete: null
        };

        this.initChart();
        this.initTradesChart();
        this.initChartControls();
        this.initHistoryTabs();
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
                        textAlign: 'center', // Center text for multi-line labels
                        font: { size: 12, weight: 'bold', family: 'Rajdhani' },
                        formatter: function (value, context) {
                            if (value === 0 || value === null) return '';
                            if (context.dataset.label.includes('Orders')) {
                                return value + '';
                            }
                            
                            // UPDATED: Show percentage on top, amount below
                            let amountLabel = value.toFixed(2);
                            const percentages = context.dataset.customPercentages;
                            if (percentages && percentages[context.dataIndex] !== undefined) {
                                const pct = percentages[context.dataIndex];
                                // Add percentage line if it's not 0 or effectively 0
                                if (Math.abs(pct) > 0.001) {
                                    // Format: (Percentage)\nAmount
                                    return `(${pct > 0 ? '+' : ''}${pct.toFixed(1)}%)\n${amountLabel}`;
                                }
                            }
                            return amountLabel;
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
                                // Add percent to tooltip as well
                                let tooltipLabel = label + ': ' + value.toFixed(2);
                                const percentages = context.dataset.customPercentages;
                                if (percentages && percentages[context.dataIndex] !== undefined) {
                                    const pct = percentages[context.dataIndex];
                                    tooltipLabel += ` (${pct > 0 ? '+' : ''}${pct.toFixed(2)}%)`;
                                }
                                return tooltipLabel;
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

    // NEW: Chart Navigation Controls
    initChartControls() {
        // Find container to inject summary stats
        if (this.dom.chartControls.next && this.dom.chartControls.next.parentNode) {
            const btnContainer = this.dom.chartControls.next.parentNode;
            
            // Create stats element if not exists
            this.periodStatsEl = document.createElement('div');
            this.periodStatsEl.className = 'ml-3 text-xs font-mono font-bold flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-lg border border-slate-700/50';
            this.periodStatsEl.innerHTML = '<span class="text-slate-500">PERIOD:</span> <span class="text-slate-300">...</span>';
            
            // Insert after buttons
            btnContainer.parentNode.insertBefore(this.periodStatsEl, btnContainer.nextSibling);
            // If insert failed (layout diff), just append to parent
             if (!this.periodStatsEl.parentNode) btnContainer.parentNode.appendChild(this.periodStatsEl);
        }

        if(this.dom.chartControls.prev) {
            // Click Prev -> Go to Older Page (Increase page index)
            this.dom.chartControls.prev.onclick = () => this.shiftChart(1);
        }
        if(this.dom.chartControls.next) {
            // Click Next -> Go to Newer Page (Decrease page index)
            this.dom.chartControls.next.onclick = () => this.shiftChart(-1);
        }
    }

    shiftChart(delta) {
        if (!this.chartState.data) return;
        
        const totalLen = this.chartState.data.labels.length;
        const totalPages = Math.ceil(totalLen / this.chartState.limit);
        
        let newPageIndex = this.chartState.pageIndex + delta;

        // Clamp Lower Bound (Latest Page = 0)
        if (newPageIndex < 0) newPageIndex = 0;
        
        // Clamp Upper Bound (Oldest Page = totalPages - 1)
        if (newPageIndex >= totalPages) newPageIndex = totalPages - 1;

        if (newPageIndex !== this.chartState.pageIndex) {
            this.chartState.pageIndex = newPageIndex;
            this.renderChart();
        }
    }

    // NEW: Init History Tabs
    initHistoryTabs() {
        if(this.dom.historyTabs.trades) {
            this.dom.historyTabs.trades.onclick = () => this.setHistoryFilter('TRADES');
        }
        if(this.dom.historyTabs.transfers) {
            this.dom.historyTabs.transfers.onclick = () => this.setHistoryFilter('TRANSFERS');
        }
    }

    setHistoryFilter(filter) {
        this.historyState.filter = filter;
        
        // Update UI Tabs
        const t = this.dom.historyTabs.trades;
        const f = this.dom.historyTabs.transfers;
        const activeClasses = ['bg-slate-700', 'text-cyan-400', 'shadow-sm'];
        const inactiveClasses = ['text-slate-500', 'hover:text-slate-300'];

        if (filter === 'TRADES') {
            t.classList.add(...activeClasses);
            t.classList.remove(...inactiveClasses);
            f.classList.remove(...activeClasses);
            f.classList.add(...inactiveClasses);
        } else {
            f.classList.add(...activeClasses);
            f.classList.remove(...inactiveClasses);
            t.classList.remove(...activeClasses);
            t.classList.add(...inactiveClasses);
        }

        // Re-render list
        this.renderInternalHistoryList();
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

    // UPDATED: Now acts as a data setter and triggers internal render
    renderTradeList(trades, onDelete) {
        this.historyState.data = trades;
        this.historyState.onDelete = onDelete;
        this.renderInternalHistoryList();
    }

    // NEW: Internal render with filtering
    renderInternalHistoryList() {
        this.dom.list.innerHTML = '';
        const { data, filter, onDelete } = this.historyState;

        // Filter data based on active tab
        const filteredTrades = data.filter(t => {
            const type = t.type || (t.amount >= 0 ? 'WIN' : 'LOSS');
            if (filter === 'TRADES') {
                return type === 'WIN' || type === 'LOSS';
            } else {
                return type === 'DEPOSIT' || type === 'WITHDRAW';
            }
        });

        if (filteredTrades.length === 0) {
            this.dom.list.innerHTML = '<div class="text-center text-slate-500 py-10 text-sm">No data found in this category.</div>';
            return;
        }

        filteredTrades.forEach(t => {
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
                    <span class="font-mono font-bold text-lg ${textClass}">${t.amount > 0 ? '+' : ''}${Math.abs(t.amount).toFixed(2)}</span>
                    <button class="delete-btn opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition" data-id="${t.firestoreId}">✕</button>
                </div>`;

            div.querySelector('.delete-btn').onclick = () => onDelete(t.firestoreId);
            this.dom.list.appendChild(div);
        });
    }

    // --- NEW: RENDER NOTES ---
    renderNotes(data, onDeleteItem) {
        const { title, list, input } = this.dom.notes;
        
        // Update Title if different (avoid cursor jump if user is typing, handled by event listener usually, 
        // but here we just set it if it's a fresh load or empty)
        if (data.title !== undefined && document.activeElement !== title) {
            title.value = data.title;
        }

        // Render List
        list.innerHTML = '';
        if (data.items && data.items.length > 0) {
            data.items.forEach((item, index) => {
                const li = document.createElement('li');
                li.className = 'flex items-start gap-2 group';
                li.innerHTML = `
                    <span class="text-amber-500 mt-1.5">•</span>
                    <span class="flex-1 text-slate-300 text-sm leading-relaxed font-mono">${item}</span>
                    <button class="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition px-2" data-index="${index}">✕</button>
                `;
                li.querySelector('button').onclick = () => onDeleteItem(index);
                list.appendChild(li);
            });
        } else {
            list.innerHTML = '<li class="text-slate-600 text-xs italic">No items yet. Add one below.</li>';
        }
    }

    updateStats(trades) {
        try {
            let net = 0, dep = 0, wd = 0, wins = 0, losses = 0, best = -Infinity, worst = Infinity;
            const dailyPnL = {}; // Store PnL per day
            const dailyFlow = {}; // Store Deposits/Withdrawals per day (for running balance)
            const counts = {};

            // Process trades to build daily maps and total stats
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

                if (type === 'DEPOSIT') {
                    dep += amount;
                    dailyFlow[dateStr] = (dailyFlow[dateStr] || 0) + amount;
                } else if (type === 'WITHDRAW') {
                    wd += Math.abs(amount);
                    // Withdraw amount is negative in data, so adding it reduces flow
                    dailyFlow[dateStr] = (dailyFlow[dateStr] || 0) + amount;
                } else {
                    net += amount;
                    if (amount > 0) wins++; else losses++;
                    dailyPnL[dateStr] = (dailyPnL[dateStr] || 0) + amount;
                    counts[dateStr] = (counts[dateStr] || 0) + 1;
                }
            }

            // Calculate Best/Worst days
            for (const v of Object.values(dailyPnL)) {
                if (v > best) best = v;
                if (v < worst) worst = v;
            }
            if (best === -Infinity) best = 0;
            if (worst === Infinity || worst > 0) worst = 0;

            const fund = dep - wd;
            
            // --- RESTORED ROI CALCULATION ---
            const roi = fund > 0 ? (net / fund) * 100 : 0;

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

            // --- CHART DATA PREPARATION ---
            // Get all unique dates involved (Trades or Deposits)
            const allDates = new Set([...Object.keys(dailyPnL), ...Object.keys(dailyFlow)]);
            // Filter valid dates and Sort Chronologically (Oldest -> Newest)
            const sortedDates = Array.from(allDates)
                .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
                .sort((a, b) => new Date(a) - new Date(b));

            const sortedLabels = [];
            const sortedPnl = [];
            const sortedTrades = [];
            const sortedPercentages = [];
            const sortedBalances = []; // Store daily basis for summary calc

            let runningBalance = 0;

            // Iterate chronologically to maintain correct running balance
            sortedDates.forEach(date => {
                const dayPnL = dailyPnL[date] || 0;
                const dayFlow = dailyFlow[date] || 0; // Net Deposit/Withdraw for this day
                const dayCount = counts[date] || 0;

                // Basis for ROI = Balance at start of trading day + Inflows of that day
                // (Assuming you trade with money you have or just deposited)
                const dailyBasis = runningBalance + dayFlow;
                
                let pct = 0;
                if (Math.abs(dailyBasis) > 0.01) {
                    pct = (dayPnL / dailyBasis) * 100;
                }

                // Update Running Balance for the NEXT day
                runningBalance += dayFlow + dayPnL;

                // Only show bars for days that actually have trading activity (PnL)
                // This keeps the chart focused on performance, but % is now accurate based on history
                if (dailyPnL[date] !== undefined) {
                    sortedLabels.push(date);
                    sortedPnl.push(dayPnL);
                    sortedTrades.push(dayCount);
                    sortedPercentages.push(pct);
                    sortedBalances.push(dailyBasis); // Keep track of balance for period summary
                }
            });

            // Store Data and Render
            this.chartState.data = {
                labels: sortedLabels,
                pnl: sortedPnl,
                trades: sortedTrades,
                percentages: sortedPercentages,
                balances: sortedBalances
            };
            this.chartState.pageIndex = 0; // Reset to latest
            this.renderChart();

            // Total trades
            const totalTrades = wins + losses;
            const totalEl = document.getElementById('summary-totaltrades');
            if (totalEl) totalEl.innerText = totalTrades;
        } catch (e) {
            console.error('Error in updateStats:', e);
        }
    }

    // NEW: Render Chart based on Slice (Aligned to Oldest Data)
    renderChart() {
        if (!this.chart || !this.chartState.data) return;

        const { labels, pnl, trades, percentages, balances } = this.chartState.data;
        const totalLen = labels.length;
        const limit = this.chartState.limit;
        const totalPages = Math.ceil(totalLen / limit);
        
        // Calculate Slice indices for Pagination
        const chunkIndex = totalPages - 1 - this.chartState.pageIndex;
        
        let start = chunkIndex * limit;
        let end = Math.min(totalLen, start + limit);

        // Safety clamp
        if (start < 0) start = 0;
        if (end < start) end = start;
        
        const slicedLabels = labels.slice(start, end);
        const slicedPnl = pnl.slice(start, end);
        const slicedTrades = trades.slice(start, end);
        const slicedPercentages = percentages.slice(start, end);
        const slicedBalances = balances ? balances.slice(start, end) : [];

        // --- CALCULATE PERIOD SUMMARY ---
        if (this.periodStatsEl && slicedPnl.length > 0) {
            // Total PnL for this slice
            const totalSlicePnL = slicedPnl.reduce((a, b) => a + b, 0);
            
            // Starting balance is the balance of the FIRST day in this slice
            const startBalance = slicedBalances.length > 0 ? slicedBalances[0] : 0;
            
            let periodRoi = 0;
            if (Math.abs(startBalance) > 0.01) {
                periodRoi = (totalSlicePnL / startBalance) * 100;
            }

            const colorClass = totalSlicePnL >= 0 ? 'text-green-400' : 'text-red-400';
            const sign = totalSlicePnL >= 0 ? '+' : '';
            
            this.periodStatsEl.innerHTML = `<span class="text-slate-500 hidden md:inline">SUMMARY:</span> <span class="${colorClass}">${sign}${periodRoi.toFixed(2)}% (${sign}${totalSlicePnL.toFixed(2)})</span>`;
        } else if (this.periodStatsEl) {
            this.periodStatsEl.innerHTML = '<span class="text-slate-500">NO DATA</span>';
        }

        // Update Chart
        this.chart.data.labels = slicedLabels;
        this.chart.data.datasets[0].data = slicedPnl;
        this.chart.data.datasets[0].customPercentages = slicedPercentages;
        this.chart.data.datasets[1].data = slicedTrades;
        this.chart.update();

        // Update Buttons
        const isLatestPage = (this.chartState.pageIndex <= 0);
        const isOldestPage = (this.chartState.pageIndex >= totalPages - 1);
        
        if (this.dom.chartControls.next) {
            this.dom.chartControls.next.disabled = isLatestPage;
            this.dom.chartControls.next.style.opacity = isLatestPage ? '0.3' : '1';
        }
        
        if (this.dom.chartControls.prev) {
            this.dom.chartControls.prev.disabled = isOldestPage;
            this.dom.chartControls.prev.style.opacity = isOldestPage ? '0.3' : '1';
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
        ['journal', 'market', 'calc', 'news'].forEach(name => {
            const panel = document.getElementById(`${name}-panel`);
            const tab = document.getElementById(`tab-${name}`);
            if (!panel || !tab) return;

            if (name === tabName) {
                panel.classList.remove('hidden');
                // Added check for news panel display mode
                if (name === 'journal' || name === 'calc' || name === 'news') panel.classList.add('flex');
                tab.classList.add('nav-active', 'text-cyan-400');
                tab.classList.remove('text-slate-500');
            } else {
                panel.classList.add('hidden');
                // Added check for news panel display mode removal
                if (name === 'journal' || name === 'calc' || name === 'news') panel.classList.remove('flex');
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