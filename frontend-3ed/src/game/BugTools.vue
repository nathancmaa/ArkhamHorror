<script setup lang="ts">
import { ref } from 'vue'
import * as api from '@/api'
import { useGame } from '@/game/context'

const ctx = useGame()
const dialog = ref<HTMLDialogElement | null>(null)
const title = ref('')
const description = ref('')
const busy = ref(false)

function download(data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `ah3e-debug-${ctx.tableId}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function save() {
  try {
    download(await api.exportTable(ctx.tableId))
  } catch (e) {
    ctx.error.value = api.errorText(e)
  }
}

// Fork: an issue on this fork with the table downloaded to attach, since the
// upload api.fileBug does needs upstream's bucket. The window opens before
// anything is awaited, while the click still counts as a user gesture.
async function file() {
  busy.value = true
  try {
    // the title says which game, since the issue tracker is shared with Arkham
    const body = encodeURIComponent(
      `Arkham Horror 3e\n\n${description.value}\n\ntable: ${window.location.href}\n\nAttach the ah3e-debug-${ctx.tableId}.json this downloaded.`,
    )
    window.open(
      `https://github.com/nathancmaa/ArkhamHorror/issues/new?labels=bug&title=${encodeURIComponent(`[3e] ${title.value}`)}&body=${body}`,
      '_blank',
    )
    await save()
    title.value = ''
    description.value = ''
    dialog.value?.close()
  } catch (e) {
    ctx.error.value = api.errorText(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button id="debugExport" class="undo-btn" title="Download this table as a debug file" @click="save">Export</button>
  <button id="fileBug" class="undo-btn" title="Report a bug with this game attached" @click="dialog?.showModal()">
    Bug
  </button>
  <dialog ref="dialog" class="bug-dialog">
    <form @submit.prevent="file">
      <h2>File a bug</h2>
      <p>The game state is downloaded for you to attach to the issue, so the bug can be reproduced.</p>
      <p class="waiting">A GitHub account is needed to open the issue.</p>
      <input v-model="title" required placeholder="What went wrong, in a line" />
      <textarea v-model="description" required rows="5" placeholder="What you did, and what you expected"></textarea>
      <div class="bug-buttons">
        <button class="primary" type="submit" :disabled="busy">{{ busy ? 'Downloading…' : 'Submit' }}</button>
        <button type="button" @click="dialog?.close()">Cancel</button>
      </div>
    </form>
  </dialog>
</template>
