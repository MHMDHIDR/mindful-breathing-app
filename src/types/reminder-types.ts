export interface ReminderConfig {
  id: string
  name: string
  enabled: boolean
  interval: number // minutes
  soundEnabled: boolean
  selectedSound: string
  icon: string
}

export interface CustomReminderData {
  id: string
  name: string
  icon: string
  messages: string[]
  instructions: string[]
  defaultInterval: number
  createdAt: string
}

export interface ReminderMessage {
  title: string
  message: string
  instruction: string
}

export interface AppSettings {
  reminders: Record<string, ReminderConfig>
  customReminders: Record<string, CustomReminderData>
  globalSoundEnabled: boolean
  startAtLogin: boolean
  silentMode: boolean
  silentModeOriginalStates: Record<string, boolean>
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
