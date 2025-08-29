import { Menu, app, type MenuItemConstructorOptions } from 'electron'
import { reminderSystem } from './reminder-system'
import { notificationManager } from './notification-manager'
import { settingsManager } from './settings-manager'
import { createPreferencesWindow } from '../ui/preferences-window'

export function buildContextMenu(): Menu {
  const allReminders = reminderSystem.getAllReminders()
  const allConfigs = reminderSystem.getAllConfigs()

  // Count enabled reminders
  const enabledCount = Object.values(allConfigs).filter(config => config.enabled).length
  const statusText =
    enabledCount > 0
      ? `🧘 ${enabledCount} Reminder${enabledCount > 1 ? 's' : ''} Active`
      : '😴 No Reminders Active'

  const menuItems: MenuItemConstructorOptions[] = [
    {
      label: statusText,
      enabled: false,
    },
    {
      type: 'separator',
    },
    {
      label: '📢 Test Notification',
      click: () => {
        // Test the first enabled reminder
        const enabledReminder = allReminders.find(r => allConfigs[r.id]?.enabled)
        if (enabledReminder) {
          reminderSystem.triggerReminder(enabledReminder.id)
        } else {
          // If no reminders are enabled, test breathing reminder
          reminderSystem.triggerReminder('breathing')
        }
      },
    },
    {
      label: '🎯 Quick Breathing Exercise',
      click: () => {
        const breathingConfig = reminderSystem.getReminderConfig('breathing')
        const soundName = breathingConfig?.soundEnabled
          ? breathingConfig.selectedSound
          : undefined
        notificationManager.showQuickExercise(soundName)
      },
    },
    {
      type: 'separator',
    },
    {
      label: '⚙️ Preferences...',
      accelerator: 'CmdOrCtrl+,',
      click: () => {
        createPreferencesWindow()
      },
    },
    {
      type: 'separator',
    },
    {
      label: '🚀 Start at Login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: () => {
        const currentSetting = app.getLoginItemSettings().openAtLogin
        const newSetting = !currentSetting

        app.setLoginItemSettings({
          openAtLogin: newSetting,
          openAsHidden: true,
        })

        settingsManager.setStartAtLogin(newSetting)
      },
    },
    {
      type: 'separator',
    },
    {
      label: '❌ Quit',
      click: () => {
        reminderSystem.stopAllReminders()
        app.quit()
      },
    },
  ]

  return Menu.buildFromTemplate(menuItems)
}
