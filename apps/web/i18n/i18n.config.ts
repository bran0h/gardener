/**
 * Slovak has three plural forms: 1 deň, 2–4 dni, 0 and 5+ dní.
 * Messages for sk are written as "one | few | many".
 */
export default defineI18nConfig(() => ({
  fallbackLocale: 'en',
  pluralRules: {
    sk: (choice: number) => {
      if (choice === 1) return 0
      if (choice >= 2 && choice <= 4) return 1
      return 2
    }
  }
}))
