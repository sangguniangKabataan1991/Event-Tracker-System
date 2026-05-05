<script lang="ts">
  import { onMount } from 'svelte';
  import { apiFetch } from '$lib/api.js';
  import BarChart2 from 'lucide-svelte/icons/bar-chart-2';
  import Trophy from 'lucide-svelte/icons/trophy';
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
  import CheckSquare from 'lucide-svelte/icons/check-square';
  import CalendarDays from 'lucide-svelte/icons/calendar-days';
  import TrendingUp from 'lucide-svelte/icons/trending-up';
  import ChevronLeft from 'lucide-svelte/icons/chevron-left';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import PieChart from 'lucide-svelte/icons/pie-chart';
  import SlidersHorizontal from 'lucide-svelte/icons/sliders-horizontal';

  interface ProgramStat       { title: string; category: string; beneficiary_count: number; slots: number; }
  interface MostAssisted      { full_name: string; address: string; program_count: number; }
  interface RepeatBeneficiary { full_name: string; address: string; times_assisted: number; }
  interface CategoryDist      { category: string; count: number; }
  interface PieSlice          { path: string; color: string; category: string; count: number; pct: number; }
  interface Report {
    perProgram: ProgramStat[];
    mostAssisted: MostAssisted[];
    repeatBeneficiaries: RepeatBeneficiary[];
    categoryDistribution?: CategoryDist[];
  }
  interface MonthlyRow  { month: number; month_name: string; beneficiary_count: number; programs_active: number; }
  interface YearlyRow   { year: number; beneficiary_count: number; programs_count: number; }
  interface MonthlyReport { monthly: MonthlyRow[]; yearly: YearlyRow[]; year: number; }

  let report        = $state<Report | null>(null);
  let monthlyReport = $state<MonthlyReport | null>(null);
  let loading       = $state(true);
  let selectedYear  = $state(new Date().getFullYear());

  let filterDateFrom = $state('');
  let filterDateTo   = $state('');
  let filterApplied  = $state(false);

  const MONTHS     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const PIE_COLORS = ['#0A1F44','#1d4ed8','#059669','#d97706','#dc2626','#7c3aed','#0891b2','#be185d'];

  onMount(async () => { await loadAll(); });

  async function loadAll() {
    loading = true;
    const qs = buildQueryString();
    [report, monthlyReport] = await Promise.all([
      apiFetch(`/beneficiaries/reports/summary${qs}`),
      apiFetch(`/beneficiaries/reports/monthly?year=${selectedYear}${qs ? '&' + qs.slice(1) : ''}`)
    ]);
    loading = false;
  }

  function buildQueryString(): string {
    const p = new URLSearchParams();
    if (filterDateFrom) p.set('date_from', filterDateFrom);
    if (filterDateTo)   p.set('date_to',   filterDateTo);
    const s = p.toString();
    return s ? '?' + s : '';
  }

  async function applyFilters() {
    filterApplied = !!(filterDateFrom || filterDateTo);
    await loadAll();
  }

  function clearFilters() {
    filterDateFrom = ''; filterDateTo = '';
    filterApplied = false;
    loadAll();
  }

  async function changeYear(dir: number) {
    selectedYear += dir;
    const qs = buildQueryString();
    monthlyReport = await apiFetch(
      `/beneficiaries/reports/monthly?year=${selectedYear}${qs ? '&' + qs.slice(1) : ''}`
    );
  }

  let monthGrid = $derived(
    MONTHS.map((name, i) => {
      const found = monthlyReport?.monthly.find(m => m.month === i + 1);
      return { month: i + 1, name, count: found?.beneficiary_count ?? 0, programs: found?.programs_active ?? 0 };
    })
  );

  let maxMonthCount = $derived(Math.max(...monthGrid.map(m => m.count), 1));
  let ySteps = $derived(Array.from({ length: 5 }, (_, i) => Math.round(maxMonthCount * (4 - i) / 4)));

  let pieResult = $derived((): { slices: PieSlice[]; total: number } => {
    if (!report) return { slices: [], total: 0 };
    const dist: CategoryDist[] =
      report.categoryDistribution && report.categoryDistribution.length > 0
        ? report.categoryDistribution
        : (() => {
            const map: Record<string, number> = {};
            for (const prog of report.perProgram)
              map[prog.category] = (map[prog.category] ?? 0) + prog.beneficiary_count;
            return Object.entries(map).map(([category, count]) => ({ category, count }));
          })();
    const total = dist.reduce((s, d) => s + d.count, 0);
    if (total === 0) return { slices: [], total: 0 };
    let angle = -Math.PI / 2;
    const slices = dist.map((d, i) => {
      const pct   = d.count / total;
      const end   = angle + pct * 2 * Math.PI;
      const large = pct > 0.5 ? 1 : 0;
      const r = 80; const cx = 120; const cy = 110;
      const x1 = (cx + r * Math.cos(angle)).toFixed(2);
      const y1 = (cy + r * Math.sin(angle)).toFixed(2);
      const x2 = (cx + r * Math.cos(end)).toFixed(2);
      const y2 = (cy + r * Math.sin(end)).toFixed(2);
      const path  = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      const color = PIE_COLORS[i % PIE_COLORS.length];
      const slice: PieSlice = { path, color, category: d.category, count: d.count, pct: Math.round(pct * 100) };
      angle = end;
      return slice;
    });
    return { slices, total };
  });
