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
}

export const settingsManager = new SettingsManagerImpl()
