/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  home: typeof routes['home']
  nextYear: {
    render: typeof routes['next_year.render']
    execute: typeof routes['next_year.execute']
  }
  evenements: {
    execute: typeof routes['evenements.execute']
  }
  admin: {
    render: typeof routes['admin.render']
    execute: typeof routes['admin.execute']
  }
  newAccount: {
    create: typeof routes['new_account.create']
    store: typeof routes['new_account.store']
  }
  session: {
    create: typeof routes['session.create']
    store: typeof routes['session.store']
    destroy: typeof routes['session.destroy']
  }
  dashboard: typeof routes['dashboard']
}
