import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ── DOM refs ────────────────────────────────────────────────────────────────
const authScreen    = document.getElementById('auth-screen')
const mainScreen    = document.getElementById('main-screen')
const loginForm     = document.getElementById('login-form')
const emailInput    = document.getElementById('email')
const passwordInput = document.getElementById('password')
const loginBtn      = document.getElementById('login-btn')
const authError     = document.getElementById('auth-error')
const toggleMode    = document.getElementById('toggle-mode')
const toggleHint    = document.getElementById('toggle-hint')
const logoutBtn     = document.getElementById('logout-btn')
const addHeadingForm = document.getElementById('add-heading-form')
const newHeadingInput = document.getElementById('new-heading')
const groupsEl      = document.getElementById('groups')

// ── State ───────────────────────────────────────────────────────────────────
let currentUser = null
let isSignUp = false

// ── Auth mode toggle ─────────────────────────────────────────────────────────
toggleMode.addEventListener('click', () => {
  isSignUp = !isSignUp
  authError.classList.add('hidden')
  if (isSignUp) {
    loginBtn.textContent = 'Sign up'
    toggleHint.textContent = 'Already have an account?'
    toggleMode.textContent = 'Log in'
  } else {
    loginBtn.textContent = 'Sign in'
    toggleHint.textContent = "Don't have an account?"
    toggleMode.textContent = 'Sign up'
  }
})

// ── Auth ────────────────────────────────────────────────────────────────────
supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user ?? null
  if (currentUser) {
    showMain()
  } else {
    showAuth()
  }
})

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  authError.classList.add('hidden')
  loginBtn.disabled = true
  loginBtn.textContent = isSignUp ? 'Signing up…' : 'Signing in…'

  const email = emailInput.value.trim()
  const password = passwordInput.value

  const { error } = isSignUp
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password })

  loginBtn.disabled = false
  loginBtn.textContent = isSignUp ? 'Sign up' : 'Sign in'

  if (error) {
    authError.textContent = error.message
    authError.classList.remove('hidden')
  }
})

logoutBtn.addEventListener('submit', async () => {
  await supabase.auth.signOut()
})

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut()
})

// ── Screen helpers ───────────────────────────────────────────────────────────
function showAuth() {
  mainScreen.classList.add('hidden')
  authScreen.classList.remove('hidden')
  groupsEl.innerHTML = ''
}

async function showMain() {
  authScreen.classList.add('hidden')
  mainScreen.classList.remove('hidden')
  await loadItems()
}

// ── Data ────────────────────────────────────────────────────────────────────
async function loadItems() {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to load items:', error)
    return
  }

  renderGroups(data)
}

async function addItem(heading, task) {
  const { data, error } = await supabase
    .from('items')
    .insert({ heading, task, done: false, user_id: currentUser.id })
    .select()
    .single()

  if (error) { console.error('Failed to add item:', error); return null }
  return data
}

async function toggleDone(id, done) {
  const { error } = await supabase
    .from('items')
    .update({ done })
    .eq('id', id)
    .eq('user_id', currentUser.id)

  if (error) console.error('Failed to update item:', error)
}

async function deleteItem(id) {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)
    .eq('user_id', currentUser.id)

  if (error) console.error('Failed to delete item:', error)
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderGroups(items) {
  // Build a map: heading → [items]
  const map = new Map()
  for (const item of items) {
    if (!map.has(item.heading)) map.set(item.heading, [])
    map.get(item.heading).push(item)
  }

  groupsEl.innerHTML = ''

  if (map.size === 0) {
    groupsEl.innerHTML = '<p class="empty-hint">No items yet. Add a heading above to get started.</p>'
    return
  }

  for (const [heading, headingItems] of map) {
    groupsEl.appendChild(buildGroup(heading, headingItems))
  }
}

function buildGroup(heading, items) {
  const group = document.createElement('div')
  group.className = 'group'
  group.dataset.heading = heading

  // Header
  const header = document.createElement('div')
  header.className = 'group-header'
  const title = document.createElement('span')
  title.className = 'group-title'
  title.textContent = heading
  header.appendChild(title)
  group.appendChild(header)

  // Item list
  const list = document.createElement('ul')
  list.className = 'item-list'
  for (const item of items) {
    list.appendChild(buildItem(item))
  }
  group.appendChild(list)

  // Add-item form
  const form = document.createElement('form')
  form.className = 'add-item-form'

  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'New item…'

  const btn = document.createElement('button')
  btn.type = 'submit'
  btn.textContent = 'Add'

  form.appendChild(input)
  form.appendChild(btn)

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const task = input.value.trim()
    if (!task) return
    input.value = ''
    input.disabled = true
    btn.disabled = true

    const newItem = await addItem(heading, task)
    input.disabled = false
    btn.disabled = false
    input.focus()

    if (newItem) {
      list.appendChild(buildItem(newItem))
    }
  })

  group.appendChild(form)
  return group
}

function buildItem(item) {
  const li = document.createElement('li')
  li.className = `item${item.done ? ' done' : ''}`
  li.dataset.id = item.id

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = item.done
  checkbox.addEventListener('change', async () => {
    await toggleDone(item.id, checkbox.checked)
    li.classList.toggle('done', checkbox.checked)
  })

  const label = document.createElement('span')
  label.className = 'item-task'
  label.textContent = item.task

  const del = document.createElement('button')
  del.className = 'item-delete'
  del.title = 'Delete'
  del.textContent = '×'
  del.addEventListener('click', async () => {
    await deleteItem(item.id)
    li.remove()
    // If the list is now empty, remove the group and re-render to show empty hint
    const list = document.querySelector(`.group[data-heading="${CSS.escape(item.heading)}"] .item-list`)
    if (list && list.children.length === 0) {
      await loadItems()
    }
  })

  li.appendChild(checkbox)
  li.appendChild(label)
  li.appendChild(del)
  return li
}

// ── Add heading ──────────────────────────────────────────────────────────────
addHeadingForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const heading = newHeadingInput.value.trim()
  if (!heading) return

  // Check the heading doesn't already exist in the DOM
  if (document.querySelector(`.group[data-heading="${CSS.escape(heading)}"]`)) {
    newHeadingInput.value = ''
    newHeadingInput.focus()
    return
  }

  // Render an empty group immediately (no DB insert needed until first item)
  const existing = document.querySelector('.empty-hint')
  if (existing) existing.remove()

  groupsEl.appendChild(buildGroup(heading, []))
  newHeadingInput.value = ''
  newHeadingInput.focus()
})
