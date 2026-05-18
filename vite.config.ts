import { cloudflare } from '@cloudflare/vite-plugin'
import { reactRouter } from '@react-router/dev/vite'
import { defineConfig, type Plugin } from 'vite'

function contentDataPlugin(): Plugin {
  const virtualModuleId = 'virtual:content-data'
  const resolvedVirtualModuleId = `\0${virtualModuleId}`

  return {
    name: 'content-data',
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId
    },
    async load(id) {
      if (id !== resolvedVirtualModuleId) return

      const { getAllContents, getMetaData } = await import('./src/node-contents')
      return `export default ${JSON.stringify({
        contents: await getAllContents(),
        metaData: await getMetaData()
      })}`
    }
  }
}

export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: 'ssr' } }), reactRouter(), contentDataPlugin()]
})
