import deepmerge from 'deepmerge'
import githubSanitizationSchema from 'hast-util-sanitize/lib/github.json'

export const schema = deepmerge(githubSanitizationSchema, { attributes: { '*': ['className'] } })
