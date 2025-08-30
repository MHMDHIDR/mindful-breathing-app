import Store from 'electron-store'
import type { AppSettings, ReminderConfig } from '../types/reminder-types'

class SettingsManagerImpl {
  private store: any //Store<AppSettings>

  constructor() {
    this.store = new Store<AppSettings>({
      defaults: {
        reminders: {
          breathing: {
            id: 'breathing',
            name: 'Breathing',
            enabled: true,
            interval: 30,
            soundEnabled: false,
            selectedSound: 'No Sound',
            icon: '🧘',
          },
          water: {
            id: 'water',
            name: 'Water',
            enabled: false,
            interval: 60,
            soundEnabled: false,
            selectedSound: 'No Sound',
            icon: '💧',
          },
          stretching: {
            id: 'stretching',
            name: 'Stretching',
            enabled: false,
            interval: 45,
            soundEnabled: false,
            selectedSound: 'No Sound',
            icon: '🤸‍♀️',
          },
        },
        globalSoundEnabled: true,
        startAtLogin: false,
        silentMode: false,
        silentModeOriginalStates: {},
        customReminders: {},
      },
    })
  }

  getReminderConfig(reminderId: string): ReminderConfig | null {
    return this.store.get(`reminders.${reminderId}`) || null
  }

  setReminderConfig(reminderId: string, config: Partial<ReminderConfig>): void {
    const currentConfig = this.getReminderConfig(reminderId)
    if (currentConfig) {
      this.store.set(`reminders.${reminderId}`, { ...currentConfig, ...config })
    }
  }

  getAllReminders(): Record<string, ReminderConfig> {
    return this.store.get('reminders')
  }

  getGlobalSoundEnabled(): boolean {
    return this.store.get('globalSoundEnabled')
  }

  setGlobalSoundEnabled(enabled: boolean): void {
    this.store.set('globalSoundEnabled', enabled)
  }

  getStartAtLogin(): boolean {
    return this.store.get('startAtLogin')
  }

  setStartAtLogin(enabled: boolean): void {
    this.store.set('startAtLogin', enabled)
  }

  getAllSettings(): AppSettings {
    return this.store.store
  }

  // Initialize a new reminder type
  initializeReminder(config: ReminderConfig): void {
    if (!this.getReminderConfig(config.id)) {
      this.store.set(`reminders.${config.id}`, config)
    }
  }

  getSilentMode(): boolean {
    return this.store.get('silentMode', false)
  }

  setSilentMode(enabled: boolean): void {
    this.store.set('silentMode', enabled)
  }

  getSilentModeOriginalStates(): Record<string, boolean> {
    return this.store.get('silentModeOriginalStates', {})
  }

  setSilentModeOriginalStates(states: Record<string, boolean>): void {
    this.store.set('silentModeOriginalStates', states)
  }

  // Custom Reminders Management
  getCustomReminders(): Record<
    string,
    import('../types/reminder-types').CustomReminderData
  > {
    return this.store.get('customReminders', {})
  }

  getCustomReminder(
    id: string
  ): import('../types/reminder-types').CustomReminderData | null {
    const customReminders = this.getCustomReminders()
    return customReminders[id] || null
  }

  addCustomReminder(
    reminderData: import('../types/reminder-types').CustomReminderData
  ): void {
    const customReminders = this.getCustomReminders()
    customReminders[reminderData.id] = reminderData
    this.store.set('customReminders', customReminders)
  }

  updateCustomReminder(
    id: string,
    updates: Partial<import('../types/reminder-types').CustomReminderData>
  ): void {
    const customReminders = this.getCustomReminders()
    if (customReminders[id]) {
      customReminders[id] = { ...customReminders[id], ...updates }
      this.store.set('customReminders', customReminders)
    }
  }

  deleteCustomReminder(id: string): void {
    const customReminders = this.getCustomReminders()
    delete customReminders[id]
    this.store.set('customReminders', customReminders)

    // Also remove the reminder config
    this.store.delete(`reminders.${id}`)
  }
}

export const settingsManager = new SettingsManagerImpl()
