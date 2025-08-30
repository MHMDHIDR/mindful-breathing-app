const { ipcRenderer } = require('electron')

// Expose API directly to window (since contextBridge is failing)
;(window as any).electronAPI = {
  getSettings: () => {
    return ipcRenderer.invoke('preferences:get-settings')
  },
  updateReminder: (reminderId: string, updates: any) => {
    return ipcRenderer.invoke('preferences:update-reminder', reminderId, updates)
  },
  testSound: (soundName: string) => {
    return ipcRenderer.invoke('preferences:test-sound', soundName)
  },
  closeWindow: () => {
    return ipcRenderer.invoke('preferences:close')
  },
  // Custom reminder methods
  addCustomReminder: (
    name: string,
    messages: string[],
    instructions: string[],
    icon: string
  ) => {
    return ipcRenderer.invoke(
      'preferences:add-custom-reminder',
      name,
      messages,
      instructions,
      icon
    )
  },
  updateCustomReminder: (id: string, updates: any) => {
    return ipcRenderer.invoke('preferences:update-custom-reminder', id, updates)
  },
  deleteCustomReminder: (id: string) => {
    return ipcRenderer.invoke('preferences:delete-custom-reminder', id)
  },
  getCustomReminders: () => {
    return ipcRenderer.invoke('preferences:get-custom-reminders')
  },
}

// Global variables for settings
let originalSettings: any = {}
let currentSettings: any = {}
let customReminders: any[] = []
let editingReminderId: string | null = null
let modalListenersSetup = false

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Add a small delay to ensure everything is ready
  setTimeout(async () => {
    await initializePreferences()
  }, 100)
})

async function initializePreferences(): Promise<void> {
  try {
    const data = await (window as any).electronAPI.getSettings()

    originalSettings = JSON.parse(JSON.stringify(data.reminders))
    currentSettings = JSON.parse(JSON.stringify(data.reminders))
    customReminders = JSON.parse(JSON.stringify(data.customReminders))

    // Populate dropdowns with available sounds
    populateSoundDropdowns(data.sounds)

    // Set current values
    updateUIFromSettings()

    // Load and display custom reminders
    await loadCustomReminders()

    // Setup event listeners
    setupEventListeners()

    // Setup custom reminder event listeners
    setupCustomReminderListeners()
  } catch (error) {
    console.error('Failed to initialize preferences:', error)
  }
}

function populateSoundDropdowns(sounds: string[]): void {
  const soundSelects = ['breathing-sound', 'water-sound', 'stretching-sound']

  soundSelects.forEach(selectId => {
    const select = document.getElementById(selectId) as HTMLSelectElement
    if (!select) {
      console.error(`Sound select not found: ${selectId}`)
      return
    }

    // Clear existing options
    select.innerHTML = ''

    // Add "Silent" option first
    const silentOption = document.createElement('option')
    silentOption.value = 'No Sound'
    silentOption.textContent = '🔇 Silent'
    select.appendChild(silentOption)

    // Add sound options
    sounds.forEach(sound => {
      if (sound !== 'No Sound') {
        const option = document.createElement('option')
        option.value = sound
        option.textContent = `🎵 ${sound.replace('.mp3', '').replace(/[-_]/g, ' ')}`
        select.appendChild(option)
      }
    })
  })
}

function updateUIFromSettings(): void {
  const reminderTypes = ['breathing', 'water', 'stretching']

  reminderTypes.forEach(type => {
    const config = currentSettings[type]
    if (!config) {
      console.error(`Config not found for: ${type}`)
      return
    }

    // Update toggle
    const toggle = document.getElementById(`${type}-toggle`)
    const statusDot = document.getElementById(`${type}-status`)
    const statusText = document.getElementById(`${type}-status-text`)

    if (!toggle || !statusDot || !statusText) {
      console.error(`Elements not found for: ${type}`)
      return
    }

    if (config.enabled) {
      toggle.classList.add('active')
      statusDot.classList.add('active')
      statusText.textContent = `Every ${config.interval} min`
    } else {
      toggle.classList.remove('active')
      statusDot.classList.remove('active')
      statusText.textContent = 'Disabled'
    }

    // Update interval dropdown
    const intervalSelect = document.getElementById(
      `${type}-interval`
    ) as HTMLSelectElement
    if (intervalSelect) {
      intervalSelect.value = config.interval.toString()
    }

    // Update sound dropdown
    const soundSelect = document.getElementById(`${type}-sound`) as HTMLSelectElement
    if (soundSelect) {
      soundSelect.value = config.selectedSound
    }

    // Show/hide interval and sound rows based on enabled state
    toggleRowsVisibility(type, config.enabled)
  })
}

