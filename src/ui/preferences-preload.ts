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
}

// Global variables for settings
let originalSettings: any = {}
let currentSettings: any = {}

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

    // Populate dropdowns with available sounds
    populateSoundDropdowns(data.sounds)

    // Set current values
    updateUIFromSettings()

    // Setup event listeners
    setupEventListeners()
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
