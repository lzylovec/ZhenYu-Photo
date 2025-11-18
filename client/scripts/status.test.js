const assert = require('assert')

function deriveStatus(loading, error, items){
  if (loading) return 'loading'
  if (error) return 'error'
  if (Array.isArray(items) && items.length === 0) return 'empty'
  if (Array.isArray(items) && items.length > 0) return 'success'
  return 'idle'
}

assert.strictEqual(deriveStatus(true, '', []), 'loading')
assert.strictEqual(deriveStatus(false, 'oops', []), 'error')
assert.strictEqual(deriveStatus(false, '', []), 'empty')
assert.strictEqual(deriveStatus(false, '', [{id:1}]), 'success')
assert.strictEqual(deriveStatus(false, '', null), 'idle')

console.log('Status tests passed')