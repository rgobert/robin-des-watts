/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'home': {
    methods: ["GET","HEAD"],
    pattern: '/',
    tokens: [{"old":"/","type":0,"val":"/","end":""}],
    types: placeholder as Registry['home']['types'],
  },
  'next_year.render': {
    methods: ["GET","HEAD"],
    pattern: '/annee-2',
    tokens: [{"old":"/annee-2","type":0,"val":"annee-2","end":""}],
    types: placeholder as Registry['next_year.render']['types'],
  },
  'next_year.execute': {
    methods: ["POST"],
    pattern: '/annee-2',
    tokens: [{"old":"/annee-2","type":0,"val":"annee-2","end":""}],
    types: placeholder as Registry['next_year.execute']['types'],
  },
  'evenements.execute': {
    methods: ["POST"],
    pattern: '/evenements',
    tokens: [{"old":"/evenements","type":0,"val":"evenements","end":""}],
    types: placeholder as Registry['evenements.execute']['types'],
  },
  'admin.render': {
    methods: ["GET","HEAD"],
    pattern: '/admin',
    tokens: [{"old":"/admin","type":0,"val":"admin","end":""}],
    types: placeholder as Registry['admin.render']['types'],
  },
  'admin.execute': {
    methods: ["POST"],
    pattern: '/admin/reset',
    tokens: [{"old":"/admin/reset","type":0,"val":"admin","end":""},{"old":"/admin/reset","type":0,"val":"reset","end":""}],
    types: placeholder as Registry['admin.execute']['types'],
  },
  'new_account.create': {
    methods: ["GET","HEAD"],
    pattern: '/signup',
    tokens: [{"old":"/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['new_account.create']['types'],
  },
  'new_account.store': {
    methods: ["POST"],
    pattern: '/signup',
    tokens: [{"old":"/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['new_account.store']['types'],
  },
  'session.create': {
    methods: ["GET","HEAD"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.create']['types'],
  },
  'session.store': {
    methods: ["POST"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.store']['types'],
  },
  'dashboard': {
    methods: ["GET","HEAD"],
    pattern: '/dashboard',
    tokens: [{"old":"/dashboard","type":0,"val":"dashboard","end":""}],
    types: placeholder as Registry['dashboard']['types'],
  },
  'session.destroy': {
    methods: ["POST"],
    pattern: '/logout',
    tokens: [{"old":"/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['session.destroy']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
