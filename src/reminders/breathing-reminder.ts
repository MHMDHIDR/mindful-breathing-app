import { BaseReminder, type ReminderMessage } from '../types/reminder-types'
import { breathingMessages, breathingInstructions } from '../data/breathing-data'

export class BreathingReminder extends BaseReminder {
  id = 'breathing'
  name = 'Breathing'
  icon = '🧘'
  defaultInterval = 30
  defaultSound = 'No Sound'

  getRandomMessage(): string {
    return breathingMessages[Math.floor(Math.random() * breathingMessages.length)]!
  }

  getInstruction(): string {
    return breathingInstructions[
      Math.floor(Math.random() * breathingInstructions.length)
    ]!
  }

  getNotificationData(): ReminderMessage {
    return {
      title: '🧘 Mindful Breathing Break',
      message: this.getRandomMessage(),
      instruction: this.getInstruction(),
    }
  }
}
