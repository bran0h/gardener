export interface ConfirmOptions {
  title: string
  message?: string
  /** Label of the confirming button. */
  confirm: string
  /** Red confirming button (deleting, removing, leaving). Default true. */
  danger?: boolean
  /** The person must type this exactly before confirming (e.g. a home's name). */
  requireText?: string
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

/**
 * "Are you sure?" as a promise:
 *   if (!await confirm({ title: t('…'), confirm: t('…') })) return
 * One dialog for the whole app (ConfirmDialog in app.vue).
 */
export function useConfirm() {
  const state = useState<ConfirmState | null>('confirm-dialog', () => null)

  function ask(options: ConfirmOptions): Promise<boolean> {
    state.value?.resolve(false)
    return new Promise((resolve) => {
      state.value = { danger: true, ...options, resolve }
    })
  }

  function answer(ok: boolean) {
    const current = state.value
    state.value = null
    current?.resolve(ok)
  }

  return { state, ask, answer }
}
