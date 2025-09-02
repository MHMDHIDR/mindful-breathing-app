import { BrowserWindow, ipcMain, globalShortcut, app } from 'electron'
import * as path from 'path'
import { reminderSystem } from '../utils/reminder-system'
import { soundManager } from '../utils/sound-manager'
import {
  getSecureWebPreferences,
  applyDevToolsProtection,
} from '../utils/security-manager'

let preferencesWindow: BrowserWindow | null = null

export function createPreferencesWindow(): void {
  // Don't create multiple windows
  if (preferencesWindow && !preferencesWindow.isDestroyed()) {
    preferencesWindow.show()
    preferencesWindow.focus()
    return
  }

  // Find preload script path first
  const fs = require('fs')
  const isPackaged = app.isPackaged

  let preloadPath: string

  if (isPackaged) {
    // In packaged app, files are in resources/app.asar or resources/app.asar.unpacked
    preloadPath = path.join(
      process.resourcesPath,
      'app.asar',
      'dist',
      'preferences-preload.js'
    )

    // Check if it exists in unpacked resources (shouldn't be needed for preload but let's be safe)
    if (!fs.existsSync(preloadPath)) {
      preloadPath = path.join(
        process.resourcesPath,
        'app.asar.unpacked',
        'dist',
        'preferences-preload.js'
      )
    }

    // Fallback to app path
    if (!fs.existsSync(preloadPath)) {
      preloadPath = path.join(app.getAppPath(), 'dist', 'preferences-preload.js')
    }
  } else {
    // In development, try different locations
    const possiblePreloadPaths = [
      path.join(__dirname, 'preferences-preload.js'), // From dist folder
      path.join(process.cwd(), 'dist', 'preferences-preload.js'), // From project root
    ]

    preloadPath = possiblePreloadPaths[0]
    for (const testPath of possiblePreloadPaths) {
      if (fs.existsSync(testPath)) {
        preloadPath = testPath
        break
      }
    }
  }

  preferencesWindow = new BrowserWindow({
    width: 720,
    minWidth: 720,
    maxWidth: 720,
    height: 600,
    minHeight: 600,
    maxHeight: 1200,
    resizable: true,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar', // macOS frosted glass effect
    webPreferences: getSecureWebPreferences({
      // Override secure defaults where needed for this window
      nodeIntegration: true,
      contextIsolation: false,
      preload: preloadPath,
    }),
    show: false, // Don't show until ready
  })

  // Apply DevTools protection and security measures
  applyDevToolsProtection(preferencesWindow)

  // Load the HTML file - use proper path resolution
  let htmlPath: string

  if (isPackaged) {
    // In packaged app, files are in resources/app.asar
    htmlPath = path.join(process.resourcesPath, 'app.asar', 'dist', 'preferences.html')

    // Fallback to app path
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.join(app.getAppPath(), 'dist', 'preferences.html')
    }
  } else {
    // In development, try different locations
    const possibleHtmlPaths = [
      path.join(__dirname, 'preferences.html'), // From dist folder
      path.join(process.cwd(), 'dist', 'preferences.html'), // From project root
      path.join(process.cwd(), 'src', 'ui', 'preferences.html'), // Development mode
    ]

    htmlPath = possibleHtmlPaths[0]
    for (const testPath of possibleHtmlPaths) {
      if (fs.existsSync(testPath)) {
        htmlPath = testPath
        break
      }
    }
  }

  preferencesWindow.loadFile(htmlPath)

  // Show window when ready
  preferencesWindow.once('ready-to-show', () => {
    preferencesWindow?.show()
    preferencesWindow?.focus()
  })

  // Clean up when closed
  preferencesWindow.on('closed', () => {
    preferencesWindow = null
  })

  // Handle window closing
  preferencesWindow.on('close', event => {
    if (process.platform === 'darwin') {
      // On macOS, hide instead of closing
      event.preventDefault()
      preferencesWindow?.hide()
    }
  })
}

export function setupPreferencesIPC(): void {
  // Get initial settings
  ipcMain.handle('preferences:get-settings', () => {
    const reminders = reminderSystem.getAllConfigs()
    const sounds = soundManager.getAvailableSounds()
    const customReminders = reminderSystem.getCustomReminders()

    return {
      reminders,
      sounds,
      customReminders,
    }
  })

  // Update reminder settings
  ipcMain.handle('preferences:update-reminder', (_, reminderId: string, updates: any) => {
    try {
      reminderSystem.updateReminderConfig(reminderId, updates)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // Test sound
  ipcMain.handle('preferences:test-sound', (_, soundName: string) => {
    try {
      soundManager.playSound(soundName)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // Close preferences window (for Save/Cancel buttons)
  ipcMain.handle('preferences:close', () => {
    if (preferencesWindow && !preferencesWindow.isDestroyed()) {
      // Force close without triggering the close event prevention
      preferencesWindow.destroy()
      preferencesWindow = null
    }
  })

  // Dynamically resize window based on custom reminders count
  ipcMain.handle('preferences:resize-window', (_, customRemindersCount: number) => {
    if (preferencesWindow && !preferencesWindow.isDestroyed()) {
      // Base height for 2x2 grid (3 main reminders + custom section)
      const baseHeight = 600
      // Additional height per custom reminder
      const additionalHeightPerReminder = 80
      // Calculate new height
      const newHeight = Math.min(
        baseHeight + customRemindersCount * additionalHeightPerReminder,
        1200 // Maximum height
      )

      preferencesWindow.setSize(720, newHeight)
      return { success: true, newHeight }
    }
    return { success: false, error: 'Window not available' }
  })

  // Custom Reminders IPC Handlers
  ipcMain.handle('preferences:get-custom-reminders', () => {
    try {
      return reminderSystem.getCustomReminders()
    } catch (error) {
      return []
    }
  })

  ipcMain.handle(
    'preferences:add-custom-reminder',
    (_, name: string, messages: string[], instructions: string[], icon: string) => {
      try {
        const id = reminderSystem.addCustomReminder(name, messages, instructions, icon)
        return { success: true, id }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    }
  )

  ipcMain.handle('preferences:update-custom-reminder', (_, id: string, updates: any) => {
    try {
      reminderSystem.updateCustomReminder(id, updates)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('preferences:delete-custom-reminder', (_, id: string) => {
    try {
      reminderSystem.deleteCustomReminder(id)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })
}

export function setupGlobalShortcuts(): void {
  // Register Cmd+, (or Ctrl+, on Windows/Linux) to open preferences
  const shortcut = process.platform === 'darwin' ? 'Cmd+,' : 'Ctrl+,'

  globalShortcut.register(shortcut, () => {
    createPreferencesWindow()
  })
}

export function cleanupPreferencesWindow(): void {
  globalShortcut.unregisterAll()

  if (preferencesWindow && !preferencesWindow.isDestroyed()) {
    preferencesWindow.close()
  }
  preferencesWindow = null
}