</script>

<style>
  @media print {
    .no-print { display: none !important; }
    .card { break-inside: avoid; box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
  }
</style>

<div class="p-4 sm:p-6 space-y-5 sm:space-y-6">

  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-xl sm:text-2xl font-bold text-gray-900">Reports</h1>
      <p class="text-gray-500 text-sm">Analytics for all programs and beneficiaries</p>
    </div>
  </div>

  <!-- Filters -->
  <div class="no-print card">
    <div class="flex items-center gap-2 mb-3">
      <SlidersHorizontal size={14} class="text-gray-400" />
      <span class="text-sm font-semibold text-gray-700">Filter Reports</span>
      {#if filterApplied}
        <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Filters active</span>
      {/if}
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label class="label flex items-center gap-1" for="rf-from">
          <CalendarDays size={11} class="text-gray-400" /> Date From
        </label>
        <input id="rf-from" type="date" bind:value={filterDateFrom} class="input" />
      </div>
      <div>
        <label class="label flex items-center gap-1" for="rf-to">
          <CalendarDays size={11} class="text-gray-400" /> Date To
        </label>
        <input id="rf-to" type="date" bind:value={filterDateTo} class="input" />
      </div>
    </div>
    <div class="flex gap-2 mt-3">
      <button onclick={applyFilters} class="btn-primary px-5 text-sm">Apply Filters</button>
      {#if filterApplied}
        <button onclick={clearFilters} class="btn-ghost text-sm">Clear</button>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="flex items-center gap-2 text-gray-400 text-sm py-12">
      <div class="w-4 h-4 border-2 border-gray-200 rounded-full animate-spin" style="border-top-color:#0A1F44;"></div>
      Loading reports...
    </div>
  {:else if report}

    <!-- Monthly Summary -->
    <div class="card">
      <div class="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 class="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
          <CalendarDays size={16} style="color:#0A1F44;" /> Monthly Beneficiary Distribution
        </h2>
        <div class="flex items-center gap-2 no-print">
          <button onclick={() => changeYear(-1)}
            class="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500">
            <ChevronLeft size={15} />
          </button>
          <span class="text-sm font-semibold text-gray-700 w-14 text-center">{selectedYear}</span>
          <button onclick={() => changeYear(1)}
            class="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500"
            disabled={selectedYear >= new Date().getFullYear()}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {#if monthGrid.every(m => m.count === 0)}
        <div class="text-center py-8 text-gray-400">
          <CalendarDays size={32} class="mx-auto mb-2 text-gray-300" />
          <p class="text-sm">No beneficiary data for {selectedYear}</p>
        </div>
      {:else}
        <!-- Chart: scrollable on mobile -->
        <div class="overflow-x-auto -mx-2 px-2">
          <div class="min-w-90">
            <div class="flex gap-2">
              <div class="flex flex-col justify-between text-right pr-2" style="height:120px; min-width:28px;">
                {#each ySteps as step}
                  <span class="text-[10px] text-gray-400 leading-none tabular-nums">{step}</span>
                {/each}
              </div>
              <div class="flex-1">
                <div class="relative" style="height:120px;">
                  {#each ySteps as _s, gi}
                    <div class="absolute left-0 right-0 border-t border-gray-100 pointer-events-none"
                         style="top:{gi / 4 * 100}%;"></div>
                  {/each}
                  <div class="absolute inset-0 flex items-end gap-1">
                    {#each monthGrid as m}
                      <div class="flex-1 flex flex-col justify-end h-full group">
                        {#if m.count > 0}
                          <div class="w-full rounded-t-md transition-all duration-300 relative cursor-default"
                            style="height:{Math.max(4, Math.round(m.count / maxMonthCount * 100))}%; background:#0A1F44;">
                            <div class="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition z-10 no-print">
                              {m.count}
                            </div>
                          </div>
                        {:else}
                          <div class="w-full rounded-t-md bg-gray-100" style="height:4px;"></div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
                <div class="flex gap-1 mt-1">
                  {#each monthGrid as m}
                    <div class="flex-1 text-center">
                      <span class="text-[10px] text-gray-400">{m.name}</span>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="overflow-x-auto mt-5">
          <table class="w-full text-sm min-w-[320px]">
            <thead class="text-left text-gray-500 border-b border-gray-100">
              <tr>
                <th class="pb-2 font-medium">Month</th>
                <th class="pb-2 font-medium text-right">Beneficiaries</th>
                <th class="pb-2 font-medium text-right">Programs Active</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              {#each monthGrid.filter(m => m.count > 0) as m}
                <tr class="hover:bg-gray-50">
                  <td class="py-2 font-medium">{m.name} {selectedYear}</td>
                  <td class="py-2 text-right"><span class="font-semibold" style="color:#0A1F44;">{m.count}</span></td>
                  <td class="py-2 text-right text-gray-500">{m.programs}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <!-- Yearly Summary -->
    {#if monthlyReport && monthlyReport.yearly.length > 0}
      <div class="card">
        <h2 class="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-sm sm:text-base">
          <TrendingUp size={16} style="color:#0A1F44;" /> Yearly Summary
        </h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm min-w-70">
            <thead class="text-left text-gray-500 border-b border-gray-100">
              <tr>
                <th class="pb-2 font-medium">Year</th>
                <th class="pb-2 font-medium text-right">Total Beneficiaries</th>
                <th class="pb-2 font-medium text-right">Programs</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              {#each monthlyReport.yearly as y}
                <tr class="hover:bg-gray-50">
                  <td class="py-2.5 font-semibold">{y.year}</td>
                  <td class="py-2.5 text-right"><span class="font-bold" style="color:#0A1F44;">{y.beneficiary_count}</span></td>
                  <td class="py-2.5 text-right text-gray-500">{y.programs_count}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    <!-- Main Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

      <!-- Beneficiaries per Program -->
      <div class="card">
        <h2 class="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-sm sm:text-base">
          <BarChart2 size={16} style="color:#0A1F44;" /> Beneficiaries per Program
        </h2>
        {#if report.perProgram.length === 0}
          <p class="text-gray-400 text-sm">No data available yet</p>
        {:else}
          <div class="space-y-3">
            {#each report.perProgram as p}
              {@const pct = p.slots > 0 ? Math.round(p.beneficiary_count / p.slots * 100) : 0}
              <div>
                <div class="flex justify-between text-sm mb-1 gap-2">
                  <span class="font-medium truncate flex-1">{p.title}</span>
                  <span class="text-gray-500 shrink-0">{p.beneficiary_count} / {p.slots}</span>
                </div>
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full rounded-full" style="width:{pct}%; background:#0A1F44;"></div>
                </div>
                <div class="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>{p.category}</span><span>{pct}% filled</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Right column: Category Dist + Most Assisted -->
      <div class="flex flex-col gap-5">

        <!-- Category Distribution -->
        <div class="card">
          <h2 class="font-semibold text-gray-800 mb-3 flex items-center gap-2 text-sm sm:text-base">
            <PieChart size={15} style="color:#0A1F44;" /> Category Distribution
          </h2>
          {#if pieResult().slices.length === 0}
            <p class="text-gray-400 text-sm">No data available yet</p>
          {:else}
            <div class="flex flex-col sm:flex-row items-center gap-4">
              <svg width="130" height="130" viewBox="0 0 240 220" class="shrink-0">
                {#each pieResult().slices as s}
                  <path d={s.path} fill={s.color} stroke="white" stroke-width="2" />
                {/each}
                <circle cx="120" cy="110" r="44" fill="white" />
                <text x="120" y="106" text-anchor="middle" font-size="20" font-weight="600" fill="#0A1F44">{pieResult().total}</text>
                <text x="120" y="122" text-anchor="middle" font-size="10" fill="#6b7280">total</text>
              </svg>
              <div class="space-y-1.5 w-full">
                {#each pieResult().slices as s}
                  <div class="flex items-center gap-2">
                    <div class="w-2.5 h-2.5 rounded-sm shrink-0" style="background:{s.color};"></div>
                    <span class="text-xs text-gray-700 flex-1 truncate">{s.category}</span>
                    <span class="text-xs text-gray-400 whitespace-nowrap">{s.count} · {s.pct}%</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Most Assisted -->
        <div class="card">
          <h2 class="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-sm sm:text-base">
            <Trophy size={16} class="text-yellow-500" /> Most Assisted Individuals
          </h2>
          {#if report.mostAssisted.length === 0}
            <p class="text-gray-400 text-sm">No data yet</p>
          {:else}
            <div class="space-y-2">
              {#each report.mostAssisted.slice(0, 10) as r, i}
                <div class="flex items-center gap-3">
                  <span class="text-xs font-bold text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate">{r.full_name}</div>
                    <div class="text-xs text-gray-400 truncate">{r.address}</div>
                  </div>
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium text-white shrink-0" style="background:#0A1F44;">
                    {r.program_count}x
                  </span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      </div>
    </div>

    <!-- Repeat Beneficiaries -->
    <div class="card">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 class="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
          <AlertTriangle size={16} class="text-orange-500" /> Repeat Benefit Recipients
        </h2>
        {#if report.repeatBeneficiaries.length > 0}
          <span class="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-medium">
            {report.repeatBeneficiaries.length} flagged
          </span>
        {/if}
      </div>
      {#if report.repeatBeneficiaries.length === 0}
        <div class="text-center py-6">
          <CheckSquare size={28} class="mx-auto mb-2 text-green-400" />
          <p class="text-gray-400 text-sm">No repeat beneficiaries — distribution looks fair!</p>
        </div>
      {:else}
        <div class="mb-3 bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5 text-xs text-orange-700 flex items-center gap-2">
          <AlertTriangle size={13} class="shrink-0" />
          These residents received benefits more than once. Review before approving new applications.
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm min-w-[320px]">
            <thead class="text-left text-gray-500 border-b border-gray-100">
              <tr>
                <th class="pb-2 font-medium">Name</th>
                <th class="pb-2 font-medium hidden sm:table-cell">Address</th>
                <th class="pb-2 font-medium text-right">Times</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              {#each report.repeatBeneficiaries as r}
                <tr class="hover:bg-gray-50">
                  <td class="py-2.5 font-medium">
                    {r.full_name}
                    <div class="text-xs text-gray-400 sm:hidden truncate">{r.address}</div>
                  </td>
                  <td class="py-2.5 text-gray-500 hidden sm:table-cell">{r.address}</td>
                  <td class="py-2.5 text-right">
                    <span class="px-2 py-0.5 rounded-full text-xs font-bold {r.times_assisted >= 3 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}">
                      {r.times_assisted}x
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

  {/if}
</div>