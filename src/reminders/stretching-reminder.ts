import { BaseReminder, type ReminderMessage } from '../types/reminder-types'
import { stretchingMessages, stretchingInstructions } from '../data/stretching-data'

export class StretchingReminder extends BaseReminder {
  id = 'stretching'
  name = 'Stretching'
  icon = '🤸‍♀️'
  defaultInterval = 45
  defaultSound = 'Spring Forest Nature Sound.mp3'

  getRandomMessage(): string {
    return stretchingMessages[Math.floor(Math.random() * stretchingMessages.length)]!
  }

  getInstruction(): string {
    return stretchingInstructions[
      Math.floor(Math.random() * stretchingInstructions.length)
    ]!
  }

  getNotificationData(): ReminderMessage {
    return {
      title: '🤸‍♀️ Stretch Break',
      message: this.getRandomMessage(),
      instruction: this.getInstruction(),
    }
  }
}
