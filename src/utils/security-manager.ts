import { BrowserWindow, app } from 'electron'

/**
 * Security Manager - Handles DevTools protection and security settings
 *
 * This module provides comprehensive security features for Electron applications:
 *
 * FEATURES:
 * - Automatically disables DevTools in production builds
 * - Blocks all common DevTools keyboard shortcuts (F12, Ctrl+Shift+I, etc.)
 * - Prevents right-click context menu in production
 * - Blocks programmatic DevTools opening
 * - Prevents new window creation that could bypass security
 *
 * USAGE:
 *
 * Option 1 - Use createSecureBrowserWindow() (Recommended):
 * ```typescript
 * import { createSecureBrowserWindow } from './utils/security-manager'
 *
 * const window = createSecureBrowserWindow({
 *   width: 800,
 *   height: 600,
 *   webPreferences: {
 *     nodeIntegration: true, // Override secure defaults if needed
 *   }
 * })
 * ```
 *
 * Option 2 - Manual setup:
 * ```typescript
 * import { getSecureWebPreferences, applyDevToolsProtection } from './utils/security-manager'
 *
 * const window = new BrowserWindow({
 *   webPreferences: getSecureWebPreferences({ nodeIntegration: true })
 * })
 * applyDevToolsProtection(window)
 * ```
 *
 * SECURITY MEASURES:
 * - DevTools disabled in production (enabled in development)
 * - Web security enabled in production
 * - Context isolation enabled by default
 * - Node integration disabled by default (can be overridden)
 * - All DevTools shortcuts blocked
 * - Right-click context menu disabled
 * - Window opening handler set to deny
 *
 * DEVELOPMENT vs PRODUCTION:
 * - Development: app.isPackaged = false OR NODE_ENV != 'production'
 * - Production: app.isPackaged = true AND NODE_ENV = 'production'
 */

// Production guard - check if we're in development or production
export const isDevelopment = !app.isPackaged && process.env.NODE_ENV !== 'production'

/**
 * Get secure webPreferences for BrowserWindow
 */
export function getSecureWebPreferences(additionalOptions: any = {}) {
  return {
    // Security settings - disable DevTools in production
    devTools: isDevelopment,
    // Additional security measures
    webSecurity: !isDevelopment,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    // Disable Node integration for better security (override if needed)
    nodeIntegration: false,
    contextIsolation: true,
    // Merge any additional options
    ...additionalOptions,
  }
}

/**
 * Apply DevTools protection to a BrowserWindow
 * This should be called after creating any BrowserWindow in production
 */
export function applyDevToolsProtection(window: BrowserWindow): void {
  if (!isDevelopment) {
    // Hide menu bar in production
    window.setMenuBarVisibility(false)

    // Remove right-click context menu
    window.webContents.on('context-menu', event => {
      event.preventDefault()
    })

    // Disable DevTools keyboard shortcuts
    window.webContents.on('before-input-event', (event, input) => {
      if (isDevToolsShortcut(input)) {
        event.preventDefault()
      }
    })

    // Block DevTools from being opened programmatically
    window.webContents.on('devtools-opened', () => {
      window.webContents.closeDevTools()
    })

    // Prevent new window creation that could bypass security
    window.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' }
    })
  }
}

/**
 * Check if the keyboard input is a DevTools shortcut
 */
function isDevToolsShortcut(input: any): boolean {
  const { key, control, meta, shift } = input

  // F12
  if (key === 'F12') {
    return true
  }

  // Ctrl+Shift+I (Windows/Linux) or Cmd+Option+I (macOS) - DevTools
  if ((control || meta) && shift && key.toLowerCase() === 'i') {
    return true
  }

  // Ctrl+Shift+J (Windows/Linux) or Cmd+Option+J (macOS) - Console
  if ((control || meta) && shift && key.toLowerCase() === 'j') {
    return true
  }

  // Ctrl+Shift+C (Windows/Linux) or Cmd+Option+C (macOS) - Elements
  if ((control || meta) && shift && key.toLowerCase() === 'c') {
    return true
  }

  // Ctrl+U (Windows/Linux) or Cmd+U (macOS) - View Source
  if ((control || meta) && key.toLowerCase() === 'u') {
    return true
  }

  // Ctrl+Shift+K (Windows/Linux) or Cmd+Option+K (macOS) - Console (Firefox style)
  if ((control || meta) && shift && key.toLowerCase() === 'k') {
    return true
  }

  // F5 or Ctrl+R / Cmd+R - Refresh (optional - uncomment if you want to disable refresh)
  if (key === 'F5' || ((control || meta) && key.toLowerCase() === 'r')) {
    return true
  }

  return false
}

/**
 * Create a secure BrowserWindow with DevTools protection
 * This is a wrapper function that applies all security measures
 */
export function createSecureBrowserWindow(
  options: Electron.BrowserWindowConstructorOptions
): BrowserWindow {
  // Ensure secure webPreferences
  const secureOptions = {
    ...options,
    webPreferences: getSecureWebPreferences(options.webPreferences || {}),
  }

  const window = new BrowserWindow(secureOptions)

  // Apply DevTools protection
  applyDevToolsProtection(window)

  return window
}
