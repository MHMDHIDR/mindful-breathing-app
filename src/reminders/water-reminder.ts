import { BaseReminder, type ReminderMessage } from '../types/reminder-types'
import { waterMessages, waterInstructions } from '../data/water-data'

export class WaterReminder extends BaseReminder {
  id = 'water'
  name = 'Water'
  icon = '💧'
  defaultInterval = 60
  defaultSound = 'Relaxing Ocean Waves.mp3'

  getRandomMessage(): string {
    return waterMessages[Math.floor(Math.random() * waterMessages.length)]!
  }

  getInstruction(): string {
    return waterInstructions[Math.floor(Math.random() * waterInstructions.length)]!
  }

  getNotificationData(): ReminderMessage {
    return {
      title: '💧 Hydration Break',
      message: this.getRandomMessage(),
      instruction: this.getInstruction(),
    }
  }
}
