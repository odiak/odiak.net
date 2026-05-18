declare module 'virtual:content-data' {
  import type { Content, MetaData } from '../../contents'

  const contentData: {
    contents: Content[]
    metaData: MetaData
  }

  export default contentData
}
