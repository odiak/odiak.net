import deepmerge from 'deepmerge'
import { defaultSchema } from 'hast-util-sanitize'

export const schema = deepmerge(defaultSchema, { attributes: { '*': ['className'] } })
