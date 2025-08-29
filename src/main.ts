import { app, Tray, nativeImage } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

// Import our modular utilities
import { reminderSystem } from './utils/reminder-system'
import { notificationManager } from './utils/notification-manager'
import { buildContextMenu } from './utils/menu-builder'
import {
  setupPreferencesIPC,
  setupGlobalShortcuts,
  cleanupPreferencesWindow,
} from './ui/preferences-window'

// Import reminder implementations
import { BreathingReminder } from './reminders/breathing-reminder'
import { WaterReminder } from './reminders/water-reminder'
import { StretchingReminder } from './reminders/stretching-reminder'

let tray: Tray | null = null

// Hide from Dock on macOS (menu bar only app)
if (process.platform === 'darwin' && app.dock) {
  app.dock.hide()
}

// Initialize the app
app.whenReady().then(() => {
  // Initialize reminder system
  setupReminders()

  // Setup preferences system

  setupPreferencesIPC()
  setupGlobalShortcuts()

  // Create tray icon
  createTrayIcon()

  // Setup callback to update menu when config changes
  reminderSystem.setOnConfigChangeCallback(() => {
    updateTrayMenu()
  })

  // Start all enabled reminders
  reminderSystem.startAllEnabledReminders()

  // Show startup notification
  notificationManager.showAppStarted()
})

function setupReminders(): void {
  // Register all reminder types
  reminderSystem.registerReminder(new BreathingReminder())
  reminderSystem.registerReminder(new WaterReminder())
  reminderSystem.registerReminder(new StretchingReminder())

  // TODO: Add more reminder types here (eye breaks, posture checks, etc.)
}

function createTrayIcon(): void {
  // Load custom icon from icons directory
  const possibleIconPaths = [
    path.join(__dirname, '..', 'icons', 'icon.png'), // From dist folder
    path.join(process.cwd(), 'icons', 'icon.png'), // From project root
    path.join(__dirname, 'icons', 'icon.png'), // If icons copied to dist
  ]

  let icon: Electron.NativeImage | null = null

  // Try each path until we find the icon
  for (const testPath of possibleIconPaths) {
    if (fs.existsSync(testPath)) {
      icon = nativeImage.createFromPath(testPath)
      break
    }
  }

  // Fallback: create a simple programmatic icon if file not found
  if (!icon || icon.isEmpty()) {
    const size = { width: 16, height: 16 }
    const buffer = Buffer.alloc(size.width * size.height * 4)

    // Create a simple breathing circle pattern
    for (let y = 0; y < size.height; y++) {
      for (let x = 0; x < size.width; x++) {
        const index = (y * size.width + x) * 4
        const centerX = size.width / 2
        const centerY = size.height / 2
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)

        if (distance <= 6) {
          buffer[index] = 100 // R
          buffer[index + 1] = 150 // G
          buffer[index + 2] = 200 // B
          buffer[index + 3] = 255 // A
        }
      }
    }

    icon = nativeImage.createFromBuffer(buffer, size)
  }

  // Platform-specific icon sizing
  if (process.platform === 'darwin') {
    icon = icon.resize({ width: 22, height: 22 })
    icon.setTemplateImage(true)
  } else {
    icon = icon.resize({ width: 16, height: 16 })
  }

  // Create tray
  tray = new Tray(icon)
  tray.setToolTip('Mindful Breathing Reminder')

  // Set context menu
  updateTrayMenu()
}

function updateTrayMenu(): void {
  if (tray) {
    tray.setContextMenu(buildContextMenu())
  }
}

// Export for use by preferences window
export { updateTrayMenu }

// App lifecycle events
app.on('window-all-closed', () => {
  // Do nothing to keep the app running in the tray
})

app.on('activate', () => {
  // On macOS, re-create tray if needed
  if (tray === null) {
    app.emit('ready')
  }
})

app.on('before-quit', () => {
  reminderSystem.stopAllReminders()
  cleanupPreferencesWindow()
})

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    notificationManager.showAlreadyRunning()
  })
}