function toggleRowsVisibility(type: string, enabled: boolean): void {
  const intervalRow = document.getElementById(`${type}-interval-row`)
  const soundRow = document.getElementById(`${type}-sound-row`)

  if (intervalRow && soundRow) {
    intervalRow.style.display = enabled ? 'flex' : 'none'
    soundRow.style.display = enabled ? 'flex' : 'none'
  }
}

function setupEventListeners(): void {
  const reminderTypes = ['breathing', 'water', 'stretching']

  // Toggle switches
  reminderTypes.forEach(type => {
    const toggle = document.getElementById(`${type}-toggle`)
    if (toggle) {
      toggle.addEventListener('click', event => {
        event.preventDefault()
        event.stopPropagation()

        const wasEnabled = currentSettings[type].enabled
        const newEnabled = !wasEnabled

        currentSettings[type].enabled = newEnabled

        // Update UI
        const statusDot = document.getElementById(`${type}-status`)
        const statusText = document.getElementById(`${type}-status-text`)

        if (newEnabled) {
          toggle.classList.add('active')
          statusDot?.classList.add('active')
          if (statusText)
            statusText.textContent = `Every ${currentSettings[type].interval} min`
        } else {
          toggle.classList.remove('active')
          statusDot?.classList.remove('active')
          if (statusText) statusText.textContent = 'Disabled'
        }

        // Show/hide related controls
        toggleRowsVisibility(type, newEnabled)
      })
    }

    // Interval dropdowns
    const intervalSelect = document.getElementById(
      `${type}-interval`
    ) as HTMLSelectElement
    if (intervalSelect) {
      intervalSelect.addEventListener('change', () => {
        const newInterval = parseInt(intervalSelect.value)
        currentSettings[type].interval = newInterval

        // Update status text if enabled
        if (currentSettings[type].enabled) {
          const statusText = document.getElementById(`${type}-status-text`)
          if (statusText) statusText.textContent = `Every ${newInterval} min`
        }
      })
    }

    // Sound dropdowns
    const soundSelect = document.getElementById(`${type}-sound`) as HTMLSelectElement
    if (soundSelect) {
      soundSelect.addEventListener('change', () => {
        const newSound = soundSelect.value
        currentSettings[type].selectedSound = newSound
        currentSettings[type].soundEnabled = newSound !== 'No Sound'
      })
    }

    // Test buttons
    const testButton = document.getElementById(`${type}-test`)
    if (testButton) {
      testButton.addEventListener('click', async () => {
        const soundName = currentSettings[type].selectedSound
        if (soundName && soundName !== 'No Sound') {
          try {
            await (window as any).electronAPI.testSound(soundName)
          } catch (error) {
            console.error('Failed to test sound:', error)
          }
        }
      })
    }
  })

  // Save button
  const saveButton = document.getElementById('save-btn')
  if (saveButton) {
    saveButton.addEventListener('click', async event => {
      event.preventDefault()
      try {
        // Save all changes
        for (const [reminderId, config] of Object.entries(currentSettings)) {
          await (window as any).electronAPI.updateReminder(reminderId, config)
        }

        // Update original settings
        originalSettings = JSON.parse(JSON.stringify(currentSettings))

        // Close window
        await (window as any).electronAPI.closeWindow()
      } catch (error) {
        console.error('Failed to save settings:', error)
      }
    })
  }

  // Cancel button
  const cancelButton = document.getElementById('cancel-btn')
  if (cancelButton) {
    cancelButton.addEventListener('click', async event => {
      event.preventDefault()
      // Revert to original settings
      currentSettings = JSON.parse(JSON.stringify(originalSettings))
      updateUIFromSettings()

      // Close window
      await (window as any).electronAPI.closeWindow()
    })
  }
}

async function loadCustomReminders(): Promise<void> {
  try {
    // Don't call API again, use the data we already loaded
    renderCustomReminders()
  } catch (error) {
    console.error('Failed to load custom reminders:', error)
  }
}

