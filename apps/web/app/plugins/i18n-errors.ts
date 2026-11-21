/** Lets errMsg() translate error keys anywhere, not only inside components. */
export default defineNuxtPlugin((nuxtApp) => {
  const i18n = nuxtApp.$i18n
  setErrorTranslator((key, params) => i18n.t(key, params ?? {}))
})
