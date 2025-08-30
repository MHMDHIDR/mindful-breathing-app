import type { BaseReminder, ReminderConfig } from '../types/reminder-types'
import { notificationManager } from './notification-manager'
import { settingsManager } from './settings-manager'
import { CustomReminder } from '../reminders/custom-reminder'

// Callback for menu updates
let onConfigChangeCallback: (() => void) | null = null

class ReminderSystemImpl {
  private reminders: Map<string, BaseReminder> = new Map()
  private intervals: Map<string, NodeJS.Timeout> = new Map()

  registerReminder(reminder: BaseReminder): void {
    this.reminders.set(reminder.id, reminder)

    // Initialize settings if not exists
    settingsManager.initializeReminder({
      id: reminder.id,
      name: reminder.name,
      enabled: true,
      interval: reminder.defaultInterval,
      soundEnabled: false,
      selectedSound: reminder.defaultSound,
      icon: reminder.icon,
    })
  }

  startReminder(reminderId: string): void {
    const reminder = this.reminders.get(reminderId)
    const config = settingsManager.getReminderConfig(reminderId)

    if (!reminder || !config || !config.enabled) {
      return
    }

    // Clear existing interval
    this.stopReminder(reminderId)

    // Set new interval
    const milliseconds = config.interval * 60 * 1000
    const intervalId = setInterval(() => {
      this.triggerReminder(reminderId)
    }, milliseconds)

    this.intervals.set(reminderId, intervalId)
  }

  stopReminder(reminderId: string): void {
    const intervalId = this.intervals.get(reminderId)
    if (intervalId) {
      clearInterval(intervalId)
      this.intervals.delete(reminderId)
    }
  }

  triggerReminder(reminderId: string): void {
    const reminder = this.reminders.get(reminderId)
    const config = settingsManager.getReminderConfig(reminderId)

    if (!reminder || !config || !config.enabled) {
      return
    }

    const notificationData = reminder.getNotificationData()
    const soundName = config.soundEnabled ? config.selectedSound : undefined

    notificationManager.showReminder(notificationData, soundName)
  }

  updateReminderConfig(reminderId: string, updates: Partial<ReminderConfig>): void {
    settingsManager.setReminderConfig(reminderId, updates)

    // Restart reminder if interval changed or enabled status changed
    if (updates.interval !== undefined || updates.enabled !== undefined) {
      if (updates.enabled === false) {
        this.stopReminder(reminderId)
      } else {
        this.startReminder(reminderId)
      }
    }

    // Notify menu to update
    if (onConfigChangeCallback) {
      onConfigChangeCallback()
    }
  }

  setOnConfigChangeCallback(callback: () => void): void {
    onConfigChangeCallback = callback
  }

  getReminderConfig(reminderId: string): ReminderConfig | null {
    return settingsManager.getReminderConfig(reminderId)
  }

  getAllReminders(): BaseReminder[] {
    return Array.from(this.reminders.values())
  }

  getAllConfigs(): Record<string, ReminderConfig> {
    return settingsManager.getAllReminders()
  }

  startAllEnabledReminders(): void {
    const configs = this.getAllConfigs()
    Object.keys(configs).forEach(reminderId => {
      if (configs[reminderId]?.enabled) {
        this.startReminder(reminderId)
      }
    })
  }

  stopAllReminders(): void {
    this.intervals.forEach((_, reminderId) => {
      this.stopReminder(reminderId)
    })
  }

  toggleSilentMode(): void {
    const currentSilentMode = settingsManager.getSilentMode()

    if (!currentSilentMode) {
      // Entering silent mode - save current enabled states and disable all
      const allConfigs = this.getAllConfigs()
      const originalStates: Record<string, boolean> = {}

      Object.keys(allConfigs).forEach(reminderId => {
        const config = allConfigs[reminderId]
        if (config) {
          originalStates[reminderId] = config.enabled
          if (config.enabled) {
            this.updateReminderConfig(reminderId, { enabled: false })
          }
        }
      })

      settingsManager.setSilentModeOriginalStates(originalStates)
      settingsManager.setSilentMode(true)
    } else {
      // Exiting silent mode - restore original states
      const originalStates = settingsManager.getSilentModeOriginalStates()

      Object.keys(originalStates).forEach(reminderId => {
        const shouldBeEnabled = originalStates[reminderId]
        if (shouldBeEnabled) {
          this.updateReminderConfig(reminderId, { enabled: true })
        }
      })

      settingsManager.setSilentMode(false)
      settingsManager.setSilentModeOriginalStates({})
    }

    // Notify menu to update
    if (onConfigChangeCallback) {
      onConfigChangeCallback()
    }
  }

  isSilentMode(): boolean {
    return settingsManager.getSilentMode()
  }

  // Custom Reminders Management
  loadCustomReminders(): void {
    const customReminders = settingsManager.getCustomReminders()
    Object.values(customReminders).forEach(customData => {
      const customReminder = new CustomReminder(customData)
      this.registerReminder(customReminder)
    })
  }

  addCustomReminder(
    name: string,
    messages: string[],
    instructions: string[],
    icon: string = '🔔'
  ): string {
    // Generate unique ID
    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create custom reminder data
    const customData: import('../types/reminder-types').CustomReminderData = {
      id,
      name,
      icon,
      messages,
      instructions,
      defaultInterval: 30, // Default to 30 minutes like breathing
      createdAt: new Date().toISOString(),
    }

    // Save to settings
    settingsManager.addCustomReminder(customData)

    // Create and register the reminder
    const customReminder = new CustomReminder(customData)
    this.registerReminder(customReminder)

    // Notify menu to update
    if (onConfigChangeCallback) {
      onConfigChangeCallback()
    }

    return id
  }

  updateCustomReminder(
    id: string,
    updates: {
      name?: string
      messages?: string[]
      instructions?: string[]
      icon?: string
    }
  ): void {
    const customData = settingsManager.getCustomReminder(id)
    if (!customData) return

    // Update the stored data
    settingsManager.updateCustomReminder(id, updates)

    // Remove old reminder and add updated one
    this.reminders.delete(id)
    this.stopReminder(id)

    const updatedData = { ...customData, ...updates }
    const customReminder = new CustomReminder(updatedData)
    this.registerReminder(customReminder)

    // Restart if it was enabled
    const config = settingsManager.getReminderConfig(id)
    if (config?.enabled) {
      this.startReminder(id)
    }

    // Notify menu to update
    if (onConfigChangeCallback) {
      onConfigChangeCallback()
    }
  }

  deleteCustomReminder(id: string): void {
    // Stop the reminder
    this.stopReminder(id)

    // Remove from reminders map
    this.reminders.delete(id)

    // Remove from settings
    settingsManager.deleteCustomReminder(id)

    // Notify menu to update
    if (onConfigChangeCallback) {
      onConfigChangeCallback()
    }
  }

  getCustomReminders(): import('../types/reminder-types').CustomReminderData[] {
    return Object.values(settingsManager.getCustomReminders())
  }
}

export const reminderSystem = new ReminderSystemImpl()
