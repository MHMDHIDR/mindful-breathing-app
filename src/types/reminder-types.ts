export interface ReminderConfig {
  id: string
  name: string
  enabled: boolean
  interval: number // minutes
  soundEnabled: boolean
  selectedSound: string
  icon: string
}

export interface ReminderMessage {
  title: string
  message: string
  instruction: string
}

export interface AppSettings {
  reminders: Record<string, ReminderConfig>
  globalSoundEnabled: boolean
  startAtLogin: boolean
}

export abstract class BaseReminder {
  abstract id: string
  abstract name: string
  abstract icon: string
  abstract defaultInterval: number
  abstract defaultSound: string

  abstract getRandomMessage(): string
  abstract getInstruction(): string
  abstract getNotificationData(): ReminderMessage
}

export interface SoundManager {
  playSound(soundName: string): void
  getAvailableSounds(): string[]
  isValidSound(soundName: string): boolean
}

export interface NotificationManager {
  showReminder(data: ReminderMessage, soundName?: string): void
  showAppStarted(): void
  showAlreadyRunning(): void
}
