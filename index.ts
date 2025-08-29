import { app, Tray, Menu, nativeImage, type MenuItemConstructorOptions } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { exec } from 'child_process'
import notifier from 'node-notifier'

let tray: Tray | null = null
let intervalId: NodeJS.Timeout | null = null

// Sound settings
let selectedSound: string = 'No Sound'
const availableSounds = [
  'No Sound',
  'Spring Forest Nature Sound.mp3',
  'Nature Sounds.mp3',
  'Relaxing Ocean Sounds.mp3',
  'Relaxing Ocean Waves.mp3',
  'Chirping Sound Effect.mp3',
  'Chirping Sound Effects.mp3',
  'Chirping Bird Sound.mp3',
  'Chirping Sound Effects 2.mp3',
]

// Motivational messages pool
const messages: string[] = [
  "You're doing amazing! Time for a 30-second breathing break 🌟",
  "Great work today! Let's take a mindful moment to breathe 💨",
  "You've been crushing it! Quick breathing break? 🎯",
  'Your focus is incredible! Time to recharge with deep breaths 🧘',
  "Amazing progress! Let's pause for some mindful breathing 🌱",
  "You're on fire today! 30 seconds to breathe and reset 🔥",
  'Fantastic work! Your mind deserves a breathing break 💪',
  "You're killing it! Time for a quick mindfulness moment ✨",
  "Stellar performance! Let's refresh with some deep breaths 🌊",
  "You're unstoppable! Quick pause for mindful breathing? 🚀",
]

// Breathing exercise instructions
const breathingInstructions: string[] = [
  'Inhale for 4, hold for 4, exhale for 4 🫁',
  'Take 3 deep breaths, feeling your chest expand 🌬️',
  'Breathe in peace, breathe out tension 😌',
  '4-7-8 breathing: In for 4, hold for 7, out for 8 🧘',
  'Box breathing: In-4, Hold-4, Out-4, Hold-4 📦',
]

// Get random message
function getRandomMessage(): string {
  return messages[Math.floor(Math.random() * messages.length)]!
}

// Get random breathing instruction
function getRandomBreathingInstruction(): string {
  return breathingInstructions[Math.floor(Math.random() * breathingInstructions.length)]!
}

// Play selected sound
function playNotificationSound(): void {
  if (selectedSound === 'No Sound') {
    return
  }

  try {
    // Proper ASAR-aware path resolution for sounds
    let soundPath = path.join(app.getAppPath(), 'sounds', selectedSound)

    // Handle ASAR unpacking - replace app.asar with app.asar.unpacked
    if (soundPath.includes('app.asar') && !soundPath.includes('app.asar.unpacked')) {
      soundPath = soundPath.replace('app.asar', 'app.asar.unpacked')
    }

    // Fallback for development
    if (!fs.existsSync(soundPath)) {
      const devPath = path.join(process.cwd(), 'sounds', selectedSound)
      if (fs.existsSync(devPath)) {
        soundPath = devPath
      }
    }

    if (soundPath && fs.existsSync(soundPath)) {
      if (process.platform === 'darwin') {
        // macOS - use afplay without timeout (let it complete naturally)
        exec(`afplay "${soundPath}"`, error => {
          if (error && error.signal !== 'SIGTERM') {
            console.error('Sound playback error:', error)
          }
        })
      } else if (process.platform === 'win32') {
        // Windows - use powershell
        exec(`powershell -c "(New-Object Media.SoundPlayer '${soundPath}').PlaySync();"`)
      } else {
        // Linux - use aplay or paplay
        exec(`aplay "${soundPath}" 2>/dev/null || paplay "${soundPath}" 2>/dev/null`)
      }
    } else {
      console.error('Sound file not found:', selectedSound)
    }
  } catch (error) {}
}

// Send notification
function sendBreathingReminder(): void {
  const message = getRandomMessage()
  const instruction = getRandomBreathingInstruction()

  // Play custom sound
  playNotificationSound()

  notifier.notify({
    title: '🧘 Mindful Breathing Break',
    message: `${message}\n\n${instruction}`,
    sound: false, // Disable built-in sound since we're using custom sounds
    wait: false,
    timeout: 10,
    actions: ['Start', 'Skip'], // macOS only
  })
}

// Function to set reminder interval
function setReminderInterval(minutes: number): void {
  // Clear existing interval
  if (intervalId) {
    clearInterval(intervalId)
  }

  // Set new interval
  const milliseconds = minutes * 60 * 1000
  intervalId = setInterval(() => {
    sendBreathingReminder()
  }, milliseconds)
}

// Hide from Dock on macOS (menu bar only app)
if (process.platform === 'darwin' && app.dock) {
  app.dock.hide()
}

