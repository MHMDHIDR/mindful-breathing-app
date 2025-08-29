import type { BaseReminder, ReminderConfig } from '../types/reminder-types'
import { notificationManager } from './notification-manager'
import { settingsManager } from './settings-manager'

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
}

export const reminderSystem = new ReminderSystemImpl()
