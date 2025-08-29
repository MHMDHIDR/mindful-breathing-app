import notifier from 'node-notifier'
import type { NotificationManager, ReminderMessage } from '../types/reminder-types'
import { soundManager } from './sound-manager'

class NotificationManagerImpl implements NotificationManager {
  showReminder(data: ReminderMessage, soundName?: string): void {
    // Play sound if specified
    if (soundName) {
      soundManager.playSound(soundName)
    }

    notifier.notify({
      title: data.title,
      message: `${data.message}\n\n${data.instruction}`,
      sound: false, // We handle sound separately
      wait: false,
      timeout: 10,
      actions: ['Start', 'Skip'], // macOS only
    })
  }

  showAppStarted(): void {
    notifier.notify({
      title: '🧘 Mindful Breathing Reminder Started',
      message:
        'Your breathing reminders are now active!\n\nDefault: every 30 minutes\nClick the menu bar icon to customize.',
      sound: false,
      timeout: 5,
    })
  }

  showAlreadyRunning(): void {
    notifier.notify({
      title: '🧘 Mindful Breathing',
      message: 'App is already running in the menu bar!',
      sound: false,
      timeout: 3,
    })
  }

  showQuickExercise(soundName?: string): void {
    // Play sound if specified
    if (soundName) {
      soundManager.playSound(soundName)
    }

    notifier.notify({
      title: '🧘 Quick Breathing Exercise',
      message:
        "Let's do it together!\n\n1. Inhale slowly (4 seconds)\n2. Hold (4 seconds)\n3. Exhale slowly (4 seconds)\n4. Repeat 3 times\n\nYou've got this! 💪",
      sound: false,
      timeout: 20,
    })
  }
}

export const notificationManager = new NotificationManagerImpl()
