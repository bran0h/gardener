export interface Toast {
  id: number
  text: string
  tone: 'leaf' | 'water' | 'rose'
}

let nextId = 1

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])

  function push(text: string, tone: Toast['tone'] = 'leaf') {
    const id = nextId++
    toasts.value = [...toasts.value, { id, text, tone }]
    setTimeout(() => dismiss(id), 3000)
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return { toasts, push, dismiss }
}
