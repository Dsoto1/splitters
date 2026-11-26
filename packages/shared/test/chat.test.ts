import { describe, expect, it } from 'vitest';
import { CHAT_MAX_CHARS, CHAT_RATE, CHAT_REPEAT_MS, ChatRelay, chatHears, cleanChatText, filterChat, filteredWord, plainWord } from '../src/net/chat.ts';
import { CHAT_WORDS_ROT13, rot13 } from '../src/net/chatWords.ts';
import { parseClientMessage } from '../src/net/clientMessages.ts';

// The filter's words are kept ROT13'd (net/chatWords.ts); the tests spell them the same way.
const w = rot13;

describe('chat text: cleaning', () => {
  it('drops control, zero-width and direction marks, collapses spaces and cuts long lines', () => {
    expect(cleanChatText('  hello \n\t there  ')).toBe('hello there');
    expect(cleanChatText('a​b‮c\u0007d')).toBe('a b c d');
    expect(cleanChatText('​​')).toBe('');
    const long = 'x'.repeat(500);
    expect(cleanChatText(long)).toHaveLength(CHAT_MAX_CHARS);
    // Characters, not code units: an emoji at the cut is never split in half.
    expect(Array.from(cleanChatText('😀'.repeat(200)))).toHaveLength(CHAT_MAX_CHARS);
  });
});

describe('chat text: the word filter', () => {
  it('masks words on the list, each as many stars as it had characters', () => {
    expect(filterChat(`you ${w('shpx')}`)).toBe('you ****');
    expect(filterChat(`${w('shpxvat')} lag!`)).toBe('******* lag!');
    expect(filterChat('nice shot')).toBe('nice shot');
  });

  it('sees through capitals, look-alike digits, repeated letters, accents and marks', () => {
    for (const t of [w('shpx').toUpperCase(), 'f' + 'u'.repeat(5) + 'ck', `${w('fuvg')}!!!`, 'sh1t', '$hit', 'f.u.c.k', 'fück']) expect(filteredWord(t), t).toBe(true);
    expect(plainWord('Sh1T!')).toBe('shit');
  });

  it("a word kept at a word's start or whole spares innocent words that contain it", () => {
    // 'pre': Scunthorpe passes; 'word': cocktail, dickens, pakistan's capital-less name, coonhound pass.
    for (const t of ['Scunthorpe', 'cocktail', 'Dickens', 'raccoon', 'grape', 'class', 'assassin', 'Niger', 'snigger']) expect(filteredWord(t), t).toBe(false);
    for (const t of [w('phagf'), w('pbpxf'), w('qvpxf'), `${w('qvpx')}!?`]) expect(filteredWord(t), t).toBe(true);
  });

  it('every listed word is caught as written', () => {
    for (const [word] of CHAT_WORDS_ROT13) expect(filteredWord(rot13(word)), word).toBe(true);
  });

  it('masks phrases across words', () => {
    expect(filterChat(`just ${w('xvyy lbhefrys')} lol`)).toBe('just **** ******** lol');
    expect(filterChat('kill the yellow team')).toBe('kill the yellow team');
  });
});

describe('chat relay: limits per sender', () => {
  it('lets a burst through, then a line every 2 s', () => {
    let t = 1000;
    const relay = new ChatRelay(() => t);
    for (let i = 0; i < CHAT_RATE.burst; i++) expect(relay.say(3, `line ${i}`).ok).toBe(true);
    const over = relay.say(3, 'one more');
    expect(over).toEqual({ ok: false, why: expect.stringMatching(/slow down/i) });
    // Another sender has their own budget.
    expect(relay.say(4, 'hi').ok).toBe(true);
    t += 1000 / CHAT_RATE.perSecond;
    expect(relay.say(3, 'later').ok).toBe(true);
    expect(relay.say(3, 'too soon').ok).toBe(false);
  });

  it('drops the same line again for a while, and empty lines quietly', () => {
    let t = 0;
    const relay = new ChatRelay(() => t);
    expect(relay.say(1, 'Push B')).toEqual({ ok: true, text: 'Push B' });
    expect(relay.say(1, 'push b ')).toEqual({ ok: false, why: 'You just said that' });
    expect(relay.say(1, '  ​ ')).toEqual({ ok: false, why: '' });
    t += CHAT_REPEAT_MS + 1;
    expect(relay.say(1, 'Push B').ok).toBe(true);
  });

  it('passes the line on cleaned and filtered; a slot that left starts afresh', () => {
    let t = 0;
    const relay = new ChatRelay(() => t);
    expect(relay.say(2, `gg ${w('shpx')}​ off`)).toEqual({ ok: true, text: 'gg **** off' });
    for (let i = 0; i < 10; i++) relay.say(2, `spam ${i}`);
    expect(relay.say(2, 'still?').ok).toBe(false);
    relay.forget(2);
    expect(relay.say(2, 'new player here').ok).toBe(true);
  });
});

describe('chat: who hears a line', () => {
  it('all chat reaches everyone; team chat only the sender’s team; with no team it is all chat', () => {
    expect(chatHears(false, 'red', 'blue')).toBe(true);
    expect(chatHears(true, 'red', 'red')).toBe(true);
    expect(chatHears(true, 'red', 'blue')).toBe(false);
    expect(chatHears(true, 'red', null)).toBe(false);
    expect(chatHears(true, null, 'blue')).toBe(true);
  });
});

describe('chat: the wire', () => {
  it('a client line is shape-checked at the door', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'chat', x: 'hi' }))).toEqual({ t: 'chat', x: 'hi' });
    expect(parseClientMessage(JSON.stringify({ t: 'chat', x: 'hi', tm: 1 }))).toEqual({ t: 'chat', x: 'hi', tm: 1 });
    expect(parseClientMessage(JSON.stringify({ t: 'chat', x: 'hi', tm: true }))).toEqual({ t: 'chat', x: 'hi' });
    expect(parseClientMessage(JSON.stringify({ t: 'chat', x: 5 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'chat', x: 'y'.repeat(501) }))).toBeNull();
  });
});
