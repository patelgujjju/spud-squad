import { button, element } from '../dom.js';

export class HomeScreen {
  readonly node = element('section', 'home-screen');
  private create: HTMLButtonElement;
  private join: HTMLButtonElement;
  readonly nickname = element('input');
  readonly code = element('input', 'code-input');
  private error = element('p', 'form-error');
  constructor(
    name: string,
    code: string,
    onCreate: () => void,
    onJoin: () => void,
  ) {
    const intro = element('div', 'home-intro');
    intro.append(
      element('p', 'eyebrow light', 'A PRIVATE PARTY GAME FOR 2–10 FRIENDS'),
      element('h1', 'home-title', 'SPUD\nSQUAD'),
      element('div', 'potato-mark'),
    );
    const tagline = element(
      'h2',
      'home-tagline',
      'One potato.\nToo many cooks.',
    );
    intro.append(
      tagline,
      element(
        'p',
        'home-copy',
        'You get some buttons. Your friends get the rest. Get Spud out of the factory. Try to stay friends.',
      ),
    );
    const panel = element('div', 'home-card');
    panel.append(
      element('span', 'eyebrow', 'CLOCK IN, CREW'),
      element('h2', '', 'Who’s on potato duty?'),
    );
    this.nickname.id = 'nickname';
    this.nickname.value = name;
    this.nickname.maxLength = 20;
    this.nickname.setAttribute('autocomplete', 'nickname');
    const nameLabel = element('label', '', 'Your nickname');
    nameLabel.htmlFor = 'nickname';
    this.create = button('Create a room →', onCreate, 'button primary large');
    const divider = element('div', 'divider', 'OR JOIN YOUR FRIENDS');
    const form = element('form', 'join-form');
    this.code.id = 'room-code';
    this.code.placeholder = 'ABCDE';
    this.code.value = code;
    this.code.maxLength = 5;
    this.code.autocomplete = 'off';
    this.code.autocapitalize = 'characters';
    this.code.spellcheck = false;
    this.code.addEventListener('input', () => {
      this.code.value = this.code.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
    });
    const codeLabel = element('label', '', 'Five-character room code');
    codeLabel.htmlFor = 'room-code';
    this.join = button('Join room', onJoin, 'button secondary');
    form.append(codeLabel, this.code, this.join);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      onJoin();
    });
    this.error.setAttribute('role', 'alert');
    panel.append(
      nameLabel,
      this.nickname,
      this.create,
      divider,
      form,
      this.error,
      element(
        'p',
        'tiny fine-print',
        'No account. No downloads. Just share the code.',
      ),
    );
    this.node.append(intro, panel);
  }
  busy(value: boolean): void {
    this.create.disabled = value;
    this.join.disabled = value;
    this.error.textContent = value ? 'Getting your room ready…' : '';
  }
  showError(message: string): void {
    this.busy(false);
    this.error.textContent = message;
  }
}