function renderCustomReminders(): void {
  const container = document.getElementById('custom-reminders-list')
  if (!container) return

  container.innerHTML = ''

  customReminders.forEach(reminder => {
    // Get config for this custom reminder
    const config = currentSettings[reminder.id] || {
      enabled: false,
      interval: 30,
      soundEnabled: false,
      selectedSound: 'No Sound',
    }

    // Create a full reminder section like built-in ones
    const reminderSection = document.createElement('div')
    reminderSection.className = 'preference-section'
    reminderSection.style.marginTop = '12px'

    reminderSection.innerHTML = `
      <div class="section-header">
        <div class="section-icon">${reminder.icon}</div>
        <div class="section-title">${reminder.name}</div>
        <div class="custom-reminder-actions">
          <button class="action-button" onclick="editCustomReminder('${
            reminder.id
          }')" title="Edit">✏️</button>
          <button class="action-button" onclick="deleteCustomReminder('${
            reminder.id
          }')" title="Delete">🗑️</button>
        </div>
      </div>

      <div class="preference-row">
        <div>
          <div class="preference-label">Enable ${reminder.name.toLowerCase()} reminders</div>
          <div class="preference-description">${
            reminder.messages.length
          } custom message(s) • ${reminder.instructions.length} instruction(s)</div>
        </div>
        <div class="preference-control">
          <div class="status-indicator">
            <div class="status-dot ${config.enabled ? 'active' : ''}" id="${
      reminder.id
    }-status"></div>
            <span id="${reminder.id}-status-text">${
      config.enabled ? `Every ${config.interval} min` : 'Disabled'
    }</span>
          </div>
          <div class="toggle ${config.enabled ? 'active' : ''}" id="${
      reminder.id
    }-toggle">
            <div class="toggle-handle"></div>
          </div>
        </div>
      </div>

      <div class="preference-row" id="${reminder.id}-interval-row" style="display: ${
      config.enabled ? 'flex' : 'none'
    }">
        <div class="preference-label">Reminder interval</div>
        <select class="dropdown" id="${reminder.id}-interval">
          <option value="1" ${
            config.interval === 1 ? 'selected' : ''
          }>Every 1 minute</option>
          <option value="5" ${
            config.interval === 5 ? 'selected' : ''
          }>Every 5 minutes</option>
          <option value="15" ${
            config.interval === 15 ? 'selected' : ''
          }>Every 15 minutes</option>
          <option value="30" ${
            config.interval === 30 ? 'selected' : ''
          }>Every 30 minutes</option>
          <option value="45" ${
            config.interval === 45 ? 'selected' : ''
          }>Every 45 minutes</option>
          <option value="60" ${
            config.interval === 60 ? 'selected' : ''
          }>Every 60 minutes</option>
        </select>
      </div>

      <div class="preference-row" id="${reminder.id}-sound-row" style="display: ${
      config.enabled ? 'flex' : 'none'
    }">
        <div class="preference-label">Notification sound</div>
        <div class="preference-control">
          <select class="dropdown" id="${reminder.id}-sound">
            <option value="No Sound">🔇 Silent</option>
          </select>
          <button class="test-button" id="${reminder.id}-test">Test</button>
        </div>
      </div>
    `

    container.appendChild(reminderSection)

    // Initialize current settings for this reminder if not exists
    if (!currentSettings[reminder.id]) {
      currentSettings[reminder.id] = {
        id: reminder.id,
        name: reminder.name,
        enabled: false,
        interval: 30,
        soundEnabled: false,
        selectedSound: 'No Sound',
        icon: reminder.icon,
      }
    }
  })

  // Populate sound dropdowns for custom reminders
  populateCustomReminderSounds()

  // Setup event listeners for custom reminders
  setupCustomReminderEventListeners()
}

