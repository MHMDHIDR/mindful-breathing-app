import { BrowserWindow, ipcMain, globalShortcut } from 'electron'
import * as path from 'path'
import { reminderSystem } from '../utils/reminder-system'
import { soundManager } from '../utils/sound-manager'

let preferencesWindow: BrowserWindow | null = null

export function createPreferencesWindow(): void {
  // Don't create multiple windows
  if (preferencesWindow && !preferencesWindow.isDestroyed()) {
    preferencesWindow.focus()
    return
  }

  // Find preload script path first
  const possiblePreloadPaths = [
    path.join(__dirname, 'preferences-preload.js'), // From dist folder
    path.join(process.cwd(), 'dist', 'preferences-preload.js'), // From project root
  ]

  let preloadPath = possiblePreloadPaths[0]
  const fs = require('fs')
  for (const testPath of possiblePreloadPaths) {
    if (fs.existsSync(testPath)) {
      preloadPath = testPath

      break
    }
  }

  preferencesWindow = new BrowserWindow({
    width: 500,
    height: 680,
    minWidth: 450,
    minHeight: 600,
    resizable: true,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar', // macOS frosted glass effect
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: preloadPath,
    },
    show: false, // Don't show until ready
  })

  // Load the HTML file - try multiple paths
  const possibleHtmlPaths = [
    path.join(__dirname, 'preferences.html'), // From dist folder
    path.join(process.cwd(), 'dist', 'preferences.html'), // From project root
    path.join(process.cwd(), 'src', 'ui', 'preferences.html'), // Development mode
  ]

  let htmlPath = possibleHtmlPaths[0]

  // Check which path exists
  for (const testPath of possibleHtmlPaths) {
    if (fs.existsSync(testPath)) {
      htmlPath = testPath

      break
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

    return {
      reminders,
      sounds,
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

  // Close preferences window
  ipcMain.handle('preferences:close', () => {
    if (preferencesWindow && !preferencesWindow.isDestroyed()) {
      preferencesWindow.close()
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
