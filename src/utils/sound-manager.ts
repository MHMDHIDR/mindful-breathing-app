import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { exec } from 'child_process'
import { availableSounds } from '../data/sounds-data'
import type { SoundManager } from '../types/reminder-types'

class SoundManagerImpl implements SoundManager {
  private getSoundPath(soundName: string): string | null {
    if (soundName === 'No Sound') {
      return null
    }

    // Proper ASAR-aware path resolution for sounds
    let soundPath = path.join(app.getAppPath(), 'sounds', soundName)

    // Handle ASAR unpacking - replace app.asar with app.asar.unpacked
    if (soundPath.includes('app.asar') && !soundPath.includes('app.asar.unpacked')) {
      soundPath = soundPath.replace('app.asar', 'app.asar.unpacked')
    }

    // Fallback for development
    if (!fs.existsSync(soundPath)) {
      const devPath = path.join(process.cwd(), 'sounds', soundName)
      if (fs.existsSync(devPath)) {
        soundPath = devPath
      }
    }

    return fs.existsSync(soundPath) ? soundPath : null
  }

  playSound(soundName: string): void {
    if (soundName === 'No Sound') {
      return
    }

    try {
      const soundPath = this.getSoundPath(soundName)

      if (!soundPath) {
        console.error('Sound file not found:', soundName)
        return
      }

      if (process.platform === 'darwin') {
        // macOS - use afplay
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
    } catch (error) {
      console.error('Failed to play sound:', error)
    }
  }

  getAvailableSounds(): string[] {
    return [...availableSounds]
  }

  isValidSound(soundName: string): boolean {
    return availableSounds.includes(soundName)
  }
}

export const soundManager = new SoundManagerImpl()