function setupCustomReminderListeners(): void {
  // Add reminder button - always needs to be re-setup since it might be recreated
  const addButton = document.getElementById('add-custom-reminder')
  if (addButton) {
    addButton.onclick = () => {
      openCustomReminderModal()
    }
  }

  // Modal event listeners - only set once
  if (!modalListenersSetup) {
    const modalCancel = document.getElementById('modal-cancel')
    const modalSave = document.getElementById('modal-save')
    const modal = document.getElementById('custom-reminder-modal')

    if (modalCancel) {
      modalCancel.onclick = closeCustomReminderModal
    }

    if (modalSave) {
      modalSave.onclick = saveCustomReminder
    }

    // Emoji picker
    const emojiButtons = document.querySelectorAll('.emoji-option')
    emojiButtons.forEach(button => {
      button.addEventListener('click', e => {
        e.preventDefault()
        // Remove previous selection
        document
          .querySelectorAll('.emoji-option')
          .forEach(btn => btn.classList.remove('selected'))
        // Add selection to clicked button
        ;(button as HTMLElement).classList.add('selected')
      })
    })

    // Close modal when clicking outside
    if (modal) {
      modal.addEventListener('click', e => {
        if (e.target === modal) {
          closeCustomReminderModal()
        }
      })
    }

    modalListenersSetup = true
  }
}

function openCustomReminderModal(reminderId?: string): void {
  const modal = document.getElementById('custom-reminder-modal')
  const title = document.getElementById('modal-title')
  const nameInput = document.getElementById('reminder-name') as HTMLInputElement
  const messagesTextarea = document.getElementById(
    'reminder-messages'
  ) as HTMLTextAreaElement
  const instructionsTextarea = document.getElementById(
    'reminder-instructions'
  ) as HTMLTextAreaElement

  if (!modal || !title || !nameInput || !messagesTextarea || !instructionsTextarea) return

  editingReminderId = reminderId || null

  if (reminderId) {
    // Editing existing reminder
    const reminder = customReminders.find(r => r.id === reminderId)
    if (!reminder) return

    title.textContent = 'Edit Custom Reminder'
    nameInput.value = reminder.name
    messagesTextarea.value = reminder.messages.join('\n')
    instructionsTextarea.value = reminder.instructions.join('\n')

    // Select the correct emoji
    const emojiButtons = document.querySelectorAll('.emoji-option')
    emojiButtons.forEach(btn => {
      btn.classList.remove('selected')
      if (btn.getAttribute('data-emoji') === reminder.icon) {
        btn.classList.add('selected')
      }
    })
  } else {
    // Adding new reminder
    title.textContent = 'Add Custom Reminder'
    nameInput.value = ''
    messagesTextarea.value = ''
    instructionsTextarea.value = ''

    // Clear emoji selection
    document
      .querySelectorAll('.emoji-option')
      .forEach(btn => btn.classList.remove('selected'))
    // Select default emoji
    const defaultEmoji = document.querySelector('[data-emoji="🔔"]')
    if (defaultEmoji) defaultEmoji.classList.add('selected')
  }

  modal.style.display = 'flex'
}

function closeCustomReminderModal(): void {
  const modal = document.getElementById('custom-reminder-modal')
  if (modal) {
    modal.style.display = 'none'
  }
  editingReminderId = null
}

async function saveCustomReminder(): Promise<void> {
  const nameInput = document.getElementById('reminder-name') as HTMLInputElement
  const messagesTextarea = document.getElementById(
    'reminder-messages'
  ) as HTMLTextAreaElement
  const instructionsTextarea = document.getElementById(
    'reminder-instructions'
  ) as HTMLTextAreaElement
  const selectedEmoji = document.querySelector('.emoji-option.selected')

  if (!nameInput || !messagesTextarea || !instructionsTextarea || !selectedEmoji) return

  const name = nameInput.value.trim()
  const messages = messagesTextarea.value
    .split('\n')
    .map(m => m.trim())
    .filter(m => m.length > 0)
  const instructions = instructionsTextarea.value
    .split('\n')
    .map(i => i.trim())
    .filter(i => i.length > 0)
  const icon = selectedEmoji.getAttribute('data-emoji') || '🔔'

  if (!name) {
    alert('Please enter a reminder name')
    return
  }

  if (messages.length === 0) {
    alert('Please enter at least one message')
    return
  }

  try {
    if (editingReminderId) {
      // Update existing reminder
      await (window as any).electronAPI.updateCustomReminder(editingReminderId, {
        name,
        messages,
        instructions,
        icon,
      })
    } else {
      // Add new reminder
      await (window as any).electronAPI.addCustomReminder(
        name,
        messages,
        instructions,
        icon
      )
    }

    // Reload custom reminders data from server
    const updatedCustomReminders = await (window as any).electronAPI.getCustomReminders()
    customReminders = updatedCustomReminders

    // Re-render the UI
    renderCustomReminders()
    closeCustomReminderModal()
  } catch (error) {
    console.error('Failed to save custom reminder:', error)
    alert('Failed to save reminder. Please try again.')
  }
}

