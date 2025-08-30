import {
  BaseReminder,
  type ReminderMessage,
  type CustomReminderData,
} from '../types/reminder-types'

export class CustomReminder extends BaseReminder {
  id: string
  name: string
  icon: string
  defaultInterval: number
  defaultSound = 'No Sound'

  private messages: string[]
  private instructions: string[]

  constructor(customData: CustomReminderData) {
    super()
    this.id = customData.id
    this.name = customData.name
    this.icon = customData.icon
    this.defaultInterval = customData.defaultInterval
    this.messages = customData.messages
    this.instructions = customData.instructions
  }

  getRandomMessage(): string {
    if (this.messages.length === 0) {
      return `Time for your ${this.name} reminder! 🔔`
    }
    return this.messages[Math.floor(Math.random() * this.messages.length)]!
  }

  getInstruction(): string {
    if (this.instructions.length === 0) {
      return `Take a moment to focus on ${this.name.toLowerCase()} 🎯`
    }
    return this.instructions[Math.floor(Math.random() * this.instructions.length)]!
  }

  getNotificationData(): ReminderMessage {
    return {
      title: `${this.icon} ${this.name} Reminder`,
      message: this.getRandomMessage(),
      instruction: this.getInstruction(),
    }
  }
}
