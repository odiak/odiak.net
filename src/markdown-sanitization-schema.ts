import deepmerge from 'deepmerge'
import { defaultSchema } from 'hast-util-sanitize/lib/schema.js'

export const schema = deepmerge(defaultSchema, { attributes: { '*': ['className'] } })