// Global functions for inline onclick handlers
;(window as any).editCustomReminder = (id: string) => {
  openCustomReminderModal(id)
}
;(window as any).deleteCustomReminder = async (id: string) => {
  if (confirm('Are you sure you want to delete this custom reminder?')) {
    try {
      await (window as any).electronAPI.deleteCustomReminder(id)

      // Reload custom reminders data from server
      const updatedCustomReminders = await (
        window as any
      ).electronAPI.getCustomReminders()
      customReminders = updatedCustomReminders

      // Remove from current settings
      delete currentSettings[id]

      // Re-render the UI
      renderCustomReminders()
    } catch (error) {
      console.error('Failed to delete custom reminder:', error)
      alert('Failed to delete reminder. Please try again.')
    }
  }
}

function populateCustomReminderSounds(): void {
  customReminders.forEach(reminder => {
    const soundSelect = document.getElementById(
      `${reminder.id}-sound`
    ) as HTMLSelectElement
    if (!soundSelect) return

    // Get available sounds from the first built-in reminder dropdown
    const breathingSoundSelect = document.getElementById(
      'breathing-sound'
    ) as HTMLSelectElement
    if (!breathingSoundSelect) return

    // Clear and copy options
    soundSelect.innerHTML = ''
    for (let i = 0; i < breathingSoundSelect.options.length; i++) {
      const option = breathingSoundSelect.options[i]
      const newOption = document.createElement('option')
      newOption.value = option.value
      newOption.textContent = option.textContent
      soundSelect.appendChild(newOption)
    }

    // Set selected value
    const config = currentSettings[reminder.id]
    if (config) {
      soundSelect.value = config.selectedSound
    }
  })
}

function setupCustomReminderEventListeners(): void {
  customReminders.forEach(reminder => {
    const reminderId = reminder.id

    // Toggle switch
    const toggle = document.getElementById(`${reminderId}-toggle`)
    if (toggle) {
      toggle.addEventListener('click', event => {
        event.preventDefault()
        event.stopPropagation()

        const wasEnabled = currentSettings[reminderId].enabled
        const newEnabled = !wasEnabled

        currentSettings[reminderId].enabled = newEnabled

        // Update UI
        const statusDot = document.getElementById(`${reminderId}-status`)
        const statusText = document.getElementById(`${reminderId}-status-text`)

        if (newEnabled) {
          toggle.classList.add('active')
          statusDot?.classList.add('active')
          if (statusText)
            statusText.textContent = `Every ${currentSettings[reminderId].interval} min`
        } else {
          toggle.classList.remove('active')
          statusDot?.classList.remove('active')
          if (statusText) statusText.textContent = 'Disabled'
        }

        // Show/hide related controls
        toggleRowsVisibility(reminderId, newEnabled)
      })
    }

    // Interval dropdown
    const intervalSelect = document.getElementById(
      `${reminderId}-interval`
    ) as HTMLSelectElement
    if (intervalSelect) {
      intervalSelect.addEventListener('change', () => {
        const newInterval = parseInt(intervalSelect.value)
        currentSettings[reminderId].interval = newInterval

        // Update status text if enabled
        if (currentSettings[reminderId].enabled) {
          const statusText = document.getElementById(`${reminderId}-status-text`)
          if (statusText) statusText.textContent = `Every ${newInterval} min`
        }
      })
    }

    // Sound dropdown
    const soundSelect = document.getElementById(
      `${reminderId}-sound`
    ) as HTMLSelectElement
    if (soundSelect) {
      soundSelect.addEventListener('change', () => {
        const newSound = soundSelect.value
        currentSettings[reminderId].selectedSound = newSound
        currentSettings[reminderId].soundEnabled = newSound !== 'No Sound'
      })
    }

    // Test button
    const testButton = document.getElementById(`${reminderId}-test`)
    if (testButton) {
      testButton.addEventListener('click', async () => {
        const soundName = currentSettings[reminderId].selectedSound
        if (soundName && soundName !== 'No Sound') {
          try {
            await (window as any).electronAPI.testSound(soundName)
          } catch (error) {
            console.error('Failed to test sound:', error)
          }
        }
      })
    }
  })
}
