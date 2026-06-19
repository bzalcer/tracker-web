import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ── DOM refs ─────────────────────────────────────────────────────────────────
const authScreen     = document.getElementById('auth-screen')
const mainScreen     = document.getElementById('main-screen')
const loginForm      = document.getElementById('login-form')
const emailInput     = document.getElementById('email')
const passwordInput  = document.getElementById('password')
const loginBtn       = document.getElementById('login-btn')
const authError      = document.getElementById('auth-error')
const toggleMode     = document.getElementById('toggle-mode')
const toggleHint     = document.getElementById('toggle-hint')
const logoutBtn      = document.getElementById('logout-btn')
const addHeadingForm = document.getElementById('add-heading-form')
const newHeadingInput = document.getElementById('new-heading')
const groupsEl       = document.getElementById('groups')
const filterHeading  = document.getElementById('filter-heading')
const filterDue      = document.getElementById('filter-due')
const filterAdded    = document.getElementById('filter-added')
const sortDue        = document.getElementById('sort-due')

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser = null
let isSignUp = false
let allItems = []

// ── Auth mode toggle ──────────────────────────────────────────────────────────
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

// ── Auth ──────────────────────────────────────────────────────────────────────
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

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut()
})

// ── Screen helpers ────────────────────────────────────────────────────────────
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

// ── Data ──────────────────────────────────────────────────────────────────────
async function loadItems() {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true })

  if (error) { console.error('Failed to load items:', error); return }

  allItems = data
  applyFilters()
}

async function addItem(heading, task, due_date, notes) {
  const payload = { heading, task, done: false, user_id: currentUser.id }
  if (due_date) payload.due_date = due_date
  if (notes)    payload.notes = notes

  const { data, error } = await supabase
    .from('items')
    .insert(payload)
    .select()
    .single()

  if (error) { console.error('Failed to add item:', error); return null }
  return data
}

async function updateItem(id, fields) {
  const { data, error } = await supabase
    .from('items')
    .update(fields)
    .eq('id', id)
    .eq('user_id', currentUser.id)
    .select()
    .single()

  if (error) { console.error('Failed to update item:', error); return null }
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

// ── Filters & sort ────────────────────────────────────────────────────────────
function applyFilters() {
  const headingQ = filterHeading.value.trim().toLowerCase()
  const dueQ     = filterDue.value    // 'YYYY-MM-DD' or ''
  const addedQ   = filterAdded.value  // 'YYYY-MM-DD' or ''
  const byDue    = sortDue.checked

  let items = allItems

  if (headingQ) {
    items = items.filter(i => i.heading.toLowerCase().includes(headingQ))
  }
  if (dueQ) {
    // Show items that have a due date on or before the chosen date
    items = items.filter(i => i.due_date && i.due_date <= dueQ)
  }
  if (addedQ) {
    // Show items created on or after the chosen date
    items = items.filter(i => i.created_at.slice(0, 10) >= addedQ)
  }
  if (byDue) {
    items = [...items].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date)
    })
  }

  renderGroups(items)
}

filterHeading.addEventListener('input', applyFilters)
filterDue.addEventListener('input', applyFilters)
filterAdded.addEventListener('input', applyFilters)
sortDue.addEventListener('change', applyFilters)

