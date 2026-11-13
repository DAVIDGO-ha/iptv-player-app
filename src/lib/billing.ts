// Google Play version only: the lifetime licence is bought with Google Play Billing (product id "lifetime").
// Prices per country are set in Play Console (£15 UK, €15 Europe, $15 everywhere else); Google shows the local price.
import { PLAY } from './flavor'
import { read, write } from './settings'

const W = window as any
const call = async (method: string, args: any = {}) => {
  const C = W.Capacitor
  if (!C?.isNativePlatform?.()) throw new Error('Google Play is not available')
  return C.nativePromise ? C.nativePromise('Billing', method, args) : C.Plugins?.Billing?.[method](args)
}

export const hasGooglePlay = () => PLAY && !!W.Capacitor?.isNativePlatform?.()

/** Bought on Google Play (saved on the device, re-checked with Google on every start). */
export const gpOwned = () => PLAY && !!read<boolean>('ip.gplay', false)
const setOwned = (v: boolean) => {
  if (gpOwned() === v) return
  write('ip.gplay', v)
  window.dispatchEvent(new Event('ip-blocked')) // re-checks the lock screen
}

/** Local price from Google Play, e.g. "£15.00" (null if Google Play can't be reached). */
export async function gpPrice(): Promise<string | null> {
  try {
    const r = await call('info')
    return r?.price ? String(r.price) : null
  } catch {
    return null
  }
}

/** Opens the Google Play payment sheet. Returns 'owned' | 'pending' | 'cancelled'. */
export async function gpBuy(): Promise<'owned' | 'pending' | 'cancelled'> {
  const r = await call('buy')
  if (r?.owned) setOwned(true)
  return r?.owned ? 'owned' : r?.pending ? 'pending' : 'cancelled'
}

/** Asks Google whether this Google account already owns the lifetime licence (reinstall / new device / refund). */
export async function gpRestore(): Promise<boolean | null> {
  if (!hasGooglePlay()) return null
  try {
    const r = await call('restore')
    if (r?.ok) setOwned(!!r.owned)
    return r?.ok ? !!r.owned : null
  } catch {
    return null
  }
}
