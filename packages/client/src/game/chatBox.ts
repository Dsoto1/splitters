import { CHAT_MAX_CHARS } from '@tiletrigger/shared/chat';

/**
 * The chat log and box (docs/MULTIPLAYER_PROTOCOL.md section 28), bottom left above the health: text chat and quick
 * messages, newest at the bottom. Closed, the last few lines show for LINE_SECONDS and then fade (no blinking: they
 * appear and go, once); open (Enter, or the team chat key), the recent lines show on a dark panel above the box.
 * Enter sends, Esc closes, Tab switches between your team and everyone (team modes).
 */
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export interface ChatLine {
  /** The sender's slot (-1: the match itself). */
  from: number;
  name: string;
  /** The sender's name colour (the HUD's: team colour, or yours). */
  color: string;
  text: string;
  /** Team chat (shown with a TEAM tag). */
  team?: boolean;
  /** A quick message (the menu, the wheel). */
  quick?: boolean;
}

/** How long a line stays up with the box closed (s), and how many show then. */
export const LINE_SECONDS = 12;
export const CLOSED_LINES = 5;
/** Lines kept for when the box opens. */
export const KEPT_LINES = 40;

export class ChatBox {
  readonly el: HTMLDivElement;
  private readonly log: HTMLDivElement;
  private readonly bar: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly channel: HTMLButtonElement;
  private readonly send: HTMLButtonElement;
  private isOpen = false;
  /** The box's channel: your team (team modes) or everyone. */
  toTeam = false;
  /** Team modes: the channel can be your team. */
  teams = false;
  /** A line typed and sent (Enter, or Send). */
  onSend?: (text: string, team: boolean) => void;
  /** The box opened or closed (the session gives the keyboard to it and back). */
  onOpen?: (open: boolean) => void;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'chat';
    this.log = document.createElement('div');
    this.log.id = 'chat-log';
    this.log.setAttribute('role', 'log');
    this.log.setAttribute('aria-live', 'polite');
    this.bar = document.createElement('div');
    this.bar.id = 'chat-bar';
    this.bar.hidden = true;
    this.channel = document.createElement('button');
    this.channel.type = 'button';
    this.channel.id = 'chat-channel';
    this.channel.title = 'Who hears it: your team or everyone (Tab)';
    this.channel.addEventListener('pointerdown', (e) => e.preventDefault());
    this.channel.addEventListener('click', () => this.flip());
    this.input = document.createElement('input');
    this.input.id = 'chat-input';
    this.input.type = 'text';
    this.input.maxLength = CHAT_MAX_CHARS;
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    this.input.enterKeyHint = 'send';
    this.input.setAttribute('aria-label', 'Chat message');
    this.send = document.createElement('button');
    this.send.type = 'button';
    this.send.id = 'chat-send';
    this.send.textContent = 'Send';
    this.send.addEventListener('pointerdown', (e) => e.preventDefault());
    this.send.addEventListener('click', () => this.submit());
    const hint = document.createElement('small');
    hint.id = 'chat-hint';
    hint.textContent = 'Enter: send · Tab: team or all · Esc: close';
    this.bar.append(this.channel, this.input, this.send, hint);
    this.el.append(this.log, this.bar);
    parent.append(this.el);
    this.input.addEventListener('keydown', (e) => {
      // The box's own keys; nothing typed here reaches the game (input.ts `typing`) or the page's other keys.
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.flip();
      }
    });
    this.input.addEventListener('keyup', (e) => e.stopPropagation());
    this.drawChannel();
  }

  get open(): boolean {
    return this.isOpen;
  }

  /** Open the box (`team`: on your team's channel; absent: the last one), the keyboard in it. */
  show(team?: boolean): void {
    if (team !== undefined) this.toTeam = team && this.teams;
    this.drawChannel();
    if (!this.isOpen) {
      this.isOpen = true;
      this.bar.hidden = false;
      this.el.classList.add('open');
      this.onOpen?.(true);
    }
    this.input.focus({ preventScroll: true });
    this.log.scrollTop = this.log.scrollHeight;
  }

  /** Close the box (what was typed is kept for next time, unless sent). */
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.bar.hidden = true;
    this.el.classList.remove('open');
    this.input.blur();
    this.onOpen?.(false);
  }

  /** A line in the log (text chat, a quick message, or the host's word). */
  add(line: ChatLine): void {
    const row = document.createElement('div');
    row.className = `chat-line${line.from < 0 ? ' sys' : ''}${line.quick ? ' quick' : ''}`;
    const tag = line.team ? '<i class="chat-tag">TEAM</i> ' : '';
    row.innerHTML = line.from < 0 ? escapeHtml(line.text) : `${tag}<b style="color:${line.color}">${escapeHtml(line.name)}:</b> ${escapeHtml(line.text)}`;
    this.log.append(row);
    while (this.log.children.length > KEPT_LINES) this.log.firstElementChild?.remove();
    // Closed, only the newest CLOSED_LINES show; each goes after LINE_SECONDS (a fade, once).
    const lines = [...this.log.children];
    for (let i = 0; i < lines.length - CLOSED_LINES; i++) lines[i]!.classList.add('gone');
    window.setTimeout(() => row.classList.add('gone'), LINE_SECONDS * 1000);
    if (this.isOpen) this.log.scrollTop = this.log.scrollHeight;
  }

  /** What the log shows (tests): each line's text and whether it has gone from the closed view. */
  lines(): { text: string; gone: boolean }[] {
    return [...this.log.children].map((r) => ({ text: r.textContent ?? '', gone: r.classList.contains('gone') }));
  }

  dispose(): void {
    this.close();
    this.el.remove();
  }

  private submit(): void {
    const text = this.input.value.trim();
    if (text) this.onSend?.(text, this.toTeam && this.teams);
    this.input.value = '';
    this.close();
  }

  private flip(): void {
    if (!this.teams) return;
    this.toTeam = !this.toTeam;
    this.drawChannel();
    this.input.focus({ preventScroll: true });
  }

  private drawChannel(): void {
    const team = this.toTeam && this.teams;
    this.channel.textContent = team ? 'Team' : 'All';
    this.channel.classList.toggle('team', team);
    this.channel.disabled = !this.teams;
    this.input.placeholder = team ? 'Say to your team…' : 'Say to everyone…';
  }
}
