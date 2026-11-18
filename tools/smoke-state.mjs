import { collectState } from '../index.js'
const state = await collectState({ get() { return undefined } })
console.log(JSON.stringify({ profile: state.profile.name, plugins: state.plugins.length, targetDsh: state.targetDsh, diagnostics: state.diagnostics.length, packs: state.packs.length }, null, 2))