// ── Render ────────────────────────────────────────────────────────────────────
function renderGroups(items) {
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

  const header = document.createElement('div')
  header.className = 'group-header'
  const title = document.createElement('span')
  title.className = 'group-title'
  title.textContent = heading
  header.appendChild(title)
  group.appendChild(header)

  const list = document.createElement('ul')
  list.className = 'item-list'
  for (const item of items) {
    list.appendChild(buildItem(item))
  }
  group.appendChild(list)

  // Add-item form with optional due date + notes
  const form = document.createElement('form')
  form.className = 'add-item-form'

  const mainRow = document.createElement('div')
  mainRow.className = 'add-item-main'

  const taskInput = document.createElement('input')
  taskInput.type = 'text'
  taskInput.placeholder = 'New item…'

  const addBtn = document.createElement('button')
  addBtn.type = 'submit'
  addBtn.textContent = 'Add'

  mainRow.appendChild(taskInput)
  mainRow.appendChild(addBtn)

  const extraRow = document.createElement('div')
  extraRow.className = 'add-item-extra'

  const dueDateInput = document.createElement('input')
  dueDateInput.type = 'date'
  dueDateInput.title = 'Due date (optional)'

  const notesLabel = document.createElement('span')
  notesLabel.className = 'field-label'
  notesLabel.textContent = 'Notes'

  const notesInput = document.createElement('input')
  notesInput.type = 'text'
  notesInput.placeholder = 'Optional'

  extraRow.appendChild(dueDateInput)
  extraRow.appendChild(notesLabel)
  extraRow.appendChild(notesInput)

  form.appendChild(mainRow)
  form.appendChild(extraRow)

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const task = taskInput.value.trim()
    if (!task) return

    const due_date = dueDateInput.value || null
    const notes = notesInput.value.trim() || null

    taskInput.value = ''
    dueDateInput.value = ''
    notesInput.value = ''
    taskInput.disabled = true
    addBtn.disabled = true

    const newItem = await addItem(heading, task, due_date, notes)

    taskInput.disabled = false
    addBtn.disabled = false
    taskInput.focus()

    if (newItem) {
      allItems.push(newItem)
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

  // ── Main row ──────────────────────────────────────────────────────────────
  const mainRow = document.createElement('div')
  mainRow.className = 'item-main-row'

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = item.done
  checkbox.addEventListener('change', async () => {
    item.done = checkbox.checked
    const idx = allItems.findIndex(i => i.id === item.id)
    if (idx !== -1) allItems[idx].done = checkbox.checked
    await toggleDone(item.id, checkbox.checked)
    li.classList.toggle('done', checkbox.checked)
  })

  const label = document.createElement('span')
  label.className = 'item-task'
  label.textContent = item.task

  const editBtn = document.createElement('button')
  editBtn.type = 'button'
  editBtn.className = 'item-edit'
  editBtn.title = 'Edit'
  editBtn.textContent = '✎'

  const del = document.createElement('button')
  del.type = 'button'
  del.className = 'item-delete'
  del.title = 'Delete'
  del.textContent = '×'

  del.addEventListener('click', async () => {
    await deleteItem(item.id)
    allItems = allItems.filter(i => i.id !== item.id)
    li.remove()
    const listEl = document.querySelector(`.group[data-heading="${CSS.escape(item.heading)}"] .item-list`)
    if (listEl && listEl.children.length === 0) applyFilters()
  })

  mainRow.appendChild(checkbox)
  mainRow.appendChild(label)
  mainRow.appendChild(editBtn)
  mainRow.appendChild(del)
  li.appendChild(mainRow)

  // ── Meta row (due date / notes) ───────────────────────────────────────────
  function buildMeta(dueDate, notes) {
    if (!dueDate && !notes) return null
    const meta = document.createElement('div')
    meta.className = 'item-meta'
    if (dueDate) {
      const badge = document.createElement('span')
      badge.className = dueBadgeClass(dueDate)
      badge.textContent = 'Due ' + formatDate(dueDate)
      meta.appendChild(badge)
    }
    if (notes) {
      const notesSpan = document.createElement('span')
      notesSpan.className = 'item-notes'
      notesSpan.textContent = notes
      meta.appendChild(notesSpan)
    }
    return meta
  }

  const initialMeta = buildMeta(item.due_date, item.notes)
  if (initialMeta) li.appendChild(initialMeta)

  // ── Inline edit form ──────────────────────────────────────────────────────
  const editForm = document.createElement('form')
  editForm.className = 'item-edit-form hidden'

  const editTask = document.createElement('input')
  editTask.type = 'text'
  editTask.value = item.task
  editTask.required = true

  const editRow2 = document.createElement('div')
  editRow2.className = 'edit-row2'

  const editDue = document.createElement('input')
  editDue.type = 'date'
  editDue.value = item.due_date || ''
  editDue.title = 'Due date (optional)'

  const editNotesLabel = document.createElement('span')
  editNotesLabel.className = 'field-label'
  editNotesLabel.textContent = 'Notes'

  const editNotes = document.createElement('input')
  editNotes.type = 'text'
  editNotes.value = item.notes || ''
  editNotes.placeholder = 'Optional'

  editRow2.appendChild(editDue)
  editRow2.appendChild(editNotesLabel)
  editRow2.appendChild(editNotes)

  const editActions = document.createElement('div')
  editActions.className = 'edit-actions'

  const saveBtn = document.createElement('button')
  saveBtn.type = 'submit'
  saveBtn.className = 'btn-save'
  saveBtn.textContent = 'Save'

  const cancelBtn = document.createElement('button')
  cancelBtn.type = 'button'
  cancelBtn.className = 'btn-cancel'
  cancelBtn.textContent = 'Cancel'

  editActions.appendChild(saveBtn)
  editActions.appendChild(cancelBtn)
  editForm.appendChild(editTask)
  editForm.appendChild(editRow2)
  editForm.appendChild(editActions)

  editBtn.addEventListener('click', () => {
    const wasHidden = editForm.classList.contains('hidden')
    editForm.classList.toggle('hidden', !wasHidden)
    if (wasHidden) editTask.focus()
  })

  cancelBtn.addEventListener('click', () => {
    editForm.classList.add('hidden')
    editTask.value = item.task
    editDue.value = item.due_date || ''
    editNotes.value = item.notes || ''
  })

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const newTask = editTask.value.trim()
    if (!newTask) return

    saveBtn.disabled = true
    saveBtn.textContent = 'Saving…'

    const fields = {
      task:     newTask,
      due_date: editDue.value || null,
      notes:    editNotes.value.trim() || null,
    }

    const updated = await updateItem(item.id, fields)

    saveBtn.disabled = false
    saveBtn.textContent = 'Save'

    if (updated) {
      Object.assign(item, fields)
      const idx = allItems.findIndex(i => i.id === item.id)
      if (idx !== -1) Object.assign(allItems[idx], fields)

      label.textContent = updated.task

      const existingMeta = li.querySelector('.item-meta')
      if (existingMeta) existingMeta.remove()
      const newMeta = buildMeta(updated.due_date, updated.notes)
      if (newMeta) editForm.before(newMeta)

      editForm.classList.add('hidden')
    }
  })

  li.appendChild(editForm)
  return li
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function dueBadgeClass(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [y, m, d] = dateStr.split('-').map(Number)
  const due = new Date(y, m - 1, d)
  if (due < today)                    return 'due-badge due-overdue'
  if (due.getTime() === today.getTime()) return 'due-badge due-today'
  return 'due-badge'
}

// ── Add heading ───────────────────────────────────────────────────────────────
addHeadingForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const heading = newHeadingInput.value.trim()
  if (!heading) return

  if (document.querySelector(`.group[data-heading="${CSS.escape(heading)}"]`)) {
    newHeadingInput.value = ''
    newHeadingInput.focus()
    return
  }

  const existing = document.querySelector('.empty-hint')
  if (existing) existing.remove()

  groupsEl.appendChild(buildGroup(heading, []))
  newHeadingInput.value = ''
  newHeadingInput.focus()
})
