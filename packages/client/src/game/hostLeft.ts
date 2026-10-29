import { ScoreBoard, type BoardData } from './scoreBoard.ts';

/** A button on the screen: its label, id (tests click it by id) and what it does. */
export interface HostLeftAction {
  id: string;
  label: string;
  primary?: boolean;
  run: () => void;
}

/**
 * The screen a friend sees when the browser hosting their match goes: the
 * last standings they had, what happened ("The host left", "Reconnecting to
 * host…", "Ann is taking over…") and, once it's over, what to do next
 * (Host this map, Back to menu). One at a time; it stays over whatever is
 * behind it (a match loading while we reconnect, or the menu) until hidden.
 */
export class HostLeftScreen {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly text: HTMLElement;
  private readonly actions: HTMLElement;
  private readonly board: ScoreBoard;

  constructor(standings: BoardData | null) {
    document.getElementById('host-left')?.remove();
    const root = (this.root = document.createElement('div'));
    root.id = 'host-left';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    const card = document.createElement('div');
    card.className = 'panel hl-card';
    this.title = document.createElement('h2');
    this.title.className = 'panel-title';
    this.title.id = 'hl-title';
    this.text = document.createElement('p');
    this.text.id = 'hl-text';
    this.text.setAttribute('role', 'status');
    const box = document.createElement('div');
    box.id = 'hl-board';
    box.className = 'hl-board';
    this.board = new ScoreBoard(box, { maxWidth: 620, sizeSelf: false });
    if (standings) this.board.render(standings);
    box.hidden = !standings;
    this.actions = document.createElement('div');
    this.actions.className = 'hl-actions';
    card.append(this.title, this.text, box, this.actions);
    root.append(card);
    document.body.append(root);
  }

  /** Something is under way (reconnecting, someone taking over): no buttons yet. */
  wait(title: string, text: string): void {
    this.title.textContent = title;
    this.text.textContent = text;
    this.root.dataset.state = 'wait';
    this.actions.replaceChildren();
  }

  /** It's over: say so, and offer what to do next. */
  ended(title: string, text: string, actions: readonly HostLeftAction[]): void {
    this.title.textContent = title;
    this.text.textContent = text;
    this.root.dataset.state = 'ended';
    this.actions.replaceChildren(
      ...actions.map((a) => {
        const b = document.createElement('button');
        b.id = a.id;
        b.textContent = a.label;
        if (a.primary) b.className = 'primary';
        b.addEventListener('click', () => a.run(), { once: true });
        return b;
      }),
    );
    (this.actions.querySelector('button.primary') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  get shown(): boolean {
    return this.root.isConnected;
  }

  hide(): void {
    this.root.remove();
  }
}
