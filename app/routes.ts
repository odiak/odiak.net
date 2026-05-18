import { index, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('all', 'routes/all.tsx'),
  route(':slug', 'routes/content.tsx')
] satisfies RouteConfig
