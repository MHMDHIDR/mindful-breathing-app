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
let originalIconPath: string | null = null
let fallbackIconBuffer: Buffer | null = null

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
      originalIconPath = testPath
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
    fallbackIconBuffer = buffer
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
  tray.setToolTip('Mindful Wellness Reminder')

  // Set context menu
  updateTrayMenu()
}

function updateTrayMenu(): void {
  if (tray) {
    tray.setContextMenu(buildContextMenu())
    updateTrayIconAppearance()
  }
}

function updateTrayIconAppearance(): void {
  if (!tray) return

  const isSilentMode = reminderSystem.isSilentMode()

  if (isSilentMode) {
    // Create a 50% opacity version of the original icon
    let silentIcon: Electron.NativeImage | null = null
    if (originalIconPath) {
      silentIcon = nativeImage.createFromPath(originalIconPath)
    } else if (fallbackIconBuffer) {
      const size = { width: 16, height: 16 }
      silentIcon = nativeImage.createFromBuffer(fallbackIconBuffer, size)
    }

    if (silentIcon) {
      // Platform-specific icon sizing first
      if (process.platform === 'darwin') {
        silentIcon = silentIcon.resize({ width: 22, height: 22 })
      } else {
        silentIcon = silentIcon.resize({ width: 16, height: 16 })
      }

      // Create 50% opacity version by manipulating the PNG buffer
      const pngBuffer = silentIcon.toPNG()
      const transparentIcon = createTransparentIcon(pngBuffer, 0.5)

      if (transparentIcon) {
        if (process.platform === 'darwin') {
          transparentIcon.setTemplateImage(true) // Keep template behavior for proper menu bar appearance
        }
        silentIcon = transparentIcon
      }

      // Update tooltip to indicate silent mode
      tray.setToolTip('Mindful Wellness Reminder (Silent Mode)')
      tray.setImage(silentIcon)
    }
  } else {
    // Restore normal appearance
    let normalIcon: Electron.NativeImage | null = null
    if (originalIconPath) {
      normalIcon = nativeImage.createFromPath(originalIconPath)
    } else if (fallbackIconBuffer) {
      const size = { width: 16, height: 16 }
      normalIcon = nativeImage.createFromBuffer(fallbackIconBuffer, size)
    }

    if (normalIcon) {
      // Platform-specific icon sizing
      if (process.platform === 'darwin') {
        normalIcon = normalIcon.resize({ width: 22, height: 22 })
        normalIcon.setTemplateImage(true)
      } else {
        normalIcon = normalIcon.resize({ width: 16, height: 16 })
      }

      tray.setToolTip('Mindful Wellness Reminder')
      tray.setImage(normalIcon)
    }
  }
}

function createTransparentIcon(
  pngBuffer: Buffer,
  opacity: number
): Electron.NativeImage | null {
  try {
    // For a simple approach, we'll create a new image with reduced opacity
    // by modifying the alpha channel of each pixel
    const originalImage = nativeImage.createFromBuffer(pngBuffer)
    const size = originalImage.getSize()

    // Create a new buffer for the transparent version
    const canvas = Buffer.alloc(size.width * size.height * 4) // RGBA

    // Get the original image as a bitmap (this is a simplified approach)
    // Since we can't easily manipulate PNG pixel data directly in Electron,
    // we'll use a different approach: create a semi-transparent overlay

    // For now, let's use a simpler approach - create a faded version
    // by creating a new image with the same data but modified alpha
    const bitmap = originalImage.toBitmap()

    // Modify alpha channel for each pixel
    for (let i = 0; i < bitmap.length; i += 4) {
      canvas[i] = bitmap[i] // R
      canvas[i + 1] = bitmap[i + 1] // G
      canvas[i + 2] = bitmap[i + 2] // B
      canvas[i + 3] = Math.floor(bitmap[i + 3] * opacity) // A (reduced by opacity)
    }

    return nativeImage.createFromBuffer(canvas, size)
  } catch (error) {
    console.warn('Failed to create transparent icon:', error)
    return null
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
