/* Fork: the game board from the keyboard (and for anything that is not a mouse).
 *
 * The board marks what you can act on with a `--can-interact` style class, on
 * whatever element that component happens to listen for clicks on -- usually a
 * bare <img>, which a keyboard cannot reach. Rather than touch every one of
 * those components, this watches the board and, while an element carries the
 * marker:
 *   - gives it a Tab stop and role=button, so Tab walks what you can do now;
 *   - makes Enter and Space press it, as a click would.
 * When the marker goes, so do the Tab stop and role.
 *
 * It also numbers the offered options (the buttons under a question): 1-9 then
 * 0 press them in the order shown, and each button draws its key. Digits rather
 * than the home row because the default profile already binds d, r, e, u and c.
 * Only the digit row: the Tabletop Simulator profile puts tokens on the numpad.
 */

/* What counts as "can act on this now". PlayerTabs uses the same list to put a
 * dot on a tab with something to do in it. */
export const ACTIONABLE_SELECTOR = [
  '[data-game-actionable="true"]',
  '[class*="--can-interact"]',
  '[class*="--can-progress"]',
  '.can-interact',
  '.deck--can-draw',
  '.clue--can-spend',
  '.resource--can-take',
].join(',')

const OPTION_SELECTOR = '.question-choices button:not(:disabled)'
const OPTION_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

// what we added, so we only ever take back our own attributes
const MARK = 'data-kb-actionable'
const NATIVE = 'button, a[href], input, select, textarea, [tabindex], [contenteditable="true"]'

function isShown(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false
  if (el.closest('[inert], [aria-hidden="true"]')) return false
  return getComputedStyle(el).visibility !== 'hidden'
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return !!target.closest('input, textarea, select, [contenteditable="true"]')
}

/* Press it the way a mouse would. Most markers sit on the element with the
 * click handler, but some sit on a wrapper (an asset's frame, a location's
 * cell) whose handler is on an image inside it -- so click what is actually at
 * its centre, as a pointer would, when that is inside it. */
function press(el: HTMLElement) {
  if (el.tagName !== 'IMG') {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    if (hit instanceof HTMLElement && el.contains(hit)) {
      hit.click()
      return
    }
  }
  el.click()
}

function label(el: HTMLElement): string | null {
  const own = el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('title')
  if (own) return own
  const img = el.tagName === 'IMG' ? el : el.querySelector('img')
  return img?.getAttribute('alt') || null
}

/* The board, and #modal, where its pop-ups (questions included) are teleported
 * to -- outside #game, but every bit as much the board. */
const SCOPES = ['#game', '#modal']

function inScope(): HTMLElement[] {
  return SCOPES.map((s) => document.querySelector<HTMLElement>(s)).filter((el): el is HTMLElement => !!el)
}

function all(selector: string): HTMLElement[] {
  return inScope().flatMap((scope) => [...scope.querySelectorAll<HTMLElement>(selector)])
}

function sync() {
  const now = new Set<HTMLElement>()
  for (const el of all(ACTIONABLE_SELECTOR)) {
    // innermost wins: a location's cell and its card would be two stops for one thing
    if (el.querySelector(ACTIONABLE_SELECTOR)) continue
    if (el.matches(NATIVE) && !el.hasAttribute(MARK)) continue
    // the shared marker also sits on panels (a question) whose buttons are the
    // controls; those buttons are reachable already
    if (el.matches('[data-game-actionable="true"]') && el.querySelector(NATIVE)) continue
    now.add(el)
    if (!el.hasAttribute(MARK)) {
      el.setAttribute(MARK, '')
      el.setAttribute('tabindex', '0')
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button')
      const name = label(el)
      if (name && !el.hasAttribute('aria-label')) el.setAttribute('aria-label', name)
    }
  }
  for (const el of all(`[${MARK}]`)) {
    if (now.has(el)) continue
    el.removeAttribute(MARK)
    el.removeAttribute('tabindex')
    if (el.getAttribute('role') === 'button') el.removeAttribute('role')
  }

  const options = all(OPTION_SELECTOR).filter(isShown)
  const numbered = new Set(options.slice(0, OPTION_KEYS.length))
  options.slice(0, OPTION_KEYS.length).forEach((el, i) => {
    if (el.dataset.choiceKey !== OPTION_KEYS[i]) el.dataset.choiceKey = OPTION_KEYS[i]
  })
  for (const el of all('[data-choice-key]')) {
    if (!numbered.has(el)) delete el.dataset.choiceKey
  }
}

/* Returns the function that undoes it. Game.vue installs it while a game is
 * open; only #game and #modal are ever touched (see SCOPES). */
export function installBoardAccess(): () => void {
  let queued = false
  const schedule = () => {
    if (queued) return
    queued = true
    // a timer rather than requestAnimationFrame, which never fires in a tab
    // that is not being drawn -- and the keys must work the moment it is
    setTimeout(() => {
      queued = false
      sync()
    }, 30)
  }
  // only class/disabled changes and new nodes can change what is actionable;
  // the attributes this file sets are not watched, so it cannot feed itself
  // body rather than the scopes themselves: #modal's content comes and goes
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'disabled'] })
  sync()

  const onKeydown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return

    const focused = document.activeElement
    if ((event.key === 'Enter' || event.key === ' ') && focused instanceof HTMLElement && focused.hasAttribute(MARK)) {
      // Game.vue's listener must not see it too: there Space means "continue"
      event.preventDefault()
      event.stopPropagation()
      press(focused)
      return
    }

    if (event.code.startsWith('Digit')) {
      const option = all(`[data-choice-key="${event.key}"]`)[0]
      if (option && isShown(option)) {
        event.preventDefault()
        event.stopPropagation()
        option.click()
      }
    }
  }
  // capture on the document, so this runs before Game.vue's own listener
  document.addEventListener('keydown', onKeydown, true)

  return () => {
    observer.disconnect()
    document.removeEventListener('keydown', onKeydown, true)
  }
}