// Create the app
app.whenReady().then(() => {
  // Load custom icon from icons directory
  // Try multiple possible paths for the icon
  const possibleIconPaths = [
    path.join(__dirname, '..', 'icons', 'icon.png'), // From dist folder
    path.join(process.cwd(), 'icons', 'icon.png'), // From project root
    path.join(__dirname, 'icons', 'icon.png'), // If icons copied to dist
  ]

  let icon
  let iconPath = ''

  // Try each path until we find the icon
  for (const testPath of possibleIconPaths) {
    if (fs.existsSync(testPath)) {
      iconPath = testPath
      icon = nativeImage.createFromPath(iconPath)

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

  // For macOS, create a template image that adapts to menu bar theme
  if (process.platform === 'darwin') {
    // Resize icon to appropriate size for macOS menu bar (16x16 or 22x22)
    icon = icon.resize({ width: 22, height: 22 })
    icon.setTemplateImage(true) // This makes it adapt to light/dark menu bar
  } else {
    // For Windows/Linux, resize to standard tray icon size
    icon = icon.resize({ width: 16, height: 16 })
  }

  tray = new Tray(icon)

  // Set tooltip
  tray.setToolTip('Mindful Breathing Reminder')

  // Track current interval
  let currentInterval = 30

  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '🧘 Mindful Breathing Active',
      enabled: false,
    },
    {
      type: 'separator',
    },
    {
      label: '📢 Test Notification',
      click: () => {
        sendBreathingReminder()
      },
    },
    {
      label: '🎯 Quick Breathing Exercise',
      click: () => {
        // Play custom sound for quick exercise too
        playNotificationSound()

        notifier.notify({
          title: '🧘 Quick Breathing Exercise',
          message:
            "Let's do it together!\n\n1. Inhale slowly (4 seconds)\n2. Hold (4 seconds)\n3. Exhale slowly (4 seconds)\n4. Repeat 3 times\n\nYou've got this! 💪",
          sound: false, // Use our custom sound instead
          timeout: 20,
        })
      },
    },
    {
      type: 'separator',
    },
    {
      label: '⏱️ Reminder Interval',
      submenu: [
        {
          label: 'Every 1 minute',
          type: 'radio',
          checked: currentInterval === 1,
          click: () => {
            currentInterval = 1
            setReminderInterval(1)
          },
        },
        {
          label: 'Every 5 minutes',
          type: 'radio',
          checked: currentInterval === 5,
          click: () => {
            currentInterval = 5
            setReminderInterval(5)
          },
        },
        {
          label: 'Every 15 minutes',
          type: 'radio',
          checked: currentInterval === 15,
          click: () => {
            currentInterval = 15
            setReminderInterval(15)
          },
        },
        {
          label: 'Every 30 minutes',
          type: 'radio',
          checked: currentInterval === 30,
          click: () => {
            currentInterval = 30
            setReminderInterval(30)
          },
        },
        {
          label: 'Every 45 minutes',
          type: 'radio',
          checked: currentInterval === 45,
          click: () => {
            currentInterval = 45
            setReminderInterval(45)
          },
        },
        {
          label: 'Every 60 minutes',
          type: 'radio',
          checked: currentInterval === 60,
          click: () => {
            currentInterval = 60
            setReminderInterval(60)
          },
        },
      ] as MenuItemConstructorOptions[],
    },
    {
      type: 'separator',
    },
    {
      label: '🔊 Notification Sound',
      submenu: availableSounds.map(sound => ({
        label: sound === 'No Sound' ? '🔇 No Sound' : `🎵 ${sound.replace('.mp3', '')}`,
        type: 'radio' as const,
        checked: selectedSound === sound,
        click: () => {
          selectedSound = sound

          // Test the sound when selected (except for "No Sound")
          if (sound !== 'No Sound') {
            playNotificationSound()
          }
        },
      })),
    },
    {
      type: 'separator',
    },
    {
      label: '🚀 Start at Login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: () => {
        const currentSetting = app.getLoginItemSettings().openAtLogin
        app.setLoginItemSettings({
          openAtLogin: !currentSetting,
          openAsHidden: true,
        })
      },
    },
    {
      type: 'separator',
    },
    {
      label: '❌ Quit',
      click: () => {
        if (intervalId) clearInterval(intervalId)
        app.quit()
      },
    },
  ] as MenuItemConstructorOptions[])

  // Set context menu
  tray.setContextMenu(contextMenu)

  // Start with default 30-minute intervals
  setReminderInterval(30)

  // Send initial notification to confirm app is running
  notifier.notify({
    title: '🧘 Mindful Breathing Reminder Started',
    message:
      'Your breathing reminders are now active!\n\nDefault: every 30 minutes\nClick the menu bar icon to customize.',
    sound: false,
    timeout: 5,
  })

  // Log for debugging
})

// Prevent app from closing when all windows are closed
app.on('window-all-closed', () => {
  // Do nothing to keep the app running in the tray (especially on macOS)
})
app.on('activate', () => {
  // On macOS, re-create tray if needed
  if (tray === null) {
    app.emit('ready')
  }
})

// Only quit when explicitly told to
app.on('before-quit', () => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance
    notifier.notify({
      title: '🧘 Mindful Breathing',
      message: 'App is already running in the menu bar!',
      sound: false,
      timeout: 3,
    })
  })
}
