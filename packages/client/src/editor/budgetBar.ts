import { BUDGET_ROWS, budgetLevel, budgetValue, type BudgetCounts, type BudgetId, type BudgetLevel, type BudgetRow } from '@tiletrigger/shared';

/** The words beside each colour (never colour alone). */
const LEVEL_WORDS: Record<BudgetLevel, string> = { ok: 'OK', near: 'Near', over: 'Over' };
const RANK: Record<BudgetLevel, number> = { ok: 0, near: 1, over: 2 };

/**
 * MapMaker's live budget bar (docs/MAPMAKER_OVERHAUL_PLAN.md, Phase 1 item 2): a compact item in the bottom status bar
 * (owner, 2026-11-08), green, amber or red with its word, naming the budget nearest its limit; clicking that name
 * selects what it counts (where those are things you can select). The arrow opens every row above it. It only draws
 * the counts it is given (BudgetTracker, updated on each edit), so it costs nothing between edits.
 */
export class BudgetBar {
  readonly root: HTMLElement;
  private readonly sum: HTMLElement;
  private readonly rows: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private last = '';

  /** `parent`: the status bar; it goes before `before` there (or last). */
  constructor(
    parent: HTMLElement,
    private readonly select: (id: BudgetId, row: BudgetRow) => void,
    before: Element | null = null,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'ed-budget';
    this.root.className = 'ed-budget';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-label', 'Map budgets');
    this.sum = document.createElement('div');
    this.sum.className = 'ed-budget-sum';
    this.toggle = document.createElement('button');
    this.toggle.type = 'button';
    this.toggle.id = 'ed-budget-toggle';
    this.toggle.className = 'ed-budget-toggle';
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.title = 'Every budget';
    this.toggle.textContent = '▴';
    this.rows = document.createElement('div');
    this.rows.id = 'ed-budget-rows';
    this.rows.className = 'ed-budget-rows';
    this.rows.hidden = true;
    this.toggle.addEventListener('click', () => {
      this.rows.hidden = !this.rows.hidden;
      this.toggle.setAttribute('aria-expanded', String(!this.rows.hidden));
      this.toggle.textContent = this.rows.hidden ? '▴' : '▾';
      this.toggle.blur();
    });
    this.root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-budget]');
      if (!b) return;
      const row = BUDGET_ROWS.find((r) => r.id === b.dataset.budget);
      if (row) this.select(row.id, row);
      (b as HTMLButtonElement).blur?.();
    });
    this.root.append(this.rows, this.sum, this.toggle);
    parent.insertBefore(this.root, before);
  }

  update(counts: BudgetCounts): void {
    const key = BUDGET_ROWS.map((r) => counts[r.id]).join(',');
    if (key === this.last) return;
    this.last = key;
    const rated = BUDGET_ROWS.map((r) => ({ row: r, n: counts[r.id], level: budgetLevel(counts[r.id], r.max), share: counts[r.id] / r.max }));
    // The one that tips the map over (or nearest to): the worst level, then the biggest share; hard limits first on a tie.
    const worst = rated.reduce((a, b) => (RANK[b.level] > RANK[a.level] || (RANK[b.level] === RANK[a.level] && b.share > a.share) ? b : a));
    const level = worst.level;
    this.root.dataset.level = level;
    // A name selects what it counts, where those are things you can select (not the file's size or entity cap).
    const name = (r: (typeof rated)[number]) =>
      r.row.id === 'size' || r.row.id === 'entities'
        ? `<span class="ed-budget-name">${r.row.label}</span>`
        : `<button type="button" class="ed-budget-name" data-budget="${r.row.id}" title="Select them: ${r.row.what}">${r.row.label}</button>`;
    const amount = (r: (typeof rated)[number]) => `${budgetValue(r.row, r.n)} / ${budgetValue(r.row, r.row.max)}`;
    const over = rated.filter((r) => r.level === 'over').length;
    this.sum.innerHTML =
      level === 'ok'
        ? `<span class="ed-budget-dot" aria-hidden="true"></span><b>Budget ${LEVEL_WORDS.ok}</b> <span class="ed-budget-most" title="The budget nearest its limit: ${worst.row.what}">${worst.row.label} ${amount(worst)}</span>`
        : `<span class="ed-budget-dot" aria-hidden="true"></span><b>${LEVEL_WORDS[level]}:</b> ${name(worst)} <span class="ed-budget-amt">${amount(worst)}</span>${over > 1 ? ` <span class="ed-budget-more">+${over - 1} more</span>` : ''}`;
    this.rows.innerHTML = rated
      .map(
        (r) =>
          `<div class="ed-budget-row lvl-${r.level}" title="${r.row.what}${r.row.hard ? ' (a load limit: the map is refused past it)' : ' (a soft budget: past it the map may run slowly)'}">${name(r)}<span class="ed-budget-meter" aria-hidden="true"><i style="width:${Math.min(100, Math.round(r.share * 100))}%"></i></span><span class="ed-budget-amt">${amount(r)}</span><span class="ed-budget-word">${LEVEL_WORDS[r.level]}</span></div>`,
      )
      .join('');
  }
}
