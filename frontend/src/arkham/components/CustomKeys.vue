<script lang="ts" setup>
/* Fork: choose your own key for the actions a game is played with. Shown in
 * the in-game Settings under the key profile; see keybindings.ts for how a
 * chosen key beats the profile's. English only, like the rest of this fork. */
import { onBeforeUnmount, ref } from 'vue'
import {
  REMAPPABLE_ACTIONS,
  bindingFromEvent,
  customKeys,
  setCustomKey,
  useKeybindings,
  type ShortcutAction,
} from '@/arkham/keybindings'

const LABELS: Record<string, string> = {
  continue: 'OK / continue',
  undo: 'Undo',
  endTurn: 'End turn',
  draw: 'Draw',
  takeResources: 'Take resource',
}

const { keys } = useKeybindings()
const listening = ref<ShortcutAction | null>(null)

// keys that only modify, or that already mean something everywhere
const IGNORED = new Set(['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock'])

function onKey(event: KeyboardEvent) {
  if (!listening.value || IGNORED.has(event.key)) return
  // the capture listener runs before the board's, which must not also act
  event.preventDefault()
  event.stopImmediatePropagation()
  if (event.key !== 'Escape') setCustomKey(listening.value, bindingFromEvent(event))
  stopListening()
}

function listen(action: ShortcutAction) {
  stopListening()
  listening.value = action
  window.addEventListener('keydown', onKey, true)
}

function stopListening() {
  listening.value = null
  window.removeEventListener('keydown', onKey, true)
}

onBeforeUnmount(stopListening)
</script>

<template>
  <div class="custom-keys">
    <div v-for="action in REMAPPABLE_ACTIONS" :key="action" class="custom-key">
      <span class="custom-key-name">{{ LABELS[action] }}</span>
      <span class="custom-key-current">
        <template v-if="listening === action">Press a key… (Esc cancels)</template>
        <template v-else-if="keys(action).length"><kbd v-for="k in keys(action)" :key="k">{{ k }}</kbd></template>
        <template v-else>none</template>
      </span>
      <button type="button" @click="listen(action)">Change</button>
      <button v-if="customKeys[action]" type="button" @click="setCustomKey(action, null)">Reset</button>
    </div>
    <p class="custom-keys-note">Number keys 1–9 and 0 pick the offered options in order.</p>
  </div>
</template>

<style scoped>
.custom-keys {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0 8px;
}
.custom-key {
  display: grid;
  grid-template-columns: minmax(8em, 1fr) minmax(8em, 1fr) auto auto;
  align-items: center;
  gap: 8px;
}
.custom-key button {
  min-height: 36px;
  padding: 0 12px;
}
kbd {
  display: inline-block;
  min-width: 1.6em;
  padding: 1px 6px;
  margin-right: 4px;
  border: 1px solid currentColor;
  border-radius: 4px;
  text-align: center;
  font-family: inherit;
}
.custom-keys-note {
  margin: 4px 0 0;
  opacity: 0.8;
  font-size: 0.9em;
}
</style>
