import antfu from '@antfu/eslint-config'

export default antfu({
  astro: true,
  typescript: true,
  formatters: false,
  ignores: ['dist', '.astro', 'public'],
})